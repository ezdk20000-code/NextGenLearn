// Разбор и симуляция языка описания аппаратуры (HDL) в духе Nand2Tetris.
// Части схемы — встроенные чипы из библиотеки (уже собранные учеником или Nand/DFF).

import { chipByName, type ChipSpec, type ChipState, type Pin } from './chips'

export class HdlError extends Error {
  constructor(msg: string, public line?: number) { super(line ? `Строка ${line}: ${msg}` : msg) }
}

interface Tok { t: string; line: number }
function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let line = 1
  for (let i = 0; i < src.length;) {
    const ch = src[i]
    if (ch === '\n') { line++; i++; continue }
    if (/\s/.test(ch)) { i++; continue }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; line += (src.slice(i, end).match(/\n/g) ?? []).length; i = end; continue }
    if (src.startsWith('..', i)) { out.push({ t: '..', line }); i += 2; continue }
    if ('{}();,=[]:'.includes(ch)) { out.push({ t: ch, line }); i++; continue }
    const m = /^[A-Za-z_][A-Za-z0-9_]*|^\d+/.exec(src.slice(i))
    if (!m) throw new HdlError(`непонятный символ «${ch}»`, line)
    out.push({ t: m[0], line }); i += m[0].length
  }
  return out
}

export interface Ref { name: string; lo: number; hi: number; sub: boolean; line: number }
export interface Conn { pin: Ref; sig: Ref | { const: 0 | 1; line: number } }
export interface Part { chip: ChipSpec; conns: Conn[]; line: number }
export interface Parsed { name: string; inputs: Pin[]; outputs: Pin[]; parts: Part[] }

export function parse(src: string): Parsed {
  const tk = tokenize(src)
  let k = 0
  const peek = () => tk[k]
  const lastLine = () => tk[Math.min(k, tk.length - 1)]?.line
  const next = () => { if (k >= tk.length) throw new HdlError('файл неожиданно закончился', lastLine()); return tk[k++] }
  const expect = (t: string) => { const x = next(); if (x.t !== t) throw new HdlError(`ожидалось «${t}», а встретилось «${x.t}»`, x.line); return x }
  const ident = () => { const x = next(); if (!/^[A-Za-z_]/.test(x.t)) throw new HdlError(`ожидалось имя, а встретилось «${x.t}»`, x.line); return x }
  const num = () => { const x = next(); if (!/^\d+$/.test(x.t)) throw new HdlError(`ожидалось число, а встретилось «${x.t}»`, x.line); return Number(x.t) }

  expect('CHIP')
  const name = ident().t
  expect('{')
  const pinList = (kw: string) => {
    expect(kw)
    const pins: Pin[] = []
    for (;;) {
      const n = ident().t
      let width = 1
      if (peek()?.t === '[') { next(); width = num(); expect(']') }
      pins.push({ name: n, width })
      const x = next()
      if (x.t === ';') break
      if (x.t !== ',') throw new HdlError(`ожидалась «,» или «;» после ${n}`, x.line)
    }
    return pins
  }
  const inputs = peek()?.t === 'IN' ? pinList('IN') : []
  const outputs = peek()?.t === 'OUT' ? pinList('OUT') : []
  const kw = next()
  if (kw.t === 'BUILTIN') throw new HdlError('встроенные чипы описывать не нужно — собери этот чип из частей', kw.line)
  if (kw.t !== 'PARTS') throw new HdlError('ожидалось «PARTS:»', kw.line)
  expect(':')

  const ref = (): Ref => {
    const x = ident()
    if (peek()?.t === '[') {
      next(); const lo = num(); let hi = lo
      if (peek()?.t === '..') { next(); hi = num() }
      expect(']')
      if (hi < lo) throw new HdlError(`диапазон ${x.t}[${lo}..${hi}] перевёрнут`, x.line)
      return { name: x.t, lo, hi, sub: true, line: x.line }
    }
    return { name: x.t, lo: 0, hi: -1, sub: false, line: x.line }
  }
  const parts: Part[] = []
  while (peek() && peek().t !== '}') {
    const cn = ident()
    const chip = chipByName(cn.t)
    if (!chip) throw new HdlError(`чипа «${cn.t}» нет в библиотеке`, cn.line)
    expect('(')
    const conns: Conn[] = []
    for (;;) {
      const pin = ref()
      expect('=')
      const s = peek()
      const sig = s && (s.t === 'true' || s.t === 'false') ? (next(), { const: (s.t === 'true' ? 1 : 0) as 0 | 1, line: s.line }) : ref()
      conns.push({ pin, sig })
      const x = next()
      if (x.t === ')') break
      if (x.t !== ',') throw new HdlError('ожидалась «,» или «)» между подключениями', x.line)
    }
    expect(';')
    parts.push({ chip, conns, line: cn.line })
  }
  expect('}')
  return { name, inputs, outputs, parts }
}

