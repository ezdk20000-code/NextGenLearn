import { describe, expect, it } from 'vitest'
import { FSRSAlgorithm, generatorParameters } from 'ts-fsrs'
import {
  DEFAULT_W, elapsedDays, forgetStability, initDifficulty, initStability, newCard, nextDifficulty,
  nextInterval, nextMemoryState, preview, retrievability, review, type Grade,
} from '../src/lib/fsrs'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 0, 1, 9)

// Эталон: официальная реализация open-spaced-repetition
const ref = new FSRSAlgorithm(generatorParameters({ enable_fuzz: false, enable_short_term: true }))

describe('FSRS-6: совпадение с официальной реализацией ts-fsrs', () => {
  it('веса по умолчанию те же', () => {
    expect([...ref.parameters.w]).toEqual([...DEFAULT_W])
  })

  it('кривая забывания и интервалы', () => {
    for (const s of [0.1, 0.5, 1, 2.3, 8, 30, 365, 3000]) {
      for (const t of [0, 1, 3, 10, 100, 1000]) expect(retrievability(t, s)).toBe(ref.forgetting_curve(t, s))
      expect(nextInterval(s)).toBe(ref.next_interval(s, 0))
    }
  })

  it('начальные S и D для каждой оценки', () => {
    for (const g of [1, 2, 3, 4] as Grade[]) {
      expect(initStability(g)).toBe(ref.init_stability(g))
      expect(initDifficulty(g)).toBe(ref.init_difficulty(g))
    }
  })

  it('5000 случайных переходов состояния памяти совпадают до 1e-8', () => {
    let seed = 42
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32)
    for (let i = 0; i < 5000; i++) {
      const state = { stability: 0.05 + rnd() * 400, difficulty: 1 + rnd() * 9 }
      const t = rnd() < 0.15 ? 0 : Math.floor(rnd() * 500)
      const g = (1 + Math.floor(rnd() * 4)) as Grade
      const mine = nextMemoryState(state, t, g)
      const theirs = ref.next_state(state, t, g)
      expect(mine.stability).toBeCloseTo(theirs.stability, 8)
      expect(mine.difficulty).toBeCloseTo(theirs.difficulty, 8)
    }
  })
})

describe('FSRS-6: поведение', () => {
  it('R падает до 90% ровно через S дней', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6)
    expect(retrievability(0, 10)).toBe(1)
    expect(retrievability(100, 10)).toBeLessThan(0.75)
  })

  it('новая карточка: «Хорошо» → 2 дня, «Легко» → 8 дней, «Снова» → через минуту', () => {
    const p = preview(newCard(T0), T0)
    expect(p[3].intervalDays).toBe(2)
    expect(p[4].intervalDays).toBe(8)
    expect(p[1].card.due - T0).toBe(60_000)
    expect(p[1].card.status).toBe('learning')
  })

  it('успешное повторение в срок: Легко > Хорошо > Трудно > прежняя S', () => {
    const first = review(newCard(T0), 3, T0).card
    const p = preview(first, first.due)
    expect(p[2].card.stability).toBeGreaterThan(first.stability)
    expect(p[3].card.stability).toBeGreaterThan(p[2].card.stability)
    expect(p[4].card.stability).toBeGreaterThan(p[3].card.stability)
    expect(p[3].retrievability).toBeCloseTo(0.9, 1)
  })

  it('повтор в тот же день почти не растит S (зубрёжка не вознаграждается)', () => {
    const first = review(newCard(T0), 3, T0).card
    const again = review(first, 3, T0 + 5 * 60_000).card
    expect(again.stability / first.stability).toBeLessThan(1.3)
  })

  it('рост S замедляется у стабильных карточек, интервал не выше лимита', () => {
    let c = review(newCard(T0), 3, T0).card
    const ratios: number[] = []
    for (let i = 0; i < 10; i++) {
      const res = review(c, 3, c.due)
      ratios.push(res.card.stability / c.stability)
      expect(res.intervalDays).toBeLessThanOrEqual(36500)
      c = res.card
    }
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeLessThan(ratios[i - 1])
  })

  it('забывание выученной карточки: S падает, lapse засчитан, возврат через минуту', () => {
    const c = review(review(newCard(T0), 3, T0).card, 3, T0 + 2 * DAY).card
    const t = c.due + 30 * DAY
    const res = review(c, 1, t)
    expect(res.card.stability).toBeLessThan(c.stability)
    expect(res.card.lapses).toBe(1)
    expect(res.card.status).toBe('relearning')
    expect(res.card.due - t).toBe(60_000)
    expect(forgetStability(5, 10, 0.9)).toBeLessThanOrEqual(10)
  })

  it('сложность: «Снова» повышает, «Легко» снижает, всегда в 1..10', () => {
    expect(nextDifficulty(5, 1)).toBeGreaterThan(5)
    expect(nextDifficulty(5, 4)).toBeLessThan(5)
    let d = 5
    for (let i = 0; i < 50; i++) d = nextDifficulty(d, 1)
    expect(d).toBeLessThanOrEqual(10)
  })

  it('дни считаются календарно', () => {
    expect(elapsedDays(Date.UTC(2026, 0, 1, 23), Date.UTC(2026, 0, 2, 1))).toBe(1)
    expect(elapsedDays(Date.UTC(2026, 0, 1, 1), Date.UTC(2026, 0, 1, 23))).toBe(0)
  })
})
