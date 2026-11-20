import { describe, expect, it } from 'vitest'
import { DEFAULT_W, forgetStability, initDifficulty, newCard, nextDifficulty, nextInterval, preview, retrievability, review } from '../src/lib/fsrs'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 0, 1)

describe('FSRS-4.5', () => {
  it('R падает до 90% ровно через S дней', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6)
    expect(retrievability(0, 10)).toBe(1)
    expect(retrievability(100, 10)).toBeLessThan(0.7)
  })

  it('при удержании 90% интервал равен стабильности', () => {
    expect(nextInterval(10)).toBe(10)
    expect(nextInterval(3.7145)).toBe(4)
    expect(nextInterval(10, { w: DEFAULT_W, requestRetention: 0.8, maximumInterval: 36500 })).toBeGreaterThan(10)
  })

  it('первая оценка задаёт S и D из весов', () => {
    const c = newCard(T0)
    expect(review(c, 3, T0).card.stability).toBeCloseTo(3.7145)
    expect(review(c, 4, T0).card.stability).toBeCloseTo(13.8206)
    expect(review(c, 3, T0).card.difficulty).toBeCloseTo(5.1618)
    expect(initDifficulty(4)).toBeLessThan(initDifficulty(1))
  })

  it('успешное повторение в срок увеличивает S: Легко > Хорошо > Трудно', () => {
    const first = review(newCard(T0), 3, T0).card
    const at = first.due
    const p = preview(first, at)
    expect(p[2].card.stability).toBeGreaterThan(first.stability)
    expect(p[3].card.stability).toBeGreaterThan(p[2].card.stability)
    expect(p[4].card.stability).toBeGreaterThan(p[3].card.stability)
    expect(p[3].retrievability).toBeCloseTo(0.9, 1)
  })

  it('повтор сразу же почти не растит S (нет награды за зубрёжку)', () => {
    const first = review(newCard(T0), 3, T0).card
    const instant = review(first, 3, T0 + 60_000).card
    expect(instant.stability / first.stability).toBeLessThan(1.01)
  })

  it('рост S замедляется у очень стабильных карточек (нет взрыва)', () => {
    let c = review(newCard(T0), 3, T0).card
    const ratios: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = review(c, 3, c.due)
      ratios.push(res.card.stability / c.stability)
      expect(res.intervalDays).toBeLessThanOrEqual(36500)
      c = res.card
    }
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeLessThan(ratios[i - 1])
    expect(Number.isFinite(c.stability)).toBe(true)
  })

  it('забывание уменьшает S, считает lapse и возвращает карточку через минуту', () => {
    const c = review(review(newCard(T0), 3, T0).card, 3, T0 + 4 * DAY).card
    const t = c.due + 30 * DAY
    const res = review(c, 1, t)
    expect(res.card.stability).toBeLessThan(c.stability)
    expect(res.card.lapses).toBe(1)
    expect(res.card.status).toBe('relearning')
    expect(res.card.due - t).toBe(60_000)
    expect(forgetStability(5, 10, 0.9)).toBeLessThanOrEqual(10)
  })

  it('сложность растёт от «Снова», падает от «Легко» и остаётся в 1..10', () => {
    expect(nextDifficulty(5, 1)).toBeGreaterThan(5)
    expect(nextDifficulty(5, 4)).toBeLessThan(5)
    let d = 5
    for (let i = 0; i < 50; i++) d = nextDifficulty(d, 1)
    expect(d).toBeLessThanOrEqual(10)
  })
})
