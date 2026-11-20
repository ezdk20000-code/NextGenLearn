import { currentRetrievability, newCard, review, type FsrsCard, type FsrsParams } from './fsrs'

const DAY = 86_400_000

/** Детерминированный ГСЧ, чтобы график не «прыгал» при каждом рендере. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
}

export interface SimResult { perDay: number[]; avgPerDay: number; endRetention: number }

/**
 * Монте-Карло прогноз нагрузки: каждый день повторяем созревшие карточки;
 * ученик вспоминает карточку с вероятностью R (её текущая извлекаемость).
 * Забытая карточка повторяется ещё раз в тот же день.
 */
export function simulateWorkload(cards: FsrsCard[], params: FsrsParams, opts: { days: number; newPerDay: number; runs?: number; now?: number }): SimResult {
  const runs = opts.runs ?? 4
  const now = opts.now ?? Date.now()
  const perDay = Array(opts.days).fill(0)
  let retentionSum = 0
  for (let run = 0; run < runs; run++) {
    const rand = rng(1234 + run * 77)
    let deck = cards.map((c) => ({ ...c }))
    for (let d = 0; d < opts.days; d++) {
      const t = now + d * DAY + 10 * 3_600_000
      for (let k = 0; k < opts.newPerDay; k++) deck.push(newCard(t))
      deck = deck.map((c) => {
        if (c.due > t) return c
        let card = c
        const recalled = card.status === 'new' ? true : rand() < currentRetrievability(card, t)
        card = review(card, recalled ? 3 : 1, t, params).card
        perDay[d] += 1
        if (!recalled) { card = review(card, 3, t + 600_000, params).card; perDay[d] += 1 }
        return card
      })
    }
    const end = now + opts.days * DAY
    const learned = deck.filter((c) => c.lastReview)
    retentionSum += learned.length ? learned.reduce((a, c) => a + currentRetrievability(c, end), 0) / learned.length : 0
  }
  const avg = perDay.map((v) => v / runs)
  return { perDay: avg, avgPerDay: avg.reduce((a, b) => a + b, 0) / opts.days, endRetention: retentionSum / runs }
}
