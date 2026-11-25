// Автотесты чипов: схема ученика и эталон получают одинаковые входы,
// выходы сравниваются после каждого пересчёта и каждого такта.

import { isSequential, type ChipSpec, type ChipState } from './chips'
import type { Circuit } from './hdl'

export interface TestRow { step: string; inputs: Record<string, number>; want: Record<string, number>; got: Record<string, number>; ok: boolean }
export interface TestResult { rows: TestRow[]; passed: number; total: number; firstFail?: TestRow }

function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff } }
const EDGE = [0, 0xffff, 1, 0x8000, 0x7fff, 0x5555, 0xaaaa, 0x00ff, 0xff00, 17, 0xfffe]

/** Наборы входов: полный перебор для малых чипов, иначе граничные + случайные значения. */
function vectors(spec: ChipSpec): Record<string, number>[] {
  const bits = spec.inputs.reduce((a, p) => a + p.width, 0)
  if (bits <= 8) {
    return Array.from({ length: 2 ** bits }, (_, n) => {
      const v: Record<string, number> = {}
      let off = bits
      for (const p of spec.inputs) { off -= p.width; v[p.name] = (n >> off) & ((1 << p.width) - 1) }
      return v
    })
  }
  const r = rng(spec.name.length * 7919 + bits)
  const out: Record<string, number>[] = []
  if (spec.name === 'ALU') {
    // 18 функций АЛУ Hack (zx nx zy ny f no) на нескольких парах x, y
    const FN = ['101010', '111111', '111010', '001100', '110000', '001101', '110001', '001111', '110011', '011111', '110111', '001110', '110010', '000010', '010011', '000111', '000000', '010101']
    const XY = [[0, 0xffff], [17, 3], [0xfff5, 23], [0x7fff, 1]]
    for (const [x, y] of XY) for (const f of FN) out.push({ x, y, zx: +f[0], nx: +f[1], zy: +f[2], ny: +f[3], f: +f[4], no: +f[5] })
    return out
  }
  for (let n = 0; n < 48; n++) {
    const v: Record<string, number> = {}
    for (const p of spec.inputs) {
      const m = (1 << p.width) - 1
      v[p.name] = p.width >= 16 ? (n < EDGE.length ? EDGE[(n + p.name.length) % EDGE.length] : Math.floor(r() * 0x10000)) & m : Math.floor(r() * (m + 1))
    }
    out.push(v)
  }
  return out
}

const COMPS = ['101010', '111111', '111010', '001100', '110000', '001101', '110001', '001111', '110011', '011111', '110111', '001110', '110010', '000010', '010011', '000111', '000000', '010101']

/** Случайная, но осмысленная программа для CPU: A- и C-инструкции всех видов. */
function cpuSequence(): Record<string, number>[] {
  const r = rng(424242)
  const steps: Record<string, number>[] = [{ inM: 0, instruction: 0, reset: 1 }]
  for (let n = 0; n < 120; n++) {
    let w: number
    if (r() < 0.35) w = Math.floor(r() * 0x8000)
    else {
      const a = r() < 0.5 ? 1 : 0
      const c = parseInt(COMPS[Math.floor(r() * COMPS.length)], 2)
      const d = Math.floor(r() * 8)
      const j = r() < 0.6 ? 0 : Math.floor(r() * 8)
      w = 0xe000 | (a << 12) | (c << 6) | (d << 3) | j
    }
    steps.push({ inM: n < EDGE.length ? EDGE[n] : Math.floor(r() * 0x10000), instruction: w, reset: r() < 0.03 ? 1 : 0 })
  }
  return steps
}

/** Сценарий для чипов с памятью: случайные записи и чтения с тактами. */
function sequence(spec: ChipSpec): Record<string, number>[] {
  if (spec.name === 'CPU') return cpuSequence()
  const r = rng(spec.name.length * 104729 + 3)
  const addr = spec.inputs.find((p) => p.name === 'address')
  const used: number[] = []
  const steps: Record<string, number>[] = []
  for (let n = 0; n < 40; n++) {
    const v: Record<string, number> = {}
    for (const p of spec.inputs) {
      if (p.name === 'load') v.load = r() < 0.45 ? 1 : 0
      else if (p.name === 'reset') v.reset = r() < 0.12 ? 1 : 0
      else if (p.name === 'inc') v.inc = r() < 0.6 ? 1 : 0
      else if (p === addr) {
        const m = (1 << p.width) - 1
        const fresh = spec.name === 'Memory' ? [Math.floor(r() * 16384), 16384 + Math.floor(r() * 8192), 24576][Math.floor(r() * 3)] : Math.floor(r() * (m + 1))
        const a = used.length && r() < 0.5 ? used[Math.floor(r() * used.length)] : fresh
        used.push(a); v.address = a
      } else v[p.name] = p.width === 1 ? (r() < 0.5 ? 1 : 0) : n < EDGE.length ? EDGE[n] : Math.floor(r() * 0x10000)
    }
    steps.push(v)
  }
  return steps
}

