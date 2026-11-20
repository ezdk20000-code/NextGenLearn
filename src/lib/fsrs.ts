/**
 * FSRS-6 — алгоритм интервального повторения (Free Spaced Repetition Scheduler).
 * Формулы и веса по умолчанию совпадают с официальной реализацией ts-fsrs 5.x
 * (open-spaced-repetition); совпадение проверяется в tests/fsrs.test.ts.
 * Чистые функции без зависимостей: один модуль для фронтенда и бэкенда.
 *
 * Обозначения:
 *   S — стабильность, дни: через S дней вероятность вспомнить падает до 90%
 *   D — сложность карточки, 1..10
 *   R — извлекаемость: вероятность вспомнить прямо сейчас, 0..1
 *   G — оценка: 1 Снова, 2 Трудно, 3 Хорошо, 4 Легко
 *   t — сколько календарных дней прошло с прошлого повторения
 *
 * Что нового по сравнению с FSRS-4.5:
 *   • форма кривой забывания (w20) обучаемая — у кого-то память «тает» круче, у кого-то положе;
 *   • повторение в тот же день считается отдельной формулой (w17–w19): зубрёжка подряд почти не растит S;
 *   • сложность меняется с затуханием у потолка (D ближе к 10 — растёт медленнее);
 *   • после забывания S не может стать больше, чем S / e^(w17·w18).
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

/** 21 вес FSRS-6 по умолчанию (обучены на большом наборе реальных повторений). */
export const DEFAULT_W: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, // w0–w3: начальная S для оценок 1–4
  6.4133, 0.8334, // w4–w5: начальная сложность
  3.0194, 0.001, // w6: шаг сложности, w7: возврат к среднему
  1.8722, 0.1666, 0.796, // w8–w10: рост S после успешного вспоминания
  1.4835, 0.0614, 0.2629, 1.6483, // w11–w14: S после забывания
  0.6014, 1.8729, // w15: штраф «Трудно», w16: бонус «Легко»
  0.5425, 0.0912, 0.0658, // w17–w19: повторение в тот же день
  0.1542, // w20: форма кривой забывания
]

export const S_MIN = 0.001
export const S_MAX = 36500
const DAY = 86_400_000

export interface FsrsParams {
  w: readonly number[]
  requestRetention: number // целевое удержание, обычно 0.9
  maximumInterval: number // дни
}

export const DEFAULT_PARAMS: FsrsParams = { w: DEFAULT_W, requestRetention: 0.9, maximumInterval: 36500 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round8 = (v: number) => Math.round(v * 1e8) / 1e8

export function newCard(now: number): FsrsCard {
  return { stability: 0, difficulty: 0, status: 'new', reps: 0, lapses: 0, lastReview: null, due: now }
}

/** Календарные дни между датами (как в эталоне). На сервере передавать время в поясе ученика. */
export function elapsedDays(from: number, to: number): number {
  const a = new Date(from), b = new Date(to)
  const d1 = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())
  const d2 = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  return Math.max(0, Math.round((d2 - d1) / DAY))
}

/** DECAY и FACTOR подобраны так, что R(t = S) = 0.9 при любой форме кривой. */
export function decayFactor(w: readonly number[] = DEFAULT_W) {
  const decay = -w[20]
  const factor = round8(Math.pow(0.9, 1 / decay) - 1)
  return { decay, factor }
}

/** Кривая забывания: R(t, S) = (1 + FACTOR · t / S)^DECAY */
export function retrievability(t: number, stability: number, w: readonly number[] = DEFAULT_W): number {
  if (stability <= 0) return 0
  const { decay, factor } = decayFactor(w)
  return round8(Math.pow(1 + (factor * Math.max(0, t)) / stability, decay))
}

/** Через сколько дней R упадёт до целевого удержания. При удержании 90% интервал = S. */
export function nextInterval(stability: number, p: FsrsParams = DEFAULT_PARAMS): number {
  const { decay, factor } = decayFactor(p.w)
  const modifier = round8((Math.pow(p.requestRetention, 1 / decay) - 1) / factor)
  return clamp(Math.round(stability * modifier), 1, p.maximumInterval)
}

export function initStability(g: Grade, w: readonly number[] = DEFAULT_W): number {
  return Math.max(w[g - 1], 0.1)
}

