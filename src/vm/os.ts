// Встроенная ОС Jack на JavaScript (как встроенные классы в эмуляторе курса).
// Работает поверх памяти ВМ: куча 2048…16383, экран 16384…24575, клавиатура 24576.
// В проекте 12 ученик пишет те же классы на Jack, и они заменяют эти.

import type { Builtin, Vm } from './vm'

const HEAP = 2048, HEAP_END = 16384, SCREEN = 16384
const ROWS = 23, COLS = 64

/** Состояние ОС, привязанное к машине. */
export interface OsState { free: Map<number, number>; used: Map<number, number>; color: boolean; text: string[][]; row: number; col: number; input: string }
const os = (vm: Vm): OsState => {
  const v = vm as Vm & { os?: OsState }
  if (!v.os) v.os = { free: new Map([[HEAP, HEAP_END - HEAP]]), used: new Map(), color: true, text: Array.from({ length: ROWS }, () => Array(COLS).fill(' ')), row: 0, col: 0, input: '' }
  return v.os
}

function alloc(vm: Vm, size: number) {
  const s = os(vm)
  if (size <= 0) throw new Error('Memory.alloc: размер должен быть больше 0')
  for (const [addr, len] of [...s.free.entries()].sort((a, b) => a[0] - b[0])) {
    if (len >= size) {
      s.free.delete(addr)
      if (len > size) s.free.set(addr + size, len - size)
      s.used.set(addr, size)
      for (let k = 0; k < size; k++) vm.ram[addr + k] = 0
      return addr
    }
  }
  throw new Error('Memory.alloc: куча переполнена')
}
function dealloc(vm: Vm, addr: number) {
  const s = os(vm)
  const size = s.used.get(addr)
  if (size === undefined) return
  s.used.delete(addr); s.free.set(addr, size)
}

// Строка Jack в куче: [maxLength, length, символы…]
export const jsString = (vm: Vm, p: number) => { let r = ''; for (let k = 0; k < vm.ram[p + 1]; k++) r += String.fromCharCode(vm.ram[p + 2 + k]); return r }

function pixel(vm: Vm, x: number, y: number, on: boolean) {
  if (x < 0 || x > 511 || y < 0 || y > 255) return
  const a = SCREEN + y * 32 + (x >> 4)
  const m = 1 << (x & 15)
  vm.ram[a] = on ? vm.ram[a] | m : vm.ram[a] & ~m
}
function line(vm: Vm, x1: number, y1: number, x2: number, y2: number) {
  const c = os(vm).color
  const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
  let err = dx + dy
  for (;;) {
    pixel(vm, x1, y1, c)
    if (x1 === x2 && y1 === y2) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x1 += sx }
    if (e2 <= dx) { err += dx; y1 += sy }
  }
}
function put(vm: Vm, ch: string) {
  const s = os(vm)
  if (ch === '\n') { s.row = (s.row + 1) % ROWS; s.col = 0; return }
  s.text[s.row][s.col] = ch
  s.col++
  if (s.col >= COLS) { s.col = 0; s.row = (s.row + 1) % ROWS }
}

const t16 = (x: number) => (x << 16) >> 16