/** 16-битные значения показываем со знаком, как в книге. */
export const show = (x: number, w: number) => String(w >= 16 && x >= 0x8000 ? x - 0x10000 : x)

export function runTests(spec: ChipSpec, c: Circuit): TestResult {
  if (spec.name === 'Computer') return computerTests(c)
  const rows: TestRow[] = []
  const pick = (o: Record<string, number>) => Object.fromEntries(spec.outputs.map((p) => [p.name, o[p.name] >>> 0]))
  const same = (want: Record<string, number>, got: Record<string, number>) => (spec.relevant?.(want) ?? spec.outputs.map((p) => p.name)).every((k) => want[k] === got[k])
  c.reset()
  if (!isSequential(spec)) {
    const st: ChipState = spec.newState?.() ?? {}
    for (const v of vectors(spec)) {
      c.set(v); c.eval()
      const want = pick(spec.eval(v, st)), got = pick(c.outputs())
      rows.push({ step: '', inputs: v, want, got, ok: same(want, got) })
    }
  } else {
    const st: ChipState = spec.newState!()
    let t = 0
    for (const v of sequence(spec)) {
      c.set(v); c.eval()
      let want = pick(spec.eval(v, st)), got = pick(c.outputs())
      rows.push({ step: `${t}`, inputs: v, want, got, ok: same(want, got) })
      spec.tick!(v, st); c.tick(); t++
      want = pick(spec.eval(v, st)); got = pick(c.outputs())
      rows.push({ step: `${t}+`, inputs: v, want, got, ok: same(want, got) })
    }
  }
  const passed = rows.filter((r) => r.ok).length
  return { rows, passed, total: rows.length, firstFail: rows.find((r) => !r.ok) }
}

// ─── Компьютер целиком: загружаем программы в ROM и смотрим на память ───
import { assemble, newMachine, runUntilHalt } from '../hack/hack'

export const COMPUTER_PROGRAMS = [
  { name: 'Add: R0 = 2 + 3', src: '@2\nD=A\n@3\nD=D+A\n@0\nM=D', ram: [] as number[], cycles: 10, check: [0] },
  { name: 'Max: R2 = max(R0, R1)', src: '@R0\nD=M\n@R1\nD=D-M\n@FIRST\nD;JGT\n@R1\nD=M\n@R2\nM=D\n@END\n0;JMP\n(FIRST)\n@R0\nD=M\n@R2\nM=D\n(END)\n@END\n0;JMP', ram: [3, 5], cycles: 30, check: [2] },
  { name: 'Mult: R2 = R0 × R1', src: '@R2\nM=0\n(LOOP)\n@R1\nD=M\n@END\nD;JEQ\n@R0\nD=M\n@R2\nM=D+M\n@R1\nM=M-1\n@LOOP\n0;JMP\n(END)\n@END\n0;JMP', ram: [7, 6], cycles: 120, check: [0, 1, 2] },
  { name: 'Экран: закрасить первое слово', src: '@SCREEN\nM=-1\n@24575\nM=1\n(END)\n@END\n0;JMP', ram: [], cycles: 12, check: [16384, 24575] },
]

function computerTests(c: Circuit): TestResult {
  const rows: TestRow[] = []
  const insts = c.insts as unknown as { spec: ChipSpec; state: ChipState }[]
  const rom = insts.find((i) => i.spec.name === 'ROM32K')
  const mem = insts.find((i) => i.spec.name === 'Memory')
  if (!rom || !mem) {
    const row: TestRow = { step: '', inputs: { reset: 0 }, want: { ok: 1 }, got: { ok: 0 }, ok: false }
    return { rows: [row], passed: 0, total: 1, firstFail: row }
  }
  for (const prog of COMPUTER_PROGRAMS) {
    const { rom: code } = assemble(prog.src)
    const ref = newMachine(); prog.ram.forEach((v, k) => { ref.ram[k] = v }); runUntilHalt(ref, code, prog.cycles * 4)
    c.reset()
    rom.state.rom = code.map((l) => l.code)
    prog.ram.forEach((v, k) => mem.state.mem!.set(k, v))
    c.set({ reset: 1 }); c.eval(); c.tick()
    c.set({ reset: 0 }); c.eval()
    for (let t = 0; t < prog.cycles; t++) c.tick()
    const want: Record<string, number> = {}, got: Record<string, number> = {}
    prog.check.forEach((a) => { want[`RAM[${a}]`] = ref.ram[a]; got[`RAM[${a}]`] = mem.state.mem!.get(a) ?? 0 })
    rows.push({ step: prog.name, inputs: {}, want, got, ok: prog.check.every((a) => want[`RAM[${a}]`] === got[`RAM[${a}]`]) })
  }
  const passed = rows.filter((r) => r.ok).length
  return { rows, passed, total: rows.length, firstFail: rows.find((r) => !r.ok) }
}
