// Компьютер Hack: ассемблер и эмулятор процессора.
// Формат команд — по открытой спецификации Nand2Tetris; код написан здесь с нуля.

export const COMP: Record<string, string> = {
  '0': '0101010', '1': '0111111', '-1': '0111010', D: '0001100', A: '0110000', '!D': '0001101', '!A': '0110001',
  '-D': '0001111', '-A': '0110011', 'D+1': '0011111', 'A+1': '0110111', 'D-1': '0001110', 'A-1': '0110010',
  'D+A': '0000010', 'D-A': '0010011', 'A-D': '0000111', 'D&A': '0000000', 'D|A': '0010101',
  M: '1110000', '!M': '1110001', '-M': '1110011', 'M+1': '1110111', 'M-1': '1110010', 'D+M': '1000010',
  'D-M': '1010011', 'M-D': '1000111', 'D&M': '1000000', 'D|M': '1010101',
}
// Коммутативные варианты записи, которые принимают и стандартные инструменты
const ALIAS: Record<string, string> = { 'A+D': 'D+A', 'M+D': 'D+M', 'A&D': 'D&A', 'M&D': 'D&M', 'A|D': 'D|A', 'M|D': 'D|M', '1+D': 'D+1', '1+A': 'A+1', '1+M': 'M+1' }
export const JUMP = ['', 'JGT', 'JEQ', 'JGE', 'JLT', 'JNE', 'JLE', 'JMP']
export const PREDEF: Record<string, number> = {
  SP: 0, LCL: 1, ARG: 2, THIS: 3, THAT: 4, SCREEN: 16384, KBD: 24576,
  ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`R${i}`, i])),
}

export interface AsmLine { src: number; text: string; code: number }
export interface AsmResult { rom: AsmLine[]; errors: string[]; symbols: Record<string, number> }

const clean = (l: string) => l.replace(/\/\/.*$/, '').replace(/\s+/g, '')

/** Двухпроходный ассемблер: метки → адреса, переменные с 16, затем коды. */
export function assemble(src: string): AsmResult {
  const lines = src.split('\n')
  const symbols: Record<string, number> = { ...PREDEF }
  const errors: string[] = []
  let pc = 0
  lines.forEach((raw, i) => {
    const l = clean(raw)
    if (!l) return
    if (l.startsWith('(')) {
      const m = /^\(([A-Za-z_.$:][\w.$:]*)\)$/.exec(l)
      if (!m) errors.push(`Строка ${i + 1}: неверная метка «${l}»`)
      else if (m[1] in symbols && !(m[1] in PREDEF)) errors.push(`Строка ${i + 1}: метка ${m[1]} объявлена дважды`)
      else symbols[m[1]] = pc
      return
    }
    pc++
  })
  let next = 16
  const rom: AsmLine[] = []
  lines.forEach((raw, i) => {
    const l = clean(raw)
    if (!l || l.startsWith('(')) return
    if (l.startsWith('@')) {
      const v = l.slice(1)
      let n: number
      if (/^\d+$/.test(v)) { n = Number(v); if (n > 32767) errors.push(`Строка ${i + 1}: число ${n} больше 32767 — A-инструкция хранит 15 бит`) }
      else if (/^[A-Za-z_.$:][\w.$:]*$/.test(v)) { if (!(v in symbols)) symbols[v] = next++; n = symbols[v] }
      else { errors.push(`Строка ${i + 1}: после @ должно быть число или имя`); n = 0 }
      rom.push({ src: i, text: raw.trim(), code: n & 0x7fff }); return
    }
    let dest = '', comp = l, jump = ''
    if (comp.includes('=')) [dest, comp] = comp.split('=')
    if (comp.includes(';')) [comp, jump] = comp.split(';')
    comp = ALIAS[comp] ?? comp
    const c = COMP[comp]
    const j = JUMP.indexOf(jump)
    const okDest = /^A?M?D?$/.test(dest) || /^[AMD]{1,3}$/.test(dest)
    if (!c) errors.push(`Строка ${i + 1}: неизвестное вычисление «${comp}»`)
    if (j < 0) errors.push(`Строка ${i + 1}: неизвестный переход «${jump}»`)
    if (!okDest || new Set(dest).size !== dest.length) errors.push(`Строка ${i + 1}: неверное место записи «${dest}»`)
    const d = (dest.includes('A') ? 4 : 0) | (dest.includes('D') ? 2 : 0) | (dest.includes('M') ? 1 : 0)
    rom.push({ src: i, text: raw.trim(), code: c && j >= 0 ? parseInt(`111${c}${d.toString(2).padStart(3, '0')}${j.toString(2).padStart(3, '0')}`, 2) : 0 })
  })
  return { rom, errors, symbols }
}

