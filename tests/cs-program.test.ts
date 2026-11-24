import { describe, expect, it } from 'vitest'
import { CS_PROGRAM, ENGINES, programStats } from '../src/data/cs-program'

const courses = CS_PROGRAM.courses
const modules = courses.flatMap((c) => c.modules)

describe('программа Computer Science: целостность', () => {
  it('id курсов и модулей уникальны', () => {
    const ids = [...courses.map((c) => c.id), ...modules.map((m) => m.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('предпосылки курса существуют и идут раньше него', () => {
    courses.forEach((c, i) => c.requires.forEach((r) => {
      const j = courses.findIndex((x) => x.id === r)
      expect(j, `${c.code} требует ${r}`).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThan(i)
    }))
  })
  it('каждый модуль полноценный: понятия, лаборатории, источники', () => {
    for (const m of modules) {
      expect(m.concepts.length, m.id).toBeGreaterThanOrEqual(4)
      expect(new Set(m.concepts).size, `${m.id}: повтор понятий`).toBe(m.concepts.length)
      expect(m.labs.length, `${m.id}: нет лабораторий`).toBeGreaterThanOrEqual(1)
      expect(m.sources.length, m.id).toBeGreaterThanOrEqual(1)
      for (const l of m.labs) expect(ENGINES[l.engine], `${m.id}: движок ${l.engine}`).toBeDefined()
    }
  })
  it('обновления «было → стало» заполнены', () => {
    for (const m of modules) for (const e of m.evolution) {
      expect(e.topic.length).toBeGreaterThan(2)
      expect(e.was.length).toBeGreaterThan(10)
      expect(e.now.length).toBeGreaterThan(10)
    }
  })
  it('масштаб программы', () => {
    const s = programStats()
    expect(s.courses).toBe(7)
    expect(s.modules).toBeGreaterThanOrEqual(60)
    expect(s.concepts).toBeGreaterThanOrEqual(500)
    console.log(s)
  })
})
