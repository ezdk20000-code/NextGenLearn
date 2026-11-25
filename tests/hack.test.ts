import { describe, expect, it } from 'vitest'
import { assemble, newMachine, runUntilHalt, toBin, decode } from '../src/hack/hack'

const MULT = `@R2\nM=0\n(LOOP)\n@R1\nD=M\n@END\nD;JEQ\n@R0\nD=M\n@R2\nM=D+M\n@R1\nM=M-1\n@LOOP\n0;JMP\n(END)\n@END\n0;JMP`

describe('Ассемблер Hack', () => {
  it('кодирует инструкции по спецификации', () => {
    const r = assemble('@2\nM=0\nD=M\nD;JGT\nAM=M-1\n0;JMP\n@i\n@sum\n@i')
    expect(r.errors).toEqual([])
    expect(r.rom.map((x) => toBin(x.code))).toEqual([
      '0000000000000010', '1110101010001000', '1111110000010000', '1110001100000001', '1111110010101000', '1110101010000111',
      '0000000000010000', '0000000000010001', '0000000000010000',
    ])
  })
  it('метки и предопределённые символы', () => {
    const r = assemble('(START)\n@SCREEN\n@KBD\n@START\n@R15')
    expect(r.rom.map((x) => x.code)).toEqual([16384, 24576, 0, 15])
  })
  it('сообщает об ошибках', () => {
    expect(assemble('D=X+1').errors.length).toBe(1)
    expect(assemble('D;JXX').errors.length).toBe(1)
    expect(assemble('@40000').errors.length).toBe(1)
  })
  it('decode обратен кодированию', () => {
    const w = assemble('MD=D+1;JLT').rom[0].code
    expect(decode(w)).toEqual({ kind: 'C', comp: 'D+1', dest: 'DM', jump: 'JLT' })
  })
})

describe('Эмулятор Hack', () => {
  it('Mult считает произведение и останавливается', () => {
    const { rom } = assemble(MULT)
    for (const [a, b] of [[6, 7], [0, 5], [3, 0], [12, 11]]) {
      const m = newMachine(); m.ram[0] = a; m.ram[1] = b
      expect(runUntilHalt(m, rom)).toBe(true)
      expect(m.ram[2]).toBe(a * b)
    }
  })
  it('ловит бесконечный цикл без останова', () => {
    const m = newMachine()
    expect(runUntilHalt(m, assemble('(L)\n@L\nD=D+1\n0;JMP').rom, 1000)).toBe(false)
  })
})

import { M4 } from '../src/data/cs1/m4'
describe('Программы из уроков модуля 4', () => {
  it('сумма 1..n из урока считается верно', () => {
    const code = M4.lessons.flatMap((l) => l.blocks).find((b) => b.type === 'code' && b.title?.startsWith('sum')) as { code: string }
    const { rom, errors } = assemble(code.code)
    expect(errors).toEqual([])
    for (const n of [0, 1, 5, 10]) {
      const m = newMachine(); m.ram[0] = n
      expect(runUntilHalt(m, rom)).toBe(true)
      expect(m.ram[1]).toBe((n * (n + 1)) / 2)
    }
  })
})

import { HACK_TASKS } from '../src/hack/HackLab'
describe('Автотесты проекта 4', () => {
  const MULT_OK = `@R2\nM=0\n(LOOP)\n@R1\nD=M\n@END\nD;JEQ\n@R0\nD=M\n@R2\nM=D+M\n@R1\nM=M-1\n@LOOP\n0;JMP\n(END)\n@END\n0;JMP`
  const FILL_OK = `(MAIN)\n@KBD\nD=M\n@BLACK\nD;JNE\n@color\nM=0\n@PAINT\n0;JMP\n(BLACK)\n@color\nM=-1\n(PAINT)\n@SCREEN\nD=A\n@p\nM=D\n(LOOP)\n@p\nD=M\n@KBD\nD=D-A\n@MAIN\nD;JGE\n@color\nD=M\n@p\nA=M\nM=D\n@p\nM=M+1\n@LOOP\n0;JMP`
  it('принимают правильные решения', () => {
    expect(HACK_TASKS[0].check(assemble(MULT_OK).rom).ok).toBe(true)
    expect(HACK_TASKS[1].check(assemble(FILL_OK).rom).ok).toBe(true)
  })
  it('отвергают заготовки', () => {
    expect(HACK_TASKS[0].check(assemble(HACK_TASKS[0].start).rom).ok).toBe(false)
    expect(HACK_TASKS[1].check(assemble(HACK_TASKS[1].start).rom).ok).toBe(false)
  })
})