export const toBin = (x: number) => (x & 0xffff).toString(2).padStart(16, '0')
export const signed = (x: number) => ((x & 0xffff) >= 0x8000 ? (x & 0xffff) - 0x10000 : x & 0xffff)

/** Разбор машинного слова для показа ученику. */
export function decode(w: number): { kind: 'A'; value: number } | { kind: 'C'; comp: string; dest: string; jump: string } {
  if (!(w & 0x8000)) return { kind: 'A', value: w }
  const c = ((w >> 6) & 0x7f).toString(2).padStart(7, '0')
  const comp = Object.entries(COMP).find(([, v]) => v === c)?.[0] ?? '?'
  const d = (w >> 3) & 7
  const dest = `${d & 4 ? 'A' : ''}${d & 2 ? 'D' : ''}${d & 1 ? 'M' : ''}`
  return { kind: 'C', comp, dest, jump: JUMP[w & 7] }
}

export interface Machine { A: number; D: number; PC: number; ram: Uint16Array; key: number; cycles: number }
export const newMachine = (): Machine => ({ A: 0, D: 0, PC: 0, ram: new Uint16Array(32768), key: 0, cycles: 0 })

/** Вычисление АЛУ по 6 управляющим битам — то же, что твоё АЛУ из проекта 2. */
function alu(x: number, y: number, bits: number) {
  const [zx, nx, zy, ny, f, no] = [32, 16, 8, 4, 2, 1].map((b) => (bits & b ? 1 : 0))
  if (zx) x = 0; if (nx) x = ~x & 0xffff
  if (zy) y = 0; if (ny) y = ~y & 0xffff
  let o = f ? (x + y) & 0xffff : x & y
  if (no) o = ~o & 0xffff
  return o
}

/** Один такт: выполнить инструкцию по адресу PC. */
export function step(m: Machine, rom: AsmLine[]) {
  const w = rom[m.PC]?.code ?? 0
  m.cycles++
  if (!(w & 0x8000)) { m.A = w; m.PC++; return }
  const a = (w >> 12) & 1
  const memIn = m.A === 24576 ? m.key : m.ram[m.A & 0x7fff]
  const out = alu(m.D, a ? memIn : m.A, (w >> 6) & 63)
  const d = (w >> 3) & 7
  const addr = m.A
  if (d & 1 && addr < 24576) m.ram[addr] = out
  if (d & 4) m.A = out
  if (d & 2) m.D = out
  const s = signed(out)
  const j = w & 7
  const jump = (j & 4 && s < 0) || (j & 2 && s === 0) || (j & 1 && s > 0)
  m.PC = jump ? m.A & 0x7fff : m.PC + 1
}

/** Выполнить до бесконечного цикла-останова (прыжок на себя) или лимита тактов. */
export function runUntilHalt(m: Machine, rom: AsmLine[], limit = 200000) {
  for (let i = 0; i < limit; i++) {
    const before = m.PC
    step(m, rom)
    if (m.PC === before || m.PC >= rom.length) return true
    // типичный «стоп» Hack: @END / 0;JMP — две команды, прыгающие на первую
    if (m.PC === before - 1 && rom[m.PC] && !(rom[m.PC].code & 0x8000) && rom[m.PC].code === m.PC) return true
  }
  return false
}
