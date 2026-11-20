import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CARDS, NODES, STARTER_CARDS, nodeById } from './data/networks'

// ---------------------------------------------------------------------------
// Упрощённый FSRS: стабильность S (дни) и сложность D (1..10).
// При целевом удержании 90% следующий интервал ≈ S.
// ---------------------------------------------------------------------------

export type Rating = 1 | 2 | 3 | 4 // Снова, Трудно, Хорошо, Легко
export interface CardState { s: number; d: number; due: number; reps: number; lapses: number }

const DAY = 86_400_000
const W_INIT = [0.4, 1.2, 3.2, 15.7] // начальная стабильность для 4 оценок

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)) }

export function scheduleCard(c: CardState | undefined, r: Rating, now: number): CardState {
  if (!c || c.reps === 0) {
    const s = W_INIT[r - 1]
    const d = clamp(5 - (r - 3) * 1.5, 1, 10)
    return { s, d, due: now + (r === 1 ? 60_000 : s * DAY), reps: 1, lapses: r === 1 ? 1 : 0 }
  }
  const d = clamp(c.d - (r - 3) * 0.8, 1, 10)
  if (r === 1) {
    const s = Math.max(0.3, c.s * 0.25)
    return { s, d, due: now + 60_000, reps: c.reps + 1, lapses: c.lapses + 1 }
  }
  const growth = Math.exp(1.5) * (11 - d) * Math.pow(c.s, -0.15) * (Math.exp(0.25) - 1)
  const mod = r === 2 ? 0.45 : r === 4 ? 1.6 : 1
  const s = c.s * (1 + growth * mod)
  return { s, d, due: now + s * DAY, reps: c.reps + 1, lapses: c.lapses }
}

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

const KEY = 'ngl-state-v1'

function initialState(): State {
  const now = Date.now()
  const cards: Record<string, CardState> = {}
  STARTER_CARDS.forEach((id, i) => {
    // часть карточек «созрела» к повторению сегодня
    cards[id] = { s: 2 + i, d: 5, due: now - (i + 1) * 3_600_000, reps: 2, lapses: 0 }
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
        cards: { ...s.cards, [cardId]: scheduleCard(s.cards[cardId], r, Date.now()) },
        reviewsToday: s.reviewsToday + 1,
        xp: s.xp + 5,
      })),
      addCards: (ids) => setState((s) => {
        const cards = { ...s.cards }
        ids.forEach((id) => { if (!cards[id]) cards[id] = { s: 0, d: 5, due: Date.now(), reps: 0, lapses: 0 } })
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
