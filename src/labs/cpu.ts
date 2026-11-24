// Игрушечный процессор с аккумулятором — как у первых микропроцессоров.
// Числа 8-битные (0–255, переполнение «заворачивается»), 16 ячеек памяти данных,
// программа хранится отдельно, переходы — по номеру строки.

export const OPS = {
  LOAD: { arg: 'addr', desc: 'ACC ← M[a] — загрузить из памяти в аккумулятор' },
  LOADI: { arg: 'num', desc: 'ACC ← n — загрузить число' },
  STORE: { arg: 'addr', desc: 'M[a] ← ACC — сохранить аккумулятор в память' },
  ADD: { arg: 'addr', desc: 'ACC ← ACC + M[a]' },
  SUB: { arg: 'addr', desc: 'ACC ← ACC − M[a]' },
  ADDI: { arg: 'num', desc: 'ACC ← ACC + n (n может быть отрицательным)' },
  JMP: { arg: 'line', desc: 'Перейти к строке' },
  JZ: { arg: 'line', desc: 'Перейти, если ACC = 0' },
  JNZ: { arg: 'line', desc: 'Перейти, если ACC ≠ 0' },
  OUT: { arg: 'none', desc: 'Вывести ACC' },
  HALT: { arg: 'none', desc: 'Остановить процессор' },
} as const
export type Op = keyof typeof OPS
export interface Instr { op: Op; arg: number }
export interface CpuState { pc: number; acc: number; mem: number[]; out: number[]; halted: boolean; steps: number; error?: string }

export function parse(src: string): { prog: Instr[]; errors: string[] } {
  const prog: Instr[] = []
  const errors: string[] = []
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/;.*$/, '').trim()
    if (!line) { prog.push({ op: 'HALT', arg: -1 }); return } // пустая строка = «нет команды», остановка
    const [opRaw, argRaw] = line.split(/\s+/)
    const op = opRaw.toUpperCase() as Op
    if (!(op in OPS)) { errors.push(`Строка ${i}: неизвестная команда «${opRaw}»`); prog.push({ op: 'HALT', arg: -1 }); return }
    const kind = OPS[op].arg
    if (kind === 'none') { prog.push({ op, arg: 0 }); return }
    const n = Number(argRaw)
    if (argRaw === undefined || !Number.isInteger(n)) { errors.push(`Строка ${i}: команде ${op} нужно целое число`); prog.push({ op: 'HALT', arg: -1 }); return }
    if (kind === 'addr' && (n < 0 || n > 15)) errors.push(`Строка ${i}: адрес памяти должен быть от 0 до 15`)
    prog.push({ op, arg: n })
  })
  while (prog.length && prog[prog.length - 1].arg === -1 && prog[prog.length - 1].op === 'HALT') prog.pop()
  return { prog, errors }
}

export const initState = (mem: number[]): CpuState => ({ pc: 0, acc: 0, mem: Array.from({ length: 16 }, (_, i) => mem[i] ?? 0), out: [], halted: false, steps: 0 })

export function step(s: CpuState, prog: Instr[]): CpuState {
  if (s.halted) return s
  if (s.pc < 0 || s.pc >= prog.length) return { ...s, halted: true }
  const { op, arg } = prog[s.pc]
  const n = { ...s, mem: [...s.mem], out: [...s.out], steps: s.steps + 1, pc: s.pc + 1 }
  const w = (x: number) => ((x % 256) + 256) % 256
  switch (op) {
    case 'LOAD': n.acc = n.mem[arg]; break
    case 'LOADI': n.acc = w(arg); break
    case 'STORE': n.mem[arg] = n.acc; break
    case 'ADD': n.acc = w(n.acc + n.mem[arg]); break
    case 'SUB': n.acc = w(n.acc - n.mem[arg]); break
    case 'ADDI': n.acc = w(n.acc + arg); break
    case 'JMP': n.pc = arg; break
    case 'JZ': if (n.acc === 0) n.pc = arg; break
    case 'JNZ': if (n.acc !== 0) n.pc = arg; break
    case 'OUT': n.out.push(n.acc); break
    case 'HALT': n.halted = true; n.pc = s.pc; break
  }
  return n
}

export function run(prog: Instr[], mem: number[], limit = 2000): CpuState {
  let s = initState(mem)
  while (!s.halted && s.steps < limit) s = step(s, prog)
  if (!s.halted) s = { ...s, error: `Программа не остановилась за ${limit} шагов — похоже на бесконечный цикл` }
  return s
}
