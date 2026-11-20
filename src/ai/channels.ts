// Каналы связи с ИИ. Остальной код зовёт только интерфейс AiChannel —
// поэтому модель или способ подключения меняются без правок экранов.
//
//  • account — Claude через аккаунт самого ученика (возможность `sample`
//    опубликованной страницы claude.ai). У каждого человека своя интеграция:
//    его аккаунт, его лимиты, его согласие.
//  • server  — сервер NGL (server/): Claude по Anthropic API, другие LLM
//    и научные модели, личный профиль ученика на сервере.
//  • offline — без ИИ: простые эвристики, чтобы всё работало и без связи.

import { SCI_TOOLS } from '../../shared/sci-tools'
import {
  cardsPrompt, coerceCards, coerceVerdict, feynmanPrompt, mentorTurns,
  type CardDraft, type ChatTurn, type FeynmanVerdict, type LearnerContext,
} from '../../shared/tutor'

export type ChannelId = 'account' | 'server' | 'offline'
export type Tier = 'quick' | 'default' | 'complex'
export interface AiTiers { mentor: Tier; grade: Tier; cards: Tier }

export interface CallOpts { signal?: AbortSignal; onText?: (text: string) => void; onTool?: (name: string) => void }
export interface AiError { code: string; message: string; text?: string }

export interface AiChannel {
  id: ChannelId
  label: string
  available(): Promise<boolean>
  mentor(ctx: LearnerContext, history: ChatTurn[], opts: CallOpts): Promise<string>
  grade(ctx: LearnerContext, task: { prompt: string; keyIdeas: string[]; answer: string }): Promise<FeynmanVerdict>
  cards(ctx: LearnerContext, note: { topic: string; text: string }): Promise<CardDraft[]>
}

export const err = (code: string, message: string, text?: string): AiError => ({ code, message, text })

// ---------------------------------------------------------------------------
// Claude через аккаунт ученика (sample)
// ---------------------------------------------------------------------------

