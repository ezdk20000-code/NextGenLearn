import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { nodeById, trackById } from '../data'
import { useStore } from '../store'
import type { LearnerContext } from '../../shared/tutor'
import { accountChannel, offlineChannel, serverChannel, type AiChannel, type ChannelId } from './channels'

export interface MentorTopic { title: string; summary: string; material?: string }

interface Ai {
  channel: AiChannel
  /** Проверяем доступность выбранного канала */
  status: 'checking' | 'ready' | 'fallback'
  availability: Record<ChannelId, boolean | null>
  learner: (topic?: MentorTopic) => LearnerContext
  topic: MentorTopic | null
  setTopic: (t: MentorTopic | null) => void
  mentorOpen: boolean
  openMentor: (prompt?: string) => void
  closeMentor: () => void
  pendingPrompt: string | null
  takePrompt: () => string | null
}

const Ctx = createContext<Ai | null>(null)

export function AiProvider({ children }: { children: ReactNode }) {
  const s = useStore()
  const [availability, setAvailability] = useState<Record<ChannelId, boolean | null>>({ account: null, server: null, offline: true })
  const [topic, setTopic] = useState<MentorTopic | null>(null)
  const [mentorOpen, setMentorOpen] = useState(false)
  const [pendingPrompt, setPending] = useState<string | null>(null)

  const channels = useMemo(() => ({
    account: accountChannel(s.ai.tiers, s.ai.tools),
    server: serverChannel(s.ai.serverUrl, s.userId),
    offline: offlineChannel,
  }), [s.ai.tiers, s.ai.tools, s.ai.serverUrl, s.userId])

  useEffect(() => {
    let alive = true
    channels.account.available().then((ok) => alive && setAvailability((a) => ({ ...a, account: ok })))
    channels.server.available().then((ok) => alive && setAvailability((a) => ({ ...a, server: ok })))
    return () => { alive = false }
  }, [channels])

  const want = s.ai.channel
  const resolved: ChannelId = want === 'auto'
    ? (availability.account ? 'account' : availability.server ? 'server' : 'offline')
    : want
  const usable = availability[resolved] !== false
  const channel = usable ? channels[resolved] : channels.offline
  const status: Ai['status'] = want === 'auto' && (availability.account === null || availability.server === null) ? 'checking'
    : usable && resolved !== 'offline' ? 'ready' : 'fallback'

  const learner = (t?: MentorTopic): LearnerContext => {
    const track = trackById(s.activeTrack)
    const now = Date.now()
    const weak = Object.entries(s.cards)
      .filter(([, c]) => c.lastReview && (c.difficulty >= 7 || c.lapses >= 2 || c.due < now - 86_400_000))
      .map(([id]) => s.cardDef(id)?.front).filter((x): x is string => Boolean(x)).slice(0, 6)
    return {
      name: s.name,
      level: s.level,
      track: track?.title ?? '',
      mastered: s.lessonsDone.map((id) => nodeById(id)?.title).filter((x): x is string => Boolean(x)),
      current: t ?? topic ?? undefined,
      weakSpots: weak,
      memory: s.aiMemory,
      style: s.prefs.mentorStyle,
    }
  }

  const value: Ai = {
    channel, status, availability, learner, topic, setTopic,
    mentorOpen,
    openMentor: (prompt) => { if (prompt) setPending(prompt); setMentorOpen(true) },
    closeMentor: () => setMentorOpen(false),
    pendingPrompt,
    takePrompt: () => { const p = pendingPrompt; setPending(null); return p },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAi() {
  const a = useContext(Ctx)
  if (!a) throw new Error('AiProvider missing')
  return a
}

/** Страница сообщает наставнику, о чём сейчас идёт речь. */
export function useMentorTopic(t: MentorTopic | null) {
  const { setTopic } = useAi()
  const key = t ? `${t.title}|${t.summary}` : ''
  useEffect(() => { setTopic(t); return () => setTopic(null) }, [key]) // eslint-disable-line
}

export const AI_ERROR_COPY: Record<string, string> = {
  not_granted: 'Ты не разрешил странице обращаться к Claude. Включить можно в меню разрешений страницы.',
  sampling_disabled: 'Claude недоступен для этого аккаунта.',
  rate_limited: 'Слишком много запросов. Подожди немного и попробуй снова.',
  refused: 'Наставник не может ответить на этот запрос. Попробуй переформулировать.',
  not_configured: 'Сервер NGL не настроен: нет ключа Claude.',
  network: 'Сервер NGL не отвечает.',
  unavailable: 'Claude недоступен на этой странице.',
  session_expired: 'Нужно заново войти в Claude.',
  invalid_json: 'Наставник ответил не в том формате. Попробуй ещё раз.',
}
export const aiErrorText = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? 'upstream'
  return AI_ERROR_COPY[code] ?? 'Связь с наставником прервалась. Попробуй ещё раз.'
}
