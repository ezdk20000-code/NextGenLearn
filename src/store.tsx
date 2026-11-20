import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BUILTIN_CARDS, PLAYABLE, nodeById, trackById, trackOfNode, type CardDef } from './data'
import { STARTER_CARDS } from './data/networks'
import { currentRetrievability, elapsedDays, newCard, review, DEFAULT_W, type CardStatus, type FsrsCard, type FsrsParams, type Grade } from './lib/fsrs'

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

export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Состояние пользователя (в прототипе — в localStorage браузера)
// ---------------------------------------------------------------------------

export interface ReviewLog { cardId: string; grade: Grade; at: number; t: number; r: number; s: number; d: number; before: CardStatus }
export interface LearnEvent {
  type: 'lesson' | 'lab' | 'focus' | 'enroll' | 'card'
  ref: string
  at: number
  xp: number
  mistakes?: number
  firstTry?: number
  total?: number
  minutes?: number
}
export interface SrsSettings { requestRetention: number; maximumInterval: number; newPerDay: number; reviewsPerDay: number }
export interface Prefs { dailyMinutes: number; mentorStyle: 'socratic' | 'direct'; autoAmbient: boolean; reminders: boolean }

interface State {
  name: string
  xp: number
  enrolled: string[]
  activeTrack: string
  lessonsDone: string[]
  labsDone: string[]
  cards: Record<string, CardState>
  userCards: CardDef[]
  reviewLog: ReviewLog[]
  events: LearnEvent[]
  notes: Record<string, string>
  planDone: string[]
  srs: SrsSettings
  prefs: Prefs
  wishlist: string[]
}

const KEY = 'ngl-state-v3'
export const DEFAULT_SRS: SrsSettings = { requestRetention: 0.9, maximumInterval: 36500, newPerDay: 20, reviewsPerDay: 200 }