interface SampleFn {
  (input: string | ChatTurn[], opts?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>
  json<T = unknown>(input: string | ChatTurn[], opts?: Record<string, unknown>): Promise<T>
  limits(): Promise<{ tools?: { maxCount: number } }>
}
declare global { interface Window { claude?: { use(name: string): Promise<unknown> } } }

let samplePromise: Promise<SampleFn | null> | null = null
function getSample(): Promise<SampleFn | null> {
  samplePromise ??= (async () => {
    try { return (await window.claude?.use('sample')) as SampleFn | null ?? null } catch { return null }
  })()
  return samplePromise
}

const pageTools = (enabled: string[] | null, onTool?: (n: string) => void) => SCI_TOOLS
  .filter((t) => !enabled || enabled.includes(t.name))
  .map((t) => ({
    name: t.name, description: t.description, inputSchema: t.inputSchema,
    execute: (input: Record<string, unknown>) => { onTool?.(t.name); return t.execute(input) },
  }))

export function accountChannel(tiers: AiTiers, tools: string[] | null): AiChannel {
  return {
    id: 'account',
    label: 'Claude · твой аккаунт',
    available: async () => (await getSample()) !== null,
    async mentor(ctx, history, opts) {
      const sample = await getSample()
      if (!sample) throw err('unavailable', 'Claude недоступен на этой странице')
      const canTools = Boolean((await sample.limits().catch(() => null))?.tools)
      const res = await sample(mentorTurns(ctx, history), {
        modelTier: tiers.mentor, cache: false, signal: opts.signal,
        onText: ({ text }: { text: string }) => opts.onText?.(text),
        ...(canTools ? { tools: pageTools(tools, opts.onTool) } : {}),
      })
      return res.text
    },
    async grade(ctx, task) {
      const sample = await getSample()
      if (!sample) throw err('unavailable', 'Claude недоступен на этой странице')
      const v = coerceVerdict(await sample.json(feynmanPrompt(ctx, task), { modelTier: tiers.grade, cache: false }))
      if (!v) throw err('invalid_json', 'Наставник ответил не в том формате')
      return v
    },
    async cards(ctx, note) {
      const sample = await getSample()
      if (!sample) throw err('unavailable', 'Claude недоступен на этой странице')
      return coerceCards(await sample.json(cardsPrompt(ctx, note), { modelTier: tiers.cards, cache: false }))
    },
  }
}

// ---------------------------------------------------------------------------
// Сервер NGL
// ---------------------------------------------------------------------------

export function serverChannel(baseUrl: string, userId: string): AiChannel {
  const url = (p: string) => `${baseUrl.replace(/\/$/, '')}${p}`
  const headers = { 'content-type': 'application/json', 'x-ngl-user': userId }
  async function post<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try { res = await fetch(url(path), { method: 'POST', headers, body: JSON.stringify(body) }) } catch { throw err('network', 'Сервер NGL не отвечает') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw err(data.code ?? 'upstream', data.message ?? `Ошибка сервера ${res.status}`)
    return data as T
  }
  return {
    id: 'server',
    label: 'Сервер NGL',
    async available() {
      if (!baseUrl) return false
      try { return (await fetch(url('/health'), { signal: AbortSignal.timeout(3000) })).ok } catch { return false }
    },
    async mentor(ctx, history, opts) {
      let res: Response
      try {
        res = await fetch(url('/api/v1/ai/mentor'), { method: 'POST', headers, body: JSON.stringify({ learner: ctx, messages: history }), signal: opts.signal })
      } catch (e) { throw (e as Error).name === 'AbortError' ? err('cancelled', 'Остановлено') : err('network', 'Сервер NGL не отвечает') }
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw err(d.code ?? 'upstream', d.message ?? 'Ошибка сервера') }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = '', text = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
          const ev = /^event: (.+)$/m.exec(chunk)?.[1]
          const data = JSON.parse(/^data: (.+)$/m.exec(chunk)?.[1] ?? '{}')
          if (ev === 'delta') { text += data.delta; opts.onText?.(text) }
          if (ev === 'tool') opts.onTool?.(data.name)
          if (ev === 'error') throw err(data.code, data.message, text)
          if (ev === 'done' && data.refused) throw err('refused', 'Наставник не может ответить на этот запрос')
        }
      }
      return text
    },
    grade: (ctx, task) => post<FeynmanVerdict>('/api/v1/ai/grade', { learner: ctx, ...task }),
    cards: async (ctx, note) => (await post<{ cards: CardDraft[] }>('/api/v1/ai/cards', { learner: ctx, ...note })).cards,
  }
}

// ---------------------------------------------------------------------------
// Офлайн: работает всегда, но без понимания смысла
// ---------------------------------------------------------------------------

export const offlineChannel: AiChannel = {
  id: 'offline',
  label: 'Офлайн (без ИИ)',
  available: async () => true,
  async mentor(ctx, _history, opts) {
    const text = `Сейчас ИИ-наставник не подключён, поэтому подробно ответить не получится.\n\nЧто можно сделать: перечитай урок «${ctx.current?.title ?? ctx.track}», попробуй объяснить идею вслух своими словами и запиши вопрос в заметки задачи — наставник разберёт его, когда подключится. Подключить Claude можно в Профиле → ИИ-наставник.`
    opts.onText?.(text)
    return text
  },
  async grade(_ctx, task) {
    const lower = task.answer.toLowerCase()
    const hits = task.keyIdeas.filter((k) => lower.includes(k.toLowerCase()))
    const ok = task.answer.trim().length >= 30 && hits.length > 0
    return {
      understood: ok,
      score: ok ? 70 : 30,
      feedback: ok ? 'Похоже, главная идея есть. Это быстрая проверка по ключевым словам — ИИ-наставник оценил бы смысл точнее.' : 'Не хватает ключевой идеи или объяснение слишком короткое. Вспомни аналогию из урока.',
      missing: ok ? [] : task.keyIdeas.slice(0, 2),
      insight: '',
    }
  },
  async cards(_ctx, note) {
    return note.text.split(/\n+/).map((l) => l.replace(/^[-*#\s]+/, '').trim())
      .map((l) => /^(.{3,80}?)\s*[—:–-]\s+(.{3,200})$/.exec(l)).filter(Boolean)
      .map((m) => ({ front: `Что такое «${m![1]}»?`, back: m![2] })).slice(0, 6)
  },
}