/** D0(G) = w4 − e^(w5·(G−1)) + 1 */
export function initDifficulty(g: Grade, w: readonly number[] = DEFAULT_W): number {
  return round8(w[4] - Math.exp((g - 1) * w[5]) + 1)
}

/** Сдвиг сложности с затуханием у потолка и лёгким возвратом к сложности «Легко». */
export function nextDifficulty(d: number, g: Grade, w: readonly number[] = DEFAULT_W): number {
  const delta = -w[6] * (g - 3)
  const damped = d + round8((delta * (10 - d)) / 9)
  return clamp(round8(w[7] * initDifficulty(4, w) + (1 - w[7]) * damped), 1, 10)
}

/** Стабильность после успешного вспоминания в другой день (G ≥ 2). */
export function recallStability(d: number, s: number, r: number, g: Grade, w: readonly number[] = DEFAULT_W): number {
  const hardPenalty = g === 2 ? w[15] : 1
  const easyBonus = g === 4 ? w[16] : 1
  const grown = s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus)
  return round8(clamp(grown, S_MIN, S_MAX))
}

/** Стабильность после забывания (G = 1): не больше, чем S / e^(w17·w18). */
export function forgetStability(d: number, s: number, r: number, w: readonly number[] = DEFAULT_W): number {
  const sf = round8(clamp(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), S_MIN, S_MAX))
  const cap = round8(s / Math.exp(w[17] * w[18]))
  return clamp(cap, S_MIN, sf)
}

/** Повторение в тот же день: S растёт слабо, а «Снова» её снижает. */
export function shortTermStability(s: number, g: Grade, w: readonly number[] = DEFAULT_W): number {
  const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]))
  const masked = g >= 2 ? Math.max(sinc, 1) : sinc
  return round8(clamp(s * masked, S_MIN, S_MAX))
}

/** Новое состояние памяти (S, D) после оценки. t — прошедшие календарные дни. */
export function nextMemoryState(state: { stability: number; difficulty: number } | null, t: number, g: Grade, w: readonly number[] = DEFAULT_W) {
  if (!state || (state.stability === 0 && state.difficulty === 0)) {
    return { stability: initStability(g, w), difficulty: clamp(initDifficulty(g, w), 1, 10), r: 1 }
  }
  const { stability: s, difficulty: d } = state
  const r = retrievability(t, s, w)
  let ns: number
  if (t === 0) ns = shortTermStability(s, g, w)
  else if (g === 1) ns = forgetStability(d, s, r, w)
  else ns = recallStability(d, s, r, g, w)
  return { stability: ns, difficulty: nextDifficulty(d, g, w), r }
}

export interface ReviewResult { card: FsrsCard; retrievability: number; intervalDays: number }

/** Главная функция: применить оценку к карточке. */
export function review(card: FsrsCard, g: Grade, now: number, p: FsrsParams = DEFAULT_PARAMS): ReviewResult {
  const isNew = card.status === 'new' || card.lastReview === null
  const t = isNew ? 0 : elapsedDays(card.lastReview!, now)
  const { stability, difficulty, r } = nextMemoryState(isNew ? null : card, t, g, p.w)

  // «Снова» — карточка возвращается в эту же сессию через минуту
  const intervalDays = g === 1 ? 0 : nextInterval(stability, p)
  const due = g === 1 ? now + 60_000 : now + intervalDays * DAY
  const status: CardStatus = g === 1 ? (isNew || card.status === 'learning' ? 'learning' : 'relearning') : 'review'
  const lapses = card.lapses + (g === 1 && !isNew && card.status === 'review' ? 1 : 0)

  return {
    card: { stability, difficulty, status, reps: card.reps + 1, lapses, lastReview: now, due },
    retrievability: r,
    intervalDays,
  }
}

/** Предпросмотр всех четырёх кнопок. */
export function preview(card: FsrsCard, now: number, p: FsrsParams = DEFAULT_PARAMS): Record<Grade, ReviewResult> {
  return { 1: review(card, 1, now, p), 2: review(card, 2, now, p), 3: review(card, 3, now, p), 4: review(card, 4, now, p) }
}

/** Текущая R карточки — для «витальности» узлов графа. */
export function currentRetrievability(card: FsrsCard, now: number, w: readonly number[] = DEFAULT_W): number {
  if (card.lastReview === null || card.stability <= 0) return 0
  return retrievability(elapsedDays(card.lastReview, now), card.stability, w)
}