const mask = (w: number) => (w >= 31 ? 0xffffffff : (1 << w) - 1)

interface Wire { name: string; width: number; kind: 'in' | 'out' | 'internal' }
interface Inst { spec: ChipSpec; state: ChipState; ins: { pin: Pin; lo: number; w: number; src: Ref | { const: 0 | 1 } }[]; outs: { pin: Pin; lo: number; w: number; dst: Ref }[] }

/** Собранная схема, готовая к симуляции. */
export class Circuit {
  wires = new Map<string, Wire>()
  vals = new Map<string, number>()
  insts: Inst[] = []
  constructor(public parsed: Parsed, public spec: ChipSpec, allowed: (chip: string) => boolean) {
    const p = parsed
    if (p.name !== spec.name) throw new HdlError(`чип называется ${p.name}, а нужно ${spec.name}`)
    const same = (a: Pin[], b: Pin[]) => a.length === b.length && a.every((x, i) => x.name === b[i].name && x.width === b[i].width)
    if (!same(p.inputs, spec.inputs) || !same(p.outputs, spec.outputs)) throw new HdlError('не меняй строки IN и OUT — интерфейс чипа задан спецификацией')
    p.inputs.forEach((x) => this.wires.set(x.name, { ...x, kind: 'in' }))
    p.outputs.forEach((x) => this.wires.set(x.name, { ...x, kind: 'out' }))

    // 1-й проход: внутренние провода получают ширину от выходов частей
    for (const part of p.parts) {
      if (!allowed(part.chip.name)) throw new HdlError(`чип ${part.chip.name} пока нельзя использовать: сначала собери его сам (или он идёт позже по программе)`, part.line)
      if (part.chip.name === spec.name) throw new HdlError('чип не может состоять сам из себя', part.line)
      for (const c of part.conns) {
        const pin = part.chip.outputs.find((x) => x.name === c.pin.name)
        if (!pin || 'const' in c.sig) continue
        const w = c.pin.sub ? c.pin.hi - c.pin.lo + 1 : pin.width
        const existing = this.wires.get(c.sig.name)
        if (existing?.kind === 'in') throw new HdlError(`${c.sig.name} — вход чипа, в него нельзя ничего подавать`, c.sig.line)
        if (!existing) {
          if (c.sig.sub) throw new HdlError(`у внутреннего провода ${c.sig.name} нельзя брать часть битов при создании`, c.sig.line)
          this.wires.set(c.sig.name, { name: c.sig.name, width: w, kind: 'internal' })
        }
      }
    }
    // 2-й проход: проверка подключений
    for (const part of p.parts) {
      const inst: Inst = { spec: part.chip, state: part.chip.newState?.() ?? {}, ins: [], outs: [] }
      const used = new Set<string>()
      for (const c of part.conns) {
        const inPin = part.chip.inputs.find((x) => x.name === c.pin.name)
        const outPin = part.chip.outputs.find((x) => x.name === c.pin.name)
        const pin = inPin ?? outPin
        if (!pin) throw new HdlError(`у чипа ${part.chip.name} нет вывода «${c.pin.name}» (есть: ${[...part.chip.inputs, ...part.chip.outputs].map((x) => x.name).join(', ')})`, c.pin.line)
        if (c.pin.sub && c.pin.hi >= pin.width) throw new HdlError(`${part.chip.name}.${pin.name} имеет ${pin.width} бит, индекс ${c.pin.hi} вне диапазона`, c.pin.line)
        const key = `${pin.name}[${c.pin.sub ? c.pin.lo : 0}]`
        if (inPin && used.has(key)) throw new HdlError(`вход ${pin.name} подключён дважды`, c.pin.line)
        used.add(key)
        const lo = c.pin.sub ? c.pin.lo : 0
        const w = c.pin.sub ? c.pin.hi - c.pin.lo + 1 : pin.width
        if ('const' in c.sig) {
          if (outPin) throw new HdlError('выход части нельзя подключить к константе', c.pin.line)
          inst.ins.push({ pin, lo, w, src: c.sig }); continue
        }
        const wire = this.wires.get(c.sig.name)
        if (!wire) throw new HdlError(`провод «${c.sig.name}» нигде не получает значения`, c.sig.line)
        if (c.sig.sub && c.sig.hi >= wire.width) throw new HdlError(`у ${c.sig.name} всего ${wire.width} бит`, c.sig.line)
        const sw = c.sig.sub ? c.sig.hi - c.sig.lo + 1 : wire.width
        if (sw !== w) throw new HdlError(`ширины не совпадают: ${part.chip.name}.${pin.name}${c.pin.sub ? `[${c.pin.lo}..${c.pin.hi}]` : ''} — ${w} бит, а ${c.sig.name}${c.sig.sub ? `[${c.sig.lo}..${c.sig.hi}]` : ''} — ${sw} бит`, c.sig.line)
        if (inPin) {
          if (wire.kind === 'out') throw new HdlError(`выход чипа ${c.sig.name} нельзя читать внутри схемы — заведи внутренний провод (например, out=${c.sig.name}, out=${c.sig.name}Copy)`, c.sig.line)
          inst.ins.push({ pin, lo, w, src: c.sig })
        } else inst.outs.push({ pin, lo, w, dst: c.sig })
      }
      this.insts.push(inst)
    }
    // Один бит провода может получать значение только от одного выхода
    const bitsDriven = new Map<string, number>()
    for (const i of this.insts) for (const o of i.outs) {
      const w = this.wires.get(o.dst.name)!
      const m = (o.dst.sub ? mask(o.dst.hi - o.dst.lo + 1) << o.dst.lo : mask(w.width)) >>> 0
      const prev = bitsDriven.get(o.dst.name) ?? 0
      if (prev & m) throw new HdlError(`провод ${o.dst.name} получает значение сразу от нескольких выходов`, o.dst.line)
      bitsDriven.set(o.dst.name, (prev | m) >>> 0)
    }
    const driven = new Set(this.insts.flatMap((i) => i.outs.map((o) => o.dst.name)))
    for (const o of p.outputs) if (!driven.has(o.name)) throw new HdlError(`выход ${o.name} ни к чему не подключён`)
    this.reset()
  }