/** Демо-состояние: несколько дней учёбы уже позади, чтобы экраны не были пустыми. */
function initialState(): State {
  const now = Date.now()
  const cards: Record<string, CardState> = {}
  const reviewLog: ReviewLog[] = []
  STARTER_CARDS.forEach((id, i) => {
    // Две настоящих FSRS-оценки, затем сдвиг во времени так, чтобы карточка созрела сегодня
    const grades: Grade[] = i % 2 ? [3, 2] : [3, 3]
    let c = newCard(0)
    const local: ReviewLog[] = []
    let t = 0
    for (const g of grades) {
      const before = c.status
      const res = review(c, g, t)
      local.push({ cardId: id, grade: g, at: t, t: c.lastReview === null ? 0 : elapsedDays(c.lastReview, t), r: res.retrievability, s: res.card.stability, d: res.card.difficulty, before })
      c = res.card
      t = c.due
    }
    const shift = now - (i + 1) * 3_600_000 - c.due
    cards[id] = { ...c, lastReview: c.lastReview! + shift, due: c.due + shift }
    local.forEach((l) => reviewLog.push({ ...l, at: l.at + shift }))
  })
  reviewLog.sort((a, b) => a.at - b.at)
  const events: LearnEvent[] = [
    { type: 'enroll', ref: 'networks', at: now - 4 * DAY - 5 * 3_600_000, xp: 0 },
    { type: 'lesson', ref: 'what-is-network', at: now - 4 * DAY - 4 * 3_600_000, xp: 60, firstTry: 2, total: 2 },
    { type: 'focus', ref: 'plan', at: now - 3 * DAY, xp: 20, minutes: 25 },
    { type: 'lesson', ref: 'packets', at: now - 2 * DAY, xp: 80, firstTry: 3, total: 4 },
    { type: 'focus', ref: 'plan', at: now - 1 * DAY, xp: 20, minutes: 25 },
  ]
  return {
    name: 'Алексей',
    xp: 340,
    enrolled: ['networks'],
    activeTrack: 'networks',
    lessonsDone: ['what-is-network', 'packets'],
    labsDone: [],
    cards,
    userCards: [],
    reviewLog,
    events,
    notes: {},
    planDone: [],
    srs: DEFAULT_SRS,
    prefs: { dailyMinutes: 45, mentorStyle: 'socratic', autoAmbient: false, reminders: true },
    wishlist: [],
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
  // вычисляемое
  streak: number
  activeDays: Set<string>
  reviewsToday: number
  focusMinutes: number
  level: number
  levelProgress: number
  trackProgress: number
  nextNode: string | undefined
  fsrsParams: FsrsParams
  allCards: CardDef[]
  cardDef: (id: string) => CardDef | undefined
  trackOfCard: (id: string) => string | undefined
  status: (id: string) => NodeStatus
  mastery: (id: string) => number
  vitality: (nodeId: string) => number | null
  progressOf: (trackId: string) => number
  nextNodeOf: (trackId: string) => string | undefined
  dueCards: (trackId?: string) => string[]
  // действия
  completeLesson: (id: string, stats?: { firstTry: number; total: number }) => void
  completeLab: (labId: string, nodeId: string, xp: number, mistakes?: number) => void
  addXp: (n: number) => void
  rate: (cardId: string, r: Rating) => void
  addCards: (ids: string[]) => void
  addUserCard: (c: { front: string; back: string; trackId: string; nodeId: string | null }) => void
  deleteUserCard: (id: string) => void
  saveNote: (id: string, text: string) => void
  appendNote: (id: string, text: string) => void
  addFocus: (min: number) => void
  togglePlan: (id: string) => void
  enroll: (trackId: string) => void
  setActiveTrack: (trackId: string) => void
  toggleWish: (trackId: string) => void
  setSrs: (p: Partial<SrsSettings>) => void
  setPrefs: (p: Partial<Prefs>) => void
  setName: (n: string) => void
  exportJson: () => string
  reset: () => void
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

  const value = useMemo<Store>(() => {
    const now = Date.now()
    const today = dayKey(now)
    const allCards = [...BUILTIN_CARDS, ...state.userCards]
    const cardMap = new Map(allCards.map((c) => [c.id, c]))
    const cardDef = (id: string) => cardMap.get(id)
    const trackOfCard = (id: string) => cardMap.get(id)?.trackId

    const activeDays = new Set<string>([...state.reviewLog.map((l) => dayKey(l.at)), ...state.events.map((e) => dayKey(e.at))])
    let streak = 0
    for (let d = activeDays.has(today) ? 0 : 1; activeDays.has(dayKey(now - d * DAY)); d++) streak++

    const todayLog = state.reviewLog.filter((l) => dayKey(l.at) === today)
    const reviewsToday = todayLog.length
    const focusMinutes = state.events.filter((e) => e.type === 'focus' && dayKey(e.at) === today).reduce((a, e) => a + (e.minutes ?? 0), 0)

    const status = (id: string): NodeStatus => {
      if (state.lessonsDone.includes(id)) return 'done'
      const n = nodeById(id)
      if (!n) return 'locked'
      return n.requires.every((r) => state.lessonsDone.includes(r)) ? 'available' : 'locked'
    }
    const mastery = (id: string) => {
      const n = nodeById(id)
      if (!n) return 0
      let m = state.lessonsDone.includes(id) ? (n.lab ? 70 : 100) : 0
      if (n.lab && state.labsDone.includes(n.lab)) m += 30
      return m
    }
    const vitality = (nodeId: string) => {
      const rs = allCards.filter((c) => c.nodeId === nodeId && state.cards[c.id]?.lastReview).map((c) => currentRetrievability(state.cards[c.id], now, DEFAULT_W))
      return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null
    }
    const progressOf = (trackId: string) => {
      const t = trackById(trackId)
      if (!t || !t.nodes.length) return 0
      return Math.round((t.nodes.filter((n) => state.lessonsDone.includes(n.id)).length / t.nodes.length) * 100)
    }
    const nextNodeOf = (trackId: string) => trackById(trackId)?.nodes.find((n) => status(n.id) === 'available')?.id

    const dueCards = (trackId?: string) => {
      const introduced = todayLog.filter((l) => l.before === 'new').length
      const reviewed = todayLog.length - introduced
      const due = Object.entries(state.cards)
        .filter(([id, c]) => c.due <= now && cardMap.has(id) && (!trackId || trackOfCard(id) === trackId))
      const reviews = due.filter(([, c]) => c.status !== 'new').sort((a, b) => a[1].due - b[1].due).map(([id]) => id)
      const fresh = due.filter(([, c]) => c.status === 'new').map(([id]) => id)
      return [
        ...reviews.slice(0, Math.max(0, state.srs.reviewsPerDay - reviewed)),
        ...fresh.slice(0, Math.max(0, state.srs.newPerDay - introduced)),
      ]
    }

    const fsrsParams: FsrsParams = { w: DEFAULT_W, requestRetention: state.srs.requestRetention, maximumInterval: state.srs.maximumInterval }
    const level = 1 + Math.floor(state.xp / 250)

    return {
      ...state,
      streak, activeDays, reviewsToday, focusMinutes, level,
      levelProgress: Math.round(((state.xp % 250) / 250) * 100),
      trackProgress: progressOf(state.activeTrack),
      nextNode: nextNodeOf(state.activeTrack),
      fsrsParams, allCards, cardDef, trackOfCard, status, mastery, vitality, progressOf, nextNodeOf, dueCards,
      toast, notify,

      completeLesson: (id, stats) => setState((s) => {
        if (s.lessonsDone.includes(id)) return s
        const xp = nodeById(id)?.xp ?? 50
        return { ...s, lessonsDone: [...s.lessonsDone, id], xp: s.xp + xp, events: [...s.events, { type: 'lesson', ref: id, at: Date.now(), xp, ...stats }] }
      }),
      completeLab: (labId, _nodeId, xp, mistakes) => setState((s) => (
        s.labsDone.includes(labId) ? s : { ...s, labsDone: [...s.labsDone, labId], xp: s.xp + xp, events: [...s.events, { type: 'lab', ref: labId, at: Date.now(), xp, mistakes }] }
      )),
      addXp: (n) => setState((s) => ({ ...s, xp: s.xp + n })),
      rate: (cardId, g) => setState((s) => {
        const t = Date.now()
        const prev = s.cards[cardId] ?? newCard(t)
        const res = review(prev, g, t, { w: DEFAULT_W, requestRetention: s.srs.requestRetention, maximumInterval: s.srs.maximumInterval })
        const log: ReviewLog = { cardId, grade: g, at: t, t: prev.lastReview ? elapsedDays(prev.lastReview, t) : 0, r: res.retrievability, s: res.card.stability, d: res.card.difficulty, before: prev.status }
        return { ...s, cards: { ...s.cards, [cardId]: res.card }, reviewLog: [...s.reviewLog.slice(-4999), log], xp: s.xp + 5 }
      }),
      addCards: (ids) => setState((s) => {
        const cards = { ...s.cards }
        ids.forEach((id) => { if (!cards[id]) cards[id] = newCard(Date.now()) })
        return { ...s, cards }
      }),
      addUserCard: ({ front, back, trackId, nodeId }) => setState((s) => {
        const id = `u-${Date.now().toString(36)}`
        return {
          ...s,
          userCards: [...s.userCards, { id, front, back, trackId, nodeId, own: true }],
          cards: { ...s.cards, [id]: newCard(Date.now()) },
          events: [...s.events, { type: 'card', ref: id, at: Date.now(), xp: 0 }],
        }
      }),
      deleteUserCard: (id) => setState((s) => {
        const cards = { ...s.cards }
        delete cards[id]
        return { ...s, userCards: s.userCards.filter((c) => c.id !== id), cards }
      }),
      saveNote: (id, text) => setState((s) => ({ ...s, notes: { ...s.notes, [id]: text } })),
      appendNote: (id, text) => setState((s) => ({ ...s, notes: { ...s.notes, [id]: (s.notes[id] ? s.notes[id] + '\n\n' : '') + text } })),
      addFocus: (min) => setState((s) => ({ ...s, xp: s.xp + 20, events: [...s.events, { type: 'focus', ref: 'focus', at: Date.now(), xp: 20, minutes: min }] })),
      togglePlan: (id) => setState((s) => ({
        ...s,
        planDone: s.planDone.includes(id) ? s.planDone.filter((x) => x !== id) : [...s.planDone, id],
      })),
      enroll: (trackId) => setState((s) => (
        s.enrolled.includes(trackId) ? { ...s, activeTrack: trackId }
          : { ...s, enrolled: [...s.enrolled, trackId], activeTrack: trackId, events: [...s.events, { type: 'enroll', ref: trackId, at: Date.now(), xp: 0 }] }
      )),
      setActiveTrack: (trackId) => setState((s) => ({ ...s, activeTrack: trackId })),
      toggleWish: (trackId) => setState((s) => ({ ...s, wishlist: s.wishlist.includes(trackId) ? s.wishlist.filter((x) => x !== trackId) : [...s.wishlist, trackId] })),
      setSrs: (p) => setState((s) => ({ ...s, srs: { ...s.srs, ...p } })),
      setPrefs: (p) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
      setName: (n) => setState((s) => ({ ...s, name: n })),
      exportJson: () => JSON.stringify(state, null, 2),
      reset: () => setState(initialState()),
    }
  }, [state, toast, notify])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

/** Трек, в котором находится узел (для заголовков и ссылок). */
export const trackTitleOfNode = (nodeId: string) => trackOfNode(nodeId)?.title ?? ''
export const playableTracks = PLAYABLE
