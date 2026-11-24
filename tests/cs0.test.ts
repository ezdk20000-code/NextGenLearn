import { describe, expect, it } from 'vitest'
import { CS0_MODULES, CS0_TRACK } from '../src/data/cs0'
import { CS_PROGRAM } from '../src/data/cs-program'
import { parse, run } from '../src/labs/cpu'
import { combos, evaluate } from '../src/labs/logic'

const course = CS_PROGRAM.courses.find((c) => c.id === 'cs0-code')!

describe('CS0: курс полностью написан по программе', () => {
  it('у каждого модуля программы есть модуль уроков', () => {
    expect(CS0_MODULES.map((m) => m.id)).toEqual(course.modules.map((m) => m.id))
  })

  it('уроки модуля закрывают все его понятия, и только их', () => {
    for (const plan of course.modules) {
      const mod = CS0_MODULES.find((m) => m.id === plan.id)!
      const covered = mod.lessons.flatMap((l) => l.covers)
      expect(new Set(covered).size, `${plan.id}: дубли`).toBe(covered.length)
      expect([...covered].sort(), plan.id).toEqual([...plan.concepts].sort())
    }
  })

  it('у каждого модуля есть экзамен в конце, у каждого урока — источник в книгах', () => {
    for (const m of CS0_MODULES) {
      expect(m.lessons[m.lessons.length - 1].exam, m.id).toBe(true)
      m.lessons.filter((l) => !l.exam).forEach((l) => expect(l.sources.length, l.id).toBeGreaterThan(0))
    }
  })

  it('все лаборатории из программы реализованы и привязаны к урокам', () => {
    const planned = course.modules.reduce((a, m) => a + m.labs.length, 0)
    expect(CS0_TRACK.labs.length).toBe(planned)
    CS0_TRACK.labs.forEach((l) => expect(CS0_TRACK.lessons[l.nodeId], l.id).toBeTruthy())
  })

  it('задания уроков корректны', () => {
    for (const l of Object.values(CS0_TRACK.lessons)) {
      for (const b of l.blocks) {
        if (b.type === 'quiz') { expect(b.correct).toBeLessThan(b.options.length); expect(new Set(b.options).size).toBe(b.options.length) }
        if (b.type === 'truth') expect(b.values.length, `${l.nodeId}: ${b.q}`).toBe(2 ** b.inputs.length)
        if (b.type === 'order') expect(new Set(b.items).size).toBe(b.items.length)
        if (b.type === 'numeric') expect(b.answer.trim().length).toBeGreaterThan(0)
      }
      const ids = new Set(CS0_TRACK.cards.map((c) => c.id))
      l.cardIds.forEach((c) => expect(ids.has(c)).toBe(true))
    }
  })

  it('урок без экзамена — не меньше 3 проверок и обновление знаний там, где оно запланировано', () => {
    for (const m of CS0_MODULES) {
      const plan = course.modules.find((p) => p.id === m.id)!
      const evo = m.lessons.flatMap((l) => l.blocks.filter((b) => b.type === 'evolution').map((b) => (b as { topic: string }).topic))
      plan.evolution.forEach((e) => expect(evo, `${m.id}: ${e.topic}`).toContain(e.topic))
      m.lessons.filter((l) => !l.exam).forEach((l) => expect(l.blocks.filter((b) => ['quiz', 'numeric', 'truth', 'order', 'feynman'].includes(b.type)).length, l.id).toBeGreaterThanOrEqual(3))
    }
  })

  it('таблицы истинности XOR и NAND в уроках совпадают с движком схем', () => {
    const nand = combos(['A', 'B']).map((r) => evaluate(r, [{ id: 'g1', type: 'NAND', a: 'A', b: 'B' }]).g1)
    const xor = combos(['A', 'B']).map((r) => evaluate(r, [{ id: 'g1', type: 'XOR', a: 'A', b: 'B' }]).g1)
    const blocks = Object.values(CS0_TRACK.lessons).flatMap((l) => l.blocks)
    const find = (o: string) => blocks.find((b) => b.type === 'truth' && b.output === o) as { values: number[] }
    expect(find('NAND').values).toEqual(nand)
    expect(find('XOR').values).toEqual(xor)
  })
})

describe('Эмулятор процессора', () => {
  it('программа умножения из урока работает', () => {
    const src = (CS0_TRACK.lessons['cs0-jumps'].blocks.find((b) => b.type === 'code') as { code: string }).code
      .split('\n').map((l) => l.replace(/^\d+\s+/, '')).join('\n')
    const { prog, errors } = parse(src)
    expect(errors).toEqual([])
    for (const [a, b] of [[3, 4], [7, 0], [0, 9], [12, 12]]) expect(run(prog, [a, b]).mem[2]).toBe(a * b)
  })
  it('бесконечный цикл ловится', () => {
    expect(run(parse('JMP 0').prog, []).error).toBeTruthy()
  })
  it('обратный отсчёт из экзамена выводит 3, 2, 1', () => {
    const p = parse('OUT\nADDI -1\nJNZ 0\nHALT').prog
    const s0 = run(parse('LOADI 3\nJMP 2\nHALT').prog, [])
    expect(s0.halted).toBe(true)
    expect(run(parse('LOADI 3\nOUT\nADDI -1\nJNZ 1\nHALT').prog, []).out).toEqual([3, 2, 1])
    expect(p.length).toBe(4)
  })
})
