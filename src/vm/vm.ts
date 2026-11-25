// Виртуальная машина Hack: стековый ВМ-код, модель памяти и вызовы функций
// по спецификации курса (гл. 7–8). Встроенная ОС — в os.ts.

export type Seg = 'constant' | 'local' | 'argument' | 'this' | 'that' | 'static' | 'temp' | 'pointer'
export type Cmd =
  | { op: 'push' | 'pop'; seg: Seg; i: number }
  | { op: 'add' | 'sub' | 'neg' | 'eq' | 'gt' | 'lt' | 'and' | 'or' | 'not' }
  | { op: 'label' | 'goto' | 'if-goto'; label: string }
  | { op: 'function'; name: string; nVars: number }
  | { op: 'call'; name: string; nArgs: number }
  | { op: 'return' }
export interface Line { cmd: Cmd; file: string; src: number; text: string }

export class VmError extends Error {}

const SEGS = ['constant', 'local', 'argument', 'this', 'that', 'static', 'temp', 'pointer']
const ARITH = ['add', 'sub', 'neg', 'eq', 'gt', 'lt', 'and', 'or', 'not']

/** Разбор ВМ-кода; files — имя класса → текст .vm. Метки внутри функций делаются уникальными. */
export function parseVm(files: Record<string, string>): Line[] {
  const out: Line[] = []
  for (const [file, text] of Object.entries(files)) {
    let fn = ''
    text.split('\n').forEach((raw, src) => {
      const l = raw.replace(/\/\/.*$/, '').trim()
      if (!l) return
      const [op, a, b] = l.split(/\s+/)
      const where = `${file}.vm, строка ${src + 1}`
      const num = (x: string | undefined) => { if (x === undefined || !/^\d+$/.test(x)) throw new VmError(`${where}: ожидалось неотрицательное число`); return Number(x) }
      let cmd: Cmd
      if (op === 'push' || op === 'pop') {
        if (!SEGS.includes(a)) throw new VmError(`${where}: неизвестный сегмент «${a}»`)
        if (op === 'pop' && a === 'constant') throw new VmError(`${where}: pop constant не имеет смысла`)
        cmd = { op, seg: a as Seg, i: num(b) }
        if (a === 'temp' && cmd.i > 7) throw new VmError(`${where}: temp — только 0…7`)
        if (a === 'pointer' && cmd.i > 1) throw new VmError(`${where}: pointer — только 0 и 1`)
        if (a === 'constant' && cmd.i > 32767) throw new VmError(`${where}: константа больше 32767`)
      } else if (ARITH.includes(op)) cmd = { op: op as 'add' }
      else if (op === 'label' || op === 'goto' || op === 'if-goto') { if (!a) throw new VmError(`${where}: нужна метка`); cmd = { op, label: `${fn}$${a}` } }
      else if (op === 'function') { fn = a; cmd = { op, name: a, nVars: num(b) } }
      else if (op === 'call') cmd = { op, name: a, nArgs: num(b) }
      else if (op === 'return') cmd = { op }
      else throw new VmError(`${where}: неизвестная команда «${op}»`)
      out.push({ cmd, file, src, text: l })
    })
  }
  return out
}

export interface Frame { fn: string; ret: number; base: number }
export type Builtin = (vm: Vm, args: number[]) => number | 'block'

const s16 = (x: number) => ((x & 0xffff) >= 0x8000 ? (x & 0xffff) - 0x10000 : x & 0xffff)

