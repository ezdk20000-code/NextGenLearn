import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { memoryStore } from '../src/profiles.js'
import { createRegistry } from '../src/registry.js'
import { HttpModelProvider } from '../src/providers/http-model.js'
import type { ModelProvider } from '../src/providers/types.js'
import { evaluate, subnetInfo, recallProbability } from '../../shared/sci-tools.js'

const learner = { name: 'Алексей', level: 2, track: 'Сетевые протоколы с нуля', mastered: ['Что такое сеть'], weakSpots: [] }

/** Подставная модель: в чате вызывает научный инструмент и пересказывает результат. */
function fakeLlm(): ModelProvider & { lastSystem?: string; lastPrompt?: string } {
  const p: ModelProvider & { lastSystem?: string; lastPrompt?: string } = {
    id: 'fake', label: 'Fake LLM', kind: 'llm', capabilities: ['chat', 'json'], ready: () => true,
    async chat(req) {
      p.lastSystem = req.system
      const tool = req.tools!.find((t) => t.name === 'ipv4_subnet')!
      req.onTool?.(tool.name)
      const r = (await tool.execute({ cidr: '192.168.1.0/26' })) as { usableHosts: number }
      const text = `В подсети /26 помещается ${r.usableHosts} устройства.`
      req.onText?.(text)
      return { text, refused: false, truncated: false, model: 'fake' }
    },
    async json(req) {
      p.lastPrompt = req.prompt
      if (req.prompt.includes('флеш-карточки')) return { cards: [{ front: 'Что такое MAC?', back: 'Адрес сетевой карты' }, { front: '', back: 'пустой — отбросить' }] }
      return { understood: true, score: 88, feedback: 'Хорошо!', missing: [], insight: 'хорошо объясняет через аналогии' }
    },
  }
  return p
}

function setup() {
  const fake = fakeLlm()
  const registry = createRegistry({ modelsFile: '/nonexistent.json', extra: [fake] })
  const profiles = memoryStore()
  const app = buildApp({ registry, profiles })
  return { app, fake, profiles }
}
const H = { 'x-ngl-user': 'alexey' }

describe('научные инструменты', () => {
  it('подсети считаются точно', () => {
    expect(subnetInfo('192.168.1.77/26')).toMatchObject({ network: '192.168.1.64', broadcast: '192.168.1.127', usableHosts: 62, mask: '255.255.255.192', isPrivate: true })
    expect(subnetInfo('8.8.8.8/30').usableHosts).toBe(2)
    expect(() => subnetInfo('300.1.1.1/24')).toThrow()
  })
  it('калькулятор без eval', () => {
    expect(evaluate('2^(32-26)-2')).toBe(62)
    expect(evaluate('log(1024;2)')).toBeCloseTo(10)
    expect(evaluate('sqrt(16)*(1+2)')).toBe(12)
    expect(() => evaluate('process.exit()')).toThrow()
  })
  it('кривая забывания: через S дней — 90%', () => {
    expect(recallProbability(10, 10)).toBeCloseTo(0.9, 6)
  })
})

describe('API наставника', () => {
  it('без ключа Claude честно отвечает 503', async () => {
    const saved = { k: process.env.ANTHROPIC_API_KEY, t: process.env.ANTHROPIC_AUTH_TOKEN }
    delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN
    const { app } = setup()
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/grade', headers: H, payload: { learner, prompt: 'Что такое сеть?', keyIdeas: ['устройства'], answer: 'Это когда компьютеры связаны' } })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('not_configured')
    Object.assign(process.env, saved.k ? { ANTHROPIC_API_KEY: saved.k } : {}, saved.t ? { ANTHROPIC_AUTH_TOKEN: saved.t } : {})
  })

  it('у каждого ученика свой профиль: маршрутизация задач на другую модель', async () => {
    const { app } = setup()
    const put = await app.inject({ method: 'PUT', url: '/api/v1/ai/profile', headers: H, payload: { routing: { grade: 'fake', cards: 'fake', mentor: 'fake' }, style: 'direct' } })
    expect(put.statusCode).toBe(200)
    expect(put.json().routing.grade).toBe('fake')
    const other = await app.inject({ method: 'GET', url: '/api/v1/ai/profile', headers: { 'x-ngl-user': 'maria' } })
    expect(other.json().routing.grade).toBe('claude')
    const bad = await app.inject({ method: 'PUT', url: '/api/v1/ai/profile', headers: H, payload: { routing: { grade: 'nope' } } })
    expect(bad.statusCode).toBe(400)
  })

  it('проверка Фейнмана сохраняет наблюдение в память ученика', async () => {
    const { app, fake, profiles } = setup()
    await app.inject({ method: 'PUT', url: '/api/v1/ai/profile', headers: H, payload: { routing: { grade: 'fake' } } })
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/grade', headers: H, payload: { learner, prompt: 'Объясни инкапсуляцию', keyIdeas: ['заголовок', 'слой'], answer: 'Каждый слой заворачивает данные в свой конверт' } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ understood: true, score: 88 })
    expect((await profiles.get('alexey')).memory).toContain('хорошо объясняет через аналогии')
    expect(fake.lastPrompt).toContain('Каждый слой заворачивает')
  })

  it('карточки из конспекта: пустые отбрасываются', async () => {
    const { app } = setup()
    await app.inject({ method: 'PUT', url: '/api/v1/ai/profile', headers: H, payload: { routing: { cards: 'fake' } } })
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/cards', headers: H, payload: { learner, topic: 'Ethernet', text: 'MAC-адрес — это уникальный адрес сетевой карты в локальной сети.' } })
    expect(res.json().cards).toEqual([{ front: 'Что такое MAC?', back: 'Адрес сетевой карты' }])
  })

  it('чат: поток SSE, наставник вызывает научный инструмент, видит профиль и память', async () => {
    const { app, fake, profiles } = setup()
    await profiles.remember('alexey', 'путает MAC и IP')
    await app.inject({ method: 'PUT', url: '/api/v1/ai/profile', headers: H, payload: { routing: { mentor: 'fake' } } })
    const res = await app.inject({ method: 'POST', url: '/api/v1/ai/mentor', headers: H, payload: { learner, messages: [{ role: 'user', content: 'Сколько устройств в /26?' }] } })
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('event: tool')
    expect(res.body).toContain('62 устройства')
    expect(res.body).toContain('event: done')
    expect(fake.lastSystem).toContain('путает MAC и IP')
    expect(fake.lastSystem).toContain('Сетевые протоколы с нуля')
  })

  it('внешняя научная модель подключается как инструмент', async () => {
    const calls: unknown[] = []
    const fakeFetch = (async (_url: string, init: RequestInit) => { calls.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ result: 'x = 2' })) }) as typeof fetch
    const wolfram = new HttpModelProvider({ id: 'wolfram', label: 'Wolfram', domain: 'Математика', url: 'https://example.test/w', description: 'Решает уравнения', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }, fakeFetch)
    const registry = createRegistry({ modelsFile: '/nonexistent.json', extra: [wolfram] })
    const tool = registry.tools().find((t) => t.name === 'wolfram')!
    expect(await tool.execute({ query: 'x+1=3' })).toEqual({ result: 'x = 2' })
    expect(calls).toEqual([{ query: 'x+1=3' }])
    const app = buildApp({ registry, profiles: memoryStore() })
    const list = (await app.inject({ method: 'GET', url: '/api/v1/ai/providers' })).json()
    expect(list.providers.map((p: { id: string }) => p.id)).toEqual(['claude', 'wolfram'])
    expect(list.tools.map((t: { name: string }) => t.name)).toContain('wolfram')
  })
})
