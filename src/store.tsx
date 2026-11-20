import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CARDS, NODES, STARTER_CARDS, nodeById } from './data/networks'

import { newCard, review, type FsrsCard, type Grade } from './lib/fsrs'

export type Rating = Grade // 1 Снова, 2 Трудно, 3 Хорошо, 4 Легко
export type CardState = FsrsCard
const DAY = 86_400_000

export function formatInterval(ms: number) {
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} мин`
  const days = ms / DAY
  if (days < 1) return `${Math.round(ms / 3_600_000)} ч`
  if (days < 30) return `${Math.round(days)} дн`
  if (days < 365) return `${Math.round(days / 30)} мес`
  return `${(days / 365).toFixed(1)} г`
}

// ---------------------------------------------------------------------------
// Состояние пользователя (в прототипе — в localStorage браузера)
// ---------------------------------------------------------------------------

export interface PlanItem { id: string; time: string; title: string; kind: 'lesson' | 'lab' | 'review' | 'focus'; minutes: number; to: string; done: boolean }

interface State {
  name: string
  xp: number
  streak: number
  lessonsDone: string[]
  labsDone: string[]
  cards: Record<string, CardState>
  reviewsToday: number
  focusMinutes: number
  notes: Record<string, string>
  planDone: string[]
}

const KEY = 'ngl-state-v2'

function initialState(): State {
  const now = Date.now()
  const cards: Record<string, CardState> = {}
  STARTER_CARDS.forEach((id, i) => {
    // часть карточек «созрела» к повторению сегодня
    const stability = 2 + i
    cards[id] = { stability, difficulty: 5, status: 'review', reps: 2, lapses: 0, lastReview: now - stability * DAY - (i + 1) * 3_600_000, due: now - (i + 1) * 3_600_000 }
  })
  return {
    name: 'Алексей',
    xp: 340,
    streak: 4,
    lessonsDone: ['what-is-network', 'packets'],
    labsDone: [],
    cards,
    reviewsToday: 0,
    focusMinutes: 25,
    notes: {},
    planDone: [],
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...initialState(), ...JSON.parse(raw) }
  } catch { /* приватный режим — работаем без сохранения */ }
  return initialState()
}

export type NodeStatus = 'done' | 'available' | 'locked'

interface Store extends State {
  status: (id: string) => NodeStatus
  mastery: (id: string) => number
  completeLesson: (id: string) => void
  completeLab: (labId: string, nodeId: string, xp: number) => void
  addXp: (n: number) => void
  rate: (cardId: string, r: Rating) => void
  addCards: (ids: string[]) => void
  dueCards: () => string[]
  saveNote: (id: string, text: string) => void
  addFocus: (min: number) => void
  togglePlan: (id: string) => void
  reset: () => void
  trackProgress: number
  nextNode: string | undefined
  toast: string | null
  notify: (msg: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }, [])

  const status = useCallback((id: string): NodeStatus => {
    if (state.lessonsDone.includes(id)) return 'done'
    const n = nodeById(id)
    if (!n) return 'locked'
    return n.requires.every((r) => state.lessonsDone.includes(r)) ? 'available' : 'locked'
  }, [state.lessonsDone])

  const mastery = useCallback((id: string) => {
    const n = nodeById(id)
    if (!n) return 0
    let m = state.lessonsDone.includes(id) ? (n.lab ? 70 : 100) : 0
    if (n.lab && state.labsDone.includes(n.lab)) m += 30
    return m
  }, [state.lessonsDone, state.labsDone])

  const value = useMemo<Store>(() => {
    const done = NODES.filter((n) => state.lessonsDone.includes(n.id)).length
    const nextNode = NODES.find((n) => status(n.id) === 'available')?.id
    return {
      ...state,
      status,
      mastery,
      toast,
      notify,
      trackProgress: Math.round((done / NODES.length) * 100),
      nextNode,
      completeLesson: (id) => setState((s) => {
        if (s.lessonsDone.includes(id)) return s
        const xp = nodeById(id)?.xp ?? 50
        return { ...s, lessonsDone: [...s.lessonsDone, id], xp: s.xp + xp }
      }),
      completeLab: (labId, _nodeId, xp) => setState((s) => (
        s.labsDone.includes(labId) ? s : { ...s, labsDone: [...s.labsDone, labId], xp: s.xp + xp }
      )),
      addXp: (n) => setState((s) => ({ ...s, xp: s.xp + n })),
      rate: (cardId, r) => setState((s) => ({
        ...s,
        cards: { ...s.cards, [cardId]: review(s.cards[cardId] ?? newCard(Date.now()), r, Date.now()).card },
        reviewsToday: s.reviewsToday + 1,
        xp: s.xp + 5,
      })),
      addCards: (ids) => setState((s) => {
        const cards = { ...s.cards }
        ids.forEach((id) => { if (!cards[id]) cards[id] = newCard(Date.now()) })
        return { ...s, cards }
      }),
      dueCards: () => Object.entries(state.cards)
        .filter(([id, c]) => c.due <= Date.now() && CARDS.some((x) => x.id === id))
        .sort((a, b) => a[1].due - b[1].due)
        .map(([id]) => id),
      saveNote: (id, text) => setState((s) => ({ ...s, notes: { ...s.notes, [id]: text } })),
      addFocus: (min) => setState((s) => ({ ...s, focusMinutes: s.focusMinutes + min })),
      togglePlan: (id) => setState((s) => ({
        ...s,
        planDone: s.planDone.includes(id) ? s.planDone.filter((x) => x !== id) : [...s.planDone, id],
      })),
      reset: () => setState(initialState()),
    }
  }, [state, status, mastery, toast, notify])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
