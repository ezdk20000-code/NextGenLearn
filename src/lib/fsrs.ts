/**
 * FSRS-4.5 — алгоритм интервального повторения (Free Spaced Repetition Scheduler).
 * Формулы и веса по умолчанию — из эталонной реализации open-spaced-repetition (FSRS v4.5).
 * Чистые функции без зависимостей: один и тот же модуль работает во фронтенде и на бэкенде.
 *
 * Обозначения:
 *   S — стабильность, дни: через S дней вероятность вспомнить падает до 90%
 *   D — сложность карточки, 1..10
 *   R — извлекаемость: вероятность вспомнить прямо сейчас, 0..1
 *   G — оценка: 1 Снова, 2 Трудно, 3 Хорошо, 4 Легко
 */

export type Grade = 1 | 2 | 3 | 4
export type CardStatus = 'new' | 'learning' | 'review' | 'relearning'

export interface FsrsCard {
  stability: number
  difficulty: number
  status: CardStatus
  reps: number
  lapses: number
  lastReview: number | null // мс с эпохи
  due: number // мс с эпохи
}

export const DEFAULT_W: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
]

export const DECAY = -0.5
export const FACTOR = 19 / 81 // при t = S даёт R = 0.9
const DAY = 86_400_000
const MIN_S = 0.1

export interface FsrsParams {
  w: readonly number[]
  requestRetention: number // целевое удержание, обычно 0.9
  maximumInterval: number // дни
}

export const DEFAULT_PARAMS: FsrsParams = { w: DEFAULT_W, requestRetention: 0.9, maximumInterval: 36500 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function newCard(now: number): FsrsCard {
  return { stability: 0, difficulty: 0, status: 'new', reps: 0, lapses: 0, lastReview: null, due: now }
}

/** R(t, S) = (1 + FACTOR · t / S)^DECAY */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY)
}

/** Интервал (дни), через который R упадёт до целевого удержания. */
export function nextInterval(stability: number, p: FsrsParams = DEFAULT_PARAMS): number {
  const days = (stability / FACTOR) * (Math.pow(p.requestRetention, 1 / DECAY) - 1)
  return clamp(Math.round(days), 1, p.maximumInterval)
}

export function initStability(g: Grade, w = DEFAULT_W): number {
  return Math.max(w[g - 1], MIN_S)
}

export function initDifficulty(g: Grade, w = DEFAULT_W): number {
  return clamp(w[4] - (g - 3) * w[5], 1, 10)
}

/** D' = w7·D0(3) + (1 − w7)·(D − w6·(G − 3)) — сдвиг с возвратом к среднему */
export function nextDifficulty(d: number, g: Grade, w = DEFAULT_W): number {
  const shifted = d - w[6] * (g - 3)
  return clamp(w[7] * initDifficulty(3, w) + (1 - w[7]) * shifted, 1, 10)
}

/** Стабильность после успешного вспоминания (G ≥ 2). */
export function recallStability(d: number, s: number, r: number, g: Grade, w = DEFAULT_W): number {
  const hardPenalty = g === 2 ? w[15] : 1
  const easyBonus = g === 4 ? w[16] : 1
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hardPenalty * easyBonus)
}

/** Стабильность после забывания (G = 1). Никогда не больше прежней. */
export function forgetStability(d: number, s: number, r: number, w = DEFAULT_W): number {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))
  return clamp(sf, MIN_S, s)
}

export interface ReviewResult { card: FsrsCard; retrievability: number; intervalDays: number }

/** Главная функция: применить оценку к карточке. */
export function review(card: FsrsCard, g: Grade, now: number, p: FsrsParams = DEFAULT_PARAMS): ReviewResult {
  const w = p.w
  let s: number, d: number, r: number
  let lapses = card.lapses

  if (card.status === 'new' || card.lastReview === null) {
    s = initStability(g, w)
    d = initDifficulty(g, w)
    r = 1
    if (g === 1) lapses += 1
  } else {
    const elapsed = (now - card.lastReview) / DAY
    r = retrievability(elapsed, card.stability)
    d = nextDifficulty(card.difficulty, g, w)
    if (g === 1) {
      s = forgetStability(d, card.stability, r, w)
      lapses += 1
    } else {
      s = recallStability(d, card.stability, r, g, w)
    }
  }

  // «Снова» — карточка возвращается в ту же сессию через 1 минуту (кратковременное переучивание)
  const intervalDays = g === 1 ? 0 : nextInterval(s, p)
  const due = g === 1 ? now + 60_000 : now + intervalDays * DAY
  const status: CardStatus = g === 1 ? (card.status === 'new' ? 'learning' : 'relearning') : 'review'

  return {
    card: { stability: s, difficulty: d, status, reps: card.reps + 1, lapses, lastReview: now, due },
    retrievability: r,
    intervalDays,
  }
}

/** Предпросмотр интервалов для четырёх кнопок. */
export function preview(card: FsrsCard, now: number, p: FsrsParams = DEFAULT_PARAMS): Record<Grade, ReviewResult> {
  return { 1: review(card, 1, now, p), 2: review(card, 2, now, p), 3: review(card, 3, now, p), 4: review(card, 4, now, p) }
}

/** Текущая R карточки — для «витальности» узлов графа. */
export function currentRetrievability(card: FsrsCard, now: number): number {
  if (card.lastReview === null || card.stability <= 0) return 0
  return retrievability((now - card.lastReview) / DAY, card.stability)
}
