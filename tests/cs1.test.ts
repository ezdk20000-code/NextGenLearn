import { describe, expect, it } from 'vitest'
import { CS1_MODULES, CS1_TRACK } from '../src/data/cs1'
import { CS_PROGRAM } from '../src/data/cs-program'
import { BUILDABLE } from '../src/hdl/chips'
import { HINTS } from '../src/hdl/HdlLab'

const course = CS_PROGRAM.courses.find((c) => c.id === 'cs1-nand2tetris')!

describe('CS1: написанные модули соответствуют программе', () => {
  it('модули идут по порядку программы', () => {
    expect(CS1_MODULES.map((m) => m.id)).toEqual(course.modules.slice(0, CS1_MODULES.length).map((m) => m.id))
  })
  it('уроки закрывают все понятия модуля', () => {
    for (const m of CS1_MODULES) {
      const plan = course.modules.find((p) => p.id === m.id)!
      expect(m.lessons.flatMap((l) => l.covers).sort(), m.id).toEqual([...plan.concepts].sort())
      expect(m.lessons[m.lessons.length - 1].exam).toBe(true)
      plan.evolution.forEach((e) => expect(m.lessons.flatMap((l) => l.blocks).some((b) => b.type === 'evolution' && b.topic === e.topic), e.topic).toBe(true))
    }
  })
  it('у каждого модуля есть свой проект-лаборатория', () => {
    for (const m of CS1_MODULES) {
      const plan = course.modules.find((p) => p.id === m.id)!
      const labs = CS1_TRACK.labs.filter((l) => m.lessons.some((x) => x.id === l.nodeId))
      expect(labs.length, m.id).toBe(plan.labs.length)
    }
  })
  it('задания корректны', () => {
    for (const l of Object.values(CS1_TRACK.lessons)) for (const b of l.blocks) {
      if (b.type === 'quiz') expect(b.correct).toBeLessThan(b.options.length)
      if (b.type === 'truth') expect(b.values.length).toBe(2 ** b.inputs.length)
    }
  })
  it('у каждого чипа есть подсказка', () => {
    BUILDABLE.forEach((c) => expect(HINTS[c.name], c.name).toBeTruthy())
  })
})