export class Vm {
  ram = new Int16Array(32768)
  pc = 0
  lines: Line[]
  labels = new Map<string, number>()
  fns = new Map<string, number>()
  statics = new Map<string, number>()
  calls: Frame[] = []
  halted = false
  steps = 0
  key = 0
  out: string[] = []
  constructor(files: Record<string, string>, public builtins: Record<string, Builtin> = {}) {
    this.lines = parseVm(files)
    this.lines.forEach((l, i) => {
      if (l.cmd.op === 'label') this.labels.set(l.cmd.label, i)
      if (l.cmd.op === 'function') this.fns.set(l.cmd.name, i)
    })
    // static: у каждого файла свой блок, начиная с 16
    let st = 16
    for (const f of Object.keys(files)) { this.statics.set(f, st); st += 240 / Math.max(1, Object.keys(files).length) | 0 }
    this.ram[0] = 256; this.ram[1] = 256; this.ram[2] = 256; this.ram[3] = 0; this.ram[4] = 0
  }
  get sp() { return this.ram[0] }
  push(x: number) { this.ram[this.ram[0]] = s16(x); this.ram[0]++ }
  pop() { this.ram[0]--; return this.ram[this.ram[0]] }
  private addr(seg: Seg, i: number, file: string) {
    switch (seg) {
      case 'local': return this.ram[1] + i
      case 'argument': return this.ram[2] + i
      case 'this': return this.ram[3] + i
      case 'that': return this.ram[4] + i
      case 'temp': return 5 + i
      case 'pointer': return 3 + i
      case 'static': return this.statics.get(file)! + i
      default: throw new VmError('constant не имеет адреса')
    }
  }
  /** Вызов функции: встроенной (ОС на JS) или из ВМ-кода. */
  call(name: string, nArgs: number, ret: number) {
    if (!this.fns.has(name) && this.builtins[name]) {
      const args = Array.from({ length: nArgs }, (_, k) => this.ram[this.ram[0] - nArgs + k])
      const r = this.builtins[name](this, args)
      if (r === 'block') return false
      this.ram[0] -= nArgs
      this.push(r)
      this.pc = ret
      return true
    }
    const target = this.fns.get(name)
    if (target === undefined) throw new VmError(`функция ${name} не найдена`)
    this.push(ret); this.push(this.ram[1]); this.push(this.ram[2]); this.push(this.ram[3]); this.push(this.ram[4])
    this.ram[2] = this.ram[0] - 5 - nArgs
    this.ram[1] = this.ram[0]
    this.calls.push({ fn: name, ret, base: this.ram[2] })
    this.pc = target
    return true
  }
  /** Начать с Sys.init (как после загрузки ОС) или с первой строки. */
  boot() {
    const entry = this.fns.has('Sys.init') ? 'Sys.init' : this.fns.has('Main.main') ? 'Main.main' : null
    if (entry) this.call(entry, 0, -1)
  }
  step() {
    if (this.halted) return
    const line = this.lines[this.pc]
    if (!line) { this.halted = true; return }
    this.steps++
    const c = line.cmd
    switch (c.op) {
      case 'push': this.push(c.seg === 'constant' ? c.i : this.ram[this.addr(c.seg, c.i, line.file)]); this.pc++; break
      case 'pop': { const v = this.pop(); this.ram[this.addr(c.seg, c.i, line.file)] = v; this.pc++; break }
      case 'add': { const b = this.pop(), a = this.pop(); this.push(a + b); this.pc++; break }
      case 'sub': { const b = this.pop(), a = this.pop(); this.push(a - b); this.pc++; break }
      case 'neg': this.push(-this.pop()); this.pc++; break
      case 'not': this.push(~this.pop()); this.pc++; break
      case 'and': { const b = this.pop(), a = this.pop(); this.push(a & b); this.pc++; break }
      case 'or': { const b = this.pop(), a = this.pop(); this.push(a | b); this.pc++; break }
      case 'eq': case 'gt': case 'lt': {
        const b = this.pop(), a = this.pop()
        this.push((c.op === 'eq' ? a === b : c.op === 'gt' ? a > b : a < b) ? -1 : 0); this.pc++; break
      }
      case 'label': this.pc++; break
      case 'goto': this.jump(c.label); break
      case 'if-goto': if (this.pop() !== 0) this.jump(c.label); else this.pc++; break
      case 'function': for (let k = 0; k < c.nVars; k++) this.push(0); this.pc++; break
      case 'call': this.call(c.name, c.nArgs, this.pc + 1); break
      case 'return': {
        const frame = this.ram[1]
        const ret = this.ram[frame - 5]
        const result = this.pop()
        this.ram[this.ram[2]] = result
        this.ram[0] = this.ram[2] + 1
        this.ram[4] = this.ram[frame - 1]; this.ram[3] = this.ram[frame - 2]; this.ram[2] = this.ram[frame - 3]; this.ram[1] = this.ram[frame - 4]
        this.calls.pop()
        if (ret < 0 || this.calls.length === 0 && ret === -1) { this.halted = true; return }
        this.pc = ret
        break
      }
    }
  }
  private jump(label: string) {
    const t = this.labels.get(label)
    if (t === undefined) throw new VmError(`метка ${label.split('$')[1]} не найдена в функции ${label.split('$')[0] || '(вне функций)'}`)
    this.pc = t
  }
  run(limit = 5_000_000) { for (let i = 0; i < limit && !this.halted; i++) this.step(); return this.halted }
}