  reset() {
    this.wires.forEach((w) => this.vals.set(w.name, 0))
    this.insts.forEach((i) => { i.state = i.spec.newState?.() ?? {} })
  }

  private read(r: Ref | { const: 0 | 1 }, w: number) {
    if ('const' in r) return r.const ? mask(w) : 0
    const v = this.vals.get(r.name) ?? 0
    return r.sub ? (v >>> r.lo) & mask(r.hi - r.lo + 1) : v
  }
  private write(r: Ref, x: number) {
    const v = this.vals.get(r.name) ?? 0
    if (!r.sub) { this.vals.set(r.name, x); return }
    const m = mask(r.hi - r.lo + 1) << r.lo
    this.vals.set(r.name, ((v & ~m) | ((x << r.lo) & m)) >>> 0)
  }
  private partInputs(i: Inst) {
    const ins: Record<string, number> = {}
    i.spec.inputs.forEach((p) => { ins[p.name] = 0 })
    for (const c of i.ins) ins[c.pin.name] = (ins[c.pin.name] & ~(mask(c.w) << c.lo)) | (this.read(c.src, c.w) << c.lo)
    for (const k in ins) ins[k] >>>= 0
    return ins
  }

  set(inputs: Record<string, number>) {
    for (const p of this.parsed.inputs) if (p.name in inputs) this.vals.set(p.name, inputs[p.name] & mask(p.width))
  }

  /** Распространяет сигналы до установившегося состояния. */
  eval() {
    for (let pass = 0; pass < this.insts.length + 3; pass++) {
      let changed = false
      for (const i of this.insts) {
        const outs = i.spec.eval(this.partInputs(i), i.state)
        for (const o of i.outs) {
          const x = (outs[o.pin.name] >>> o.lo) & mask(o.w)
          const before = this.vals.get(o.dst.name)
          this.write(o.dst, x)
          if (this.vals.get(o.dst.name) !== before) changed = true
        }
      }
      if (!changed) return
    }
    throw new HdlError('схема не успокаивается: есть петля без триггера (выход вентиля по кругу подаётся на его же вход)')
  }

  /** Фронт такта: все части с памятью запоминают свои входы, затем схема пересчитывается. */
  tick() {
    const snaps = this.insts.filter((i) => i.spec.tick).map((i) => [i, this.partInputs(i)] as const)
    snaps.forEach(([i, ins]) => i.spec.tick!(ins, i.state))
    this.eval()
  }

  outputs() { return Object.fromEntries(this.parsed.outputs.map((p) => [p.name, this.vals.get(p.name) ?? 0])) }
  value(name: string) { return this.vals.get(name) ?? 0 }
}

export function compile(src: string, spec: ChipSpec, allowed: (chip: string) => boolean) {
  return new Circuit(parse(src), spec, allowed)
}