export const OS: Record<string, Builtin> = {
  'Math.init': () => 0,
  'Math.abs': (_v, [x]) => Math.abs(x),
  'Math.multiply': (_v, [x, y]) => t16(Math.imul(x, y)),
  'Math.divide': (_v, [x, y]) => { if (y === 0) throw new Error('Math.divide: деление на ноль'); return Math.trunc(x / y) },
  'Math.min': (_v, [x, y]) => Math.min(x, y),
  'Math.max': (_v, [x, y]) => Math.max(x, y),
  'Math.sqrt': (_v, [x]) => { if (x < 0) throw new Error('Math.sqrt: отрицательный аргумент'); return Math.floor(Math.sqrt(x)) },

  'Memory.init': () => 0,
  'Memory.peek': (v, [a]) => v.ram[a & 0x7fff],
  'Memory.poke': (v, [a, x]) => { v.ram[a & 0x7fff] = x; return 0 },
  'Memory.alloc': (v, [n]) => alloc(v, n),
  'Memory.deAlloc': (v, [p]) => { dealloc(v, p); return 0 },
  'Array.new': (v, [n]) => alloc(v, n),
  'Array.dispose': (v, [p]) => { dealloc(v, p); return 0 },

  'String.new': (v, [max]) => { const p = alloc(v, Math.max(1, max) + 2); v.ram[p] = max; v.ram[p + 1] = 0; return p },
  'String.dispose': (v, [p]) => { dealloc(v, p); return 0 },
  'String.length': (v, [p]) => v.ram[p + 1],
  'String.charAt': (v, [p, i]) => v.ram[p + 2 + i],
  'String.setCharAt': (v, [p, i, c]) => { v.ram[p + 2 + i] = c; return 0 },
  'String.appendChar': (v, [p, c]) => { const n = v.ram[p + 1]; if (n >= v.ram[p]) throw new Error('String.appendChar: строка заполнена'); v.ram[p + 2 + n] = c; v.ram[p + 1] = n + 1; return p },
  'String.eraseLastChar': (v, [p]) => { if (v.ram[p + 1] > 0) v.ram[p + 1]--; return 0 },
  'String.intValue': (v, [p]) => { const s = jsString(v, p); const m = /^-?\d+/.exec(s); return m ? t16(Number(m[0])) : 0 },
  'String.setInt': (v, [p, x]) => { const s = String(x); for (let k = 0; k < s.length; k++) v.ram[p + 2 + k] = s.charCodeAt(k); v.ram[p + 1] = s.length; return 0 },
  'String.newLine': () => 128,
  'String.backSpace': () => 129,
  'String.doubleQuote': () => 34,

  'Output.init': () => 0,
  'Output.moveCursor': (v, [r, c]) => { const s = os(v); s.row = Math.max(0, Math.min(ROWS - 1, r)); s.col = Math.max(0, Math.min(COLS - 1, c)); return 0 },
  'Output.printChar': (v, [c]) => { put(v, c === 128 ? '\n' : String.fromCharCode(c)); return 0 },
  'Output.printString': (v, [p]) => { for (const ch of jsString(v, p)) put(v, ch); v.out.push(jsString(v, p)); return 0 },
  'Output.printInt': (v, [x]) => { for (const ch of String(x)) put(v, ch); v.out.push(String(x)); return 0 },
  'Output.println': (v) => { put(v, '\n'); v.out.push('\n'); return 0 },
  'Output.backSpace': (v) => { const s = os(v); if (s.col > 0) { s.col--; s.text[s.row][s.col] = ' ' } return 0 },

  'Screen.init': () => 0,
  'Screen.clearScreen': (v) => { for (let a = SCREEN; a < SCREEN + 8192; a++) v.ram[a] = 0; return 0 },
  'Screen.setColor': (v, [b]) => { os(v).color = b !== 0; return 0 },
  'Screen.drawPixel': (v, [x, y]) => { pixel(v, x, y, os(v).color); return 0 },
  'Screen.drawLine': (v, [x1, y1, x2, y2]) => { line(v, x1, y1, x2, y2); return 0 },
  'Screen.drawRectangle': (v, [x1, y1, x2, y2]) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) pixel(v, x, y, os(v).color); return 0 },
  'Screen.drawCircle': (v, [cx, cy, r]) => { for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); for (let x = cx - w; x <= cx + w; x++) pixel(v, x, cy + dy, os(v).color) } return 0 },

  'Keyboard.init': () => 0,
  'Keyboard.keyPressed': (v) => v.key,
  'Keyboard.readChar': (v) => { const s = os(v); if (s.input) { const c = s.input.charCodeAt(0); s.input = s.input.slice(1); put(v, String.fromCharCode(c)); return c } return v.key ? v.key : 'block' },
  'Keyboard.readLine': (v, [msg]) => { const s = os(v); const nl = s.input.indexOf('\n'); if (nl < 0) return 'block'; const txt = s.input.slice(0, nl); s.input = s.input.slice(nl + 1); for (const ch of jsString(v, msg) + txt) put(v, ch); put(v, '\n'); const p = alloc(v, txt.length + 2); v.ram[p] = txt.length; v.ram[p + 1] = txt.length; for (let k = 0; k < txt.length; k++) v.ram[p + 2 + k] = txt.charCodeAt(k); return p },
  'Keyboard.readInt': (v, [msg]) => { const s = os(v); const nl = s.input.indexOf('\n'); if (nl < 0) return 'block'; const txt = s.input.slice(0, nl); s.input = s.input.slice(nl + 1); for (const ch of jsString(v, msg) + txt) put(v, ch); put(v, '\n'); return t16(Number(/^-?\d+/.exec(txt)?.[0] ?? 0)) },

  'Sys.init': () => 0,
  'Sys.halt': (v) => { v.halted = true; return 0 },
  'Sys.error': (_v, [c]) => { throw new Error(`Sys.error(${c})`) },
  'Sys.wait': () => 0,
}

export const osText = (vm: Vm) => os(vm).text.map((r) => r.join('')).join('\n')
export const setInput = (vm: Vm, s: string) => { os(vm).input = s }
