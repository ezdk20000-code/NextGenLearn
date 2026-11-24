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

/** Сценарий для чипов с памятью: случайные записи и чтения с тактами. */
function sequence(spec: ChipSpec): Record<string, number>[] {
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
        const a = used.length && r() < 0.5 ? used[Math.floor(r() * used.length)] : Math.floor(r() * (m + 1))
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
  const rows: TestRow[] = []
  const pick = (o: Record<string, number>) => Object.fromEntries(spec.outputs.map((p) => [p.name, o[p.name] >>> 0]))
  c.reset()
  if (!isSequential(spec)) {
    const st: ChipState = spec.newState?.() ?? {}
    for (const v of vectors(spec)) {
      c.set(v); c.eval()
      const want = pick(spec.eval(v, st)), got = pick(c.outputs())
      rows.push({ step: '', inputs: v, want, got, ok: spec.outputs.every((p) => want[p.name] === got[p.name]) })
    }
  } else {
    const st: ChipState = spec.newState!()
    let t = 0
    for (const v of sequence(spec)) {
      c.set(v); c.eval()
      let want = pick(spec.eval(v, st)), got = pick(c.outputs())
      rows.push({ step: `${t}`, inputs: v, want, got, ok: spec.outputs.every((p) => want[p.name] === got[p.name]) })
      spec.tick!(v, st); c.tick(); t++
      want = pick(spec.eval(v, st)); got = pick(c.outputs())
      rows.push({ step: `${t}+`, inputs: v, want, got, ok: spec.outputs.every((p) => want[p.name] === got[p.name]) })
    }
  }
  const passed = rows.filter((r) => r.ok).length
  return { rows, passed, total: rows.length, firstFail: rows.find((r) => !r.ok) }
}
