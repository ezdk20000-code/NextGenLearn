import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import { CARDS_SCHEMA, FEYNMAN_SCHEMA, cardsPrompt, coerceCards, coerceVerdict, feynmanPrompt, mentorSystem, type LearnerContext } from '../../shared/tutor.js'
import { AI_TASKS, DEFAULT_MODEL, type AiTask, type Registry } from './registry.js'
import type { ProfileStore } from './profiles.js'
import { ProviderError, type ModelProvider } from './providers/types.js'

const Learner = z.object({
  name: z.string().max(80),
  level: z.number().int().min(0).max(1000),
  track: z.string().max(200),
  mastered: z.array(z.string().max(200)).max(200),
  current: z.object({ title: z.string().max(200), summary: z.string().max(1000), material: z.string().max(8000).optional() }).optional(),
  weakSpots: z.array(z.string().max(300)).max(30),
  memory: z.array(z.string().max(300)).max(50).optional(),
  style: z.enum(['socratic', 'direct']).optional(),
})
const Turn = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(20000) })

/** Кто спрашивает. В прототипе — заголовок; в рабочей версии — проверенный JWT. */
function userId(req: FastifyRequest) {
  const id = req.headers['x-ngl-user']
  return typeof id === 'string' && /^[\w-]{1,64}$/.test(id) ? id : 'anonymous'
}

export function buildApp(deps: { registry: Registry; profiles: ProfileStore }) {
  const app = Fastify({ logger: false })
  const { registry, profiles } = deps

  /** Поставщик для задачи по личному профилю ученика. */
  async function providerFor(uid: string, task: AiTask): Promise<{ p: ModelProvider; effort: 'low' | 'medium' | 'high' }> {
    const prof = await profiles.get(uid)
    const p = registry.providers.get(prof.routing[task]) ?? registry.providers.get('claude')!
    return { p, effort: prof.effort[task] }
  }
  async function learner(uid: string, raw: z.infer<typeof Learner>): Promise<LearnerContext> {
    const prof = await profiles.get(uid)
    return { ...raw, memory: prof.memory, style: raw.style ?? prof.style }
  }
  function fail(reply: FastifyReply, e: unknown) {
    if (e instanceof ProviderError) {
      const status = { not_configured: 503, refused: 422, rate_limited: 429, upstream: 502, bad_request: 400 }[e.code]
      return reply.code(status).send({ code: e.code, message: e.message })
    }
    if (e instanceof z.ZodError) return reply.code(400).send({ code: 'bad_request', message: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
    return reply.code(500).send({ code: 'internal', message: 'Внутренняя ошибка' })
  }

  app.get('/health', async () => ({ ok: true }))

  /** Какие модели и инструменты доступны (для экрана настроек). */
  app.get('/api/v1/ai/providers', async () => ({
    defaultModel: DEFAULT_MODEL,
    providers: [...registry.providers.values()].map((p) => ({ id: p.id, label: p.label, kind: p.kind, capabilities: p.capabilities, ready: p.ready() })),
    tools: registry.tools().map((t) => ({ name: t.name, domain: t.domain, description: t.description })),
  }))

  app.get('/api/v1/ai/profile', async (req) => profiles.get(userId(req)))

  app.put('/api/v1/ai/profile', async (req, reply) => {
    try {
      const body = z.object({
        style: z.enum(['socratic', 'direct']).optional(),
        routing: z.record(z.enum(AI_TASKS as [AiTask, ...AiTask[]]), z.string()).optional(),
        effort: z.record(z.enum(AI_TASKS as [AiTask, ...AiTask[]]), z.enum(['low', 'medium', 'high'])).optional(),
        tools: z.array(z.string()).nullable().optional(),
        memory: z.array(z.string().max(300)).max(30).optional(),
      }).parse(req.body)
      for (const id of Object.values(body.routing ?? {})) {
        const p = registry.providers.get(id)
        if (!p || !p.capabilities.some((c) => c === 'chat' || c === 'json')) throw new ProviderError('bad_request', `Модель «${id}» не может решать эту задачу`)
      }
      const prev = await profiles.get(userId(req))
      return profiles.update(userId(req), {
        ...body,
        routing: { ...prev.routing, ...body.routing },
        effort: { ...prev.effort, ...body.effort },
      })
    } catch (e) { return fail(reply, e) }
  })

  /** Чат с наставником: потоковый ответ (Server-Sent Events). */
  app.post('/api/v1/ai/mentor', async (req, reply) => {
    const uid = userId(req)
    let body: { learner: z.infer<typeof Learner>; messages: z.infer<typeof Turn>[] }
    try {
      body = z.object({ learner: Learner, messages: z.array(Turn).min(1).max(40) }).parse(req.body)
      if (body.messages.at(-1)!.role !== 'user') throw new ProviderError('bad_request', 'Последнее сообщение должно быть от ученика')
    } catch (e) { return fail(reply, e) }

    const { p, effort } = await providerFor(uid, 'mentor')
    if (!p.chat || !p.ready()) return fail(reply, new ProviderError('not_configured', `${p.label} сейчас недоступен`))
    const prof = await profiles.get(uid)
    const ctl = new AbortController()
    req.raw.on('close', () => ctl.abort())

    reply.hijack()
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const send = (event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    try {
      const res = await p.chat({
        system: mentorSystem(await learner(uid, body.learner)),
        messages: body.messages,
        effort,
        tools: registry.tools(prof.tools ?? undefined),
        signal: ctl.signal,
        onText: (delta) => send('delta', { delta }),
        onTool: (name) => send('tool', { name }),
      })
      send('done', { refused: res.refused, truncated: res.truncated, model: res.model })
    } catch (e) {
      const err = e instanceof ProviderError ? { code: e.code, message: e.message } : { code: 'upstream', message: 'Ответ прервался' }
      if (!ctl.signal.aborted) send('error', err)
    }
    reply.raw.end()
  })

  /** Проверка объяснения «своими словами». */
  app.post('/api/v1/ai/grade', async (req, reply) => {
    const uid = userId(req)
    try {
      const body = z.object({
        learner: Learner,
        prompt: z.string().min(1).max(1000),
        keyIdeas: z.array(z.string().max(200)).max(20),
        answer: z.string().min(1).max(5000),
      }).parse(req.body)
      const { p, effort } = await providerFor(uid, 'grade')
      if (!p.json || !p.ready()) throw new ProviderError('not_configured', `${p.label} сейчас недоступен`)
      const raw = await p.json({ prompt: feynmanPrompt(await learner(uid, body.learner), body), schema: FEYNMAN_SCHEMA, effort })
      const verdict = coerceVerdict(raw)
      if (!verdict) throw new ProviderError('upstream', 'Модель вернула ответ не того формата')
      if (verdict.insight) await profiles.remember(uid, verdict.insight)
      return verdict
    } catch (e) { return fail(reply, e) }
  })

  /** Карточки из конспекта. */
  app.post('/api/v1/ai/cards', async (req, reply) => {
    const uid = userId(req)
    try {
      const body = z.object({ learner: Learner, topic: z.string().min(1).max(200), text: z.string().min(20).max(20000) }).parse(req.body)
      const { p, effort } = await providerFor(uid, 'cards')
      if (!p.json || !p.ready()) throw new ProviderError('not_configured', `${p.label} сейчас недоступен`)
      const raw = await p.json({ prompt: cardsPrompt(await learner(uid, body.learner), body), schema: CARDS_SCHEMA, effort })
      return { cards: coerceCards(raw) }
    } catch (e) { return fail(reply, e) }
  })

  return app
}
