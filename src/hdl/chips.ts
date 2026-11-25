// Библиотека чипов компьютера Hack: интерфейсы и эталонное поведение.
// Интерфейсы (имена и ширины выводов) следуют открытой спецификации Nand2Tetris,
// поведение написано здесь с нуля и служит эталоном для автотестов
// и встроенной реализацией уже собранных чипов.

export interface Pin { name: string; width: number }
export interface ChipSpec {
  name: string
  project: 1 | 2 | 3 | 5
  inputs: Pin[]
  outputs: Pin[]
  /** Описание для ученика */
  doc: string
  /** Комбинационная часть: выходы по входам (и состоянию для памяти) */
  eval: (ins: Record<string, number>, st: ChipState) => Record<string, number>
  /** Есть такт: на фронте обновляет состояние */
  tick?: (ins: Record<string, number>, st: ChipState) => void
  newState?: () => ChipState
  relevant?: Relevant
  builtin?: boolean
}
export type ChipState = { v?: number; mem?: Map<number, number>; key?: number; A?: number; D?: number; PC?: number; rom?: number[] }

/** Какие выходы сравнивать в тесте (для CPU outM важен только при writeM = 1). */
export type Relevant = (want: Record<string, number>) => string[]

const M16 = 0xffff
const p = (name: string, width = 1): Pin => ({ name, width })
const bit = (x: number, i: number) => (x >> i) & 1
const not16 = (x: number) => ~x & M16
const sel4 = (s: number, xs: number[]) => xs[s & 3]

function ram(name: string, addrBits: number, project: 3): ChipSpec {
  return {
    name, project,
    inputs: [p('in', 16), p('load'), p('address', addrBits)], outputs: [p('out', 16)],
    doc: `Память на ${2 ** addrBits} 16-битных слов. out всегда показывает слово по адресу address. Если load = 1, на следующем такте в это слово записывается in.`,
    newState: () => ({ mem: new Map() }),
    eval: (i, s) => ({ out: s.mem!.get(i.address) ?? 0 }),
    tick: (i, s) => { if (i.load) s.mem!.set(i.address, i.in & M16) },
  }
}

export const CHIPS: ChipSpec[] = [
  { name: 'Nand', project: 1, builtin: true, inputs: [p('a'), p('b')], outputs: [p('out')], doc: 'Встроенный. out = НЕ (a И b). Из него строится всё остальное.', eval: (i) => ({ out: i.a & i.b ? 0 : 1 }) },
  { name: 'Not', project: 1, inputs: [p('in')], outputs: [p('out')], doc: 'Инвертор: out = НЕ in.', eval: (i) => ({ out: i.in ? 0 : 1 }) },
  { name: 'And', project: 1, inputs: [p('a'), p('b')], outputs: [p('out')], doc: 'out = 1, только если a = 1 и b = 1.', eval: (i) => ({ out: i.a & i.b }) },
  { name: 'Or', project: 1, inputs: [p('a'), p('b')], outputs: [p('out')], doc: 'out = 1, если хотя бы один вход равен 1.', eval: (i) => ({ out: i.a | i.b }) },
  { name: 'Xor', project: 1, inputs: [p('a'), p('b')], outputs: [p('out')], doc: 'out = 1, если входы различны.', eval: (i) => ({ out: i.a ^ i.b }) },
  { name: 'Mux', project: 1, inputs: [p('a'), p('b'), p('sel')], outputs: [p('out')], doc: 'Мультиплексор: если sel = 0, out = a, иначе out = b.', eval: (i) => ({ out: i.sel ? i.b : i.a }) },
  { name: 'DMux', project: 1, inputs: [p('in'), p('sel')], outputs: [p('a'), p('b')], doc: 'Демультиплексор: направляет in на a (sel = 0) или на b (sel = 1); другой выход — 0.', eval: (i) => ({ a: i.sel ? 0 : i.in, b: i.sel ? i.in : 0 }) },
  { name: 'Not16', project: 1, inputs: [p('in', 16)], outputs: [p('out', 16)], doc: 'Not для каждого из 16 битов.', eval: (i) => ({ out: not16(i.in) }) },
  { name: 'And16', project: 1, inputs: [p('a', 16), p('b', 16)], outputs: [p('out', 16)], doc: 'And побитно для 16 бит.', eval: (i) => ({ out: i.a & i.b }) },
  { name: 'Or16', project: 1, inputs: [p('a', 16), p('b', 16)], outputs: [p('out', 16)], doc: 'Or побитно для 16 бит.', eval: (i) => ({ out: i.a | i.b }) },
  { name: 'Mux16', project: 1, inputs: [p('a', 16), p('b', 16), p('sel')], outputs: [p('out', 16)], doc: '16-битный мультиплексор: out = sel ? b : a.', eval: (i) => ({ out: i.sel ? i.b : i.a }) },
  { name: 'Or8Way', project: 1, inputs: [p('in', 8)], outputs: [p('out')], doc: 'out = 1, если хотя бы один из 8 битов in равен 1.', eval: (i) => ({ out: i.in ? 1 : 0 }) },
  { name: 'Mux4Way16', project: 1, inputs: [p('a', 16), p('b', 16), p('c', 16), p('d', 16), p('sel', 2)], outputs: [p('out', 16)], doc: 'Выбирает одно из четырёх слов: sel = 00 → a, 01 → b, 10 → c, 11 → d.', eval: (i) => ({ out: sel4(i.sel, [i.a, i.b, i.c, i.d]) }) },
  { name: 'Mux8Way16', project: 1, inputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => p(n, 16)).concat(p('sel', 3)), outputs: [p('out', 16)], doc: 'Выбирает одно из восьми слов по sel (000 → a … 111 → h).', eval: (i) => ({ out: [i.a, i.b, i.c, i.d, i.e, i.f, i.g, i.h][i.sel & 7] }) },
  { name: 'DMux4Way', project: 1, inputs: [p('in'), p('sel', 2)], outputs: ['a', 'b', 'c', 'd'].map((n) => p(n)), doc: 'Направляет in на один из четырёх выходов по sel.', eval: (i) => Object.fromEntries(['a', 'b', 'c', 'd'].map((n, k) => [n, (i.sel & 3) === k ? i.in : 0])) },
  { name: 'DMux8Way', project: 1, inputs: [p('in'), p('sel', 3)], outputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => p(n)), doc: 'Направляет in на один из восьми выходов по sel.', eval: (i) => Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n, k) => [n, (i.sel & 7) === k ? i.in : 0])) },

  { name: 'HalfAdder', project: 2, inputs: [p('a'), p('b')], outputs: [p('sum'), p('carry')], doc: 'Складывает два бита: sum — младший бит суммы, carry — перенос.', eval: (i) => ({ sum: i.a ^ i.b, carry: i.a & i.b }) },
  { name: 'FullAdder', project: 2, inputs: [p('a'), p('b'), p('c')], outputs: [p('sum'), p('carry')], doc: 'Складывает три бита.', eval: (i) => { const s = i.a + i.b + i.c; return { sum: s & 1, carry: s >> 1 } } },
  { name: 'Add16', project: 2, inputs: [p('a', 16), p('b', 16)], outputs: [p('out', 16)], doc: 'Складывает два 16-битных числа в дополнительном коде. Перенос из старшего разряда отбрасывается.', eval: (i) => ({ out: (i.a + i.b) & M16 }) },
  { name: 'Inc16', project: 2, inputs: [p('in', 16)], outputs: [p('out', 16)], doc: 'out = in + 1.', eval: (i) => ({ out: (i.in + 1) & M16 }) },
  {
    name: 'ALU', project: 2,
    inputs: [p('x', 16), p('y', 16), p('zx'), p('nx'), p('zy'), p('ny'), p('f'), p('no')], outputs: [p('out', 16), p('zr'), p('ng')],
    doc: 'АЛУ Hack. По шести управляющим битам: zx — обнулить x, nx — инвертировать x, zy и ny — то же для y, f — 1: x + y, 0: x & y, no — инвертировать результат. zr = 1, если out = 0; ng = 1, если out < 0.',
    eval: (i) => {
      let x = i.zx ? 0 : i.x; if (i.nx) x = not16(x)
      let y = i.zy ? 0 : i.y; if (i.ny) y = not16(y)
      let o = i.f ? (x + y) & M16 : x & y; if (i.no) o = not16(o)
      return { out: o, zr: o === 0 ? 1 : 0, ng: bit(o, 15) }
    },
  },

  { name: 'DFF', project: 3, builtin: true, inputs: [p('in')], outputs: [p('out')], doc: 'Встроенный D-триггер: out(t) = in(t − 1). Единственный «примитив времени».', newState: () => ({ v: 0 }), eval: (_i, s) => ({ out: s.v! }), tick: (i, s) => { s.v = i.in } },
  { name: 'Bit', project: 3, inputs: [p('in'), p('load')], outputs: [p('out')], doc: 'Бит памяти: если load = 1, на следующем такте out = in, иначе хранит прежнее значение.', newState: () => ({ v: 0 }), eval: (_i, s) => ({ out: s.v! }), tick: (i, s) => { if (i.load) s.v = i.in } },
  { name: 'Register', project: 3, inputs: [p('in', 16), p('load')], outputs: [p('out', 16)], doc: '16-битный регистр: Bit для каждого разряда с общим load.', newState: () => ({ v: 0 }), eval: (_i, s) => ({ out: s.v! }), tick: (i, s) => { if (i.load) s.v = i.in & M16 } },
  ram('RAM8', 3, 3), ram('RAM64', 6, 3), ram('RAM512', 9, 3), ram('RAM4K', 12, 3), ram('RAM16K', 14, 3),
  {
    name: 'PC', project: 3, inputs: [p('in', 16), p('load'), p('inc'), p('reset')], outputs: [p('out', 16)],
    doc: 'Счётчик команд. На каждом такте: если reset — out = 0; иначе если load — out = in; иначе если inc — out = out + 1; иначе не меняется.',
    newState: () => ({ v: 0 }), eval: (_i, s) => ({ out: s.v! }),
    tick: (i, s) => { s.v = i.reset ? 0 : i.load ? i.in & M16 : i.inc ? (s.v! + 1) & M16 : s.v },
  },
]


// ─── Проект 5: компьютер Hack ───
const M15 = 0x7fff
function cpuAlu(x: number, y: number, c: number) {
  if (c & 32) x = 0; if (c & 16) x = not16(x)
  if (c & 8) y = 0; if (c & 4) y = not16(y)
  let o = c & 2 ? (x + y) & M16 : x & y
  if (c & 1) o = not16(o)
  return o
}
function cpuOut(i: Record<string, number>, s: ChipState) {
  const w = i.instruction, isC = (w >> 15) & 1
  const out = cpuAlu(s.D!, (w >> 12) & 1 ? i.inM : s.A!, (w >> 6) & 63)
  return { out, isC, w }
}
const reg = (name: string): ChipSpec => ({ name, project: 5, builtin: true, inputs: [p('in', 16), p('load')], outputs: [p('out', 16)], doc: `Встроенный 16-битный регистр (то же, что Register; отдельное имя помогает симулятору показывать регистр ${name[0]} процессора).`, newState: () => ({ v: 0 }), eval: (_i, s) => ({ out: s.v! }), tick: (i, s) => { if (i.load) s.v = i.in & M16 } })
CHIPS.push(
  reg('ARegister'), reg('DRegister'),
  { name: 'ROM32K', project: 5, builtin: true, inputs: [p('address', 15)], outputs: [p('out', 16)], doc: 'Встроенная память команд на 32K слов: out = ROM[address]. Программу в неё загружает симулятор.', newState: () => ({ rom: [] }), eval: (i, s) => ({ out: s.rom![i.address] ?? 0 }) },
  { name: 'Screen', project: 5, builtin: true, inputs: [p('in', 16), p('load'), p('address', 13)], outputs: [p('out', 16)], doc: 'Встроенная видеопамять 8K слов (512×256 точек). Работает как RAM, а её содержимое показывается на экране.', newState: () => ({ mem: new Map() }), eval: (i, s) => ({ out: s.mem!.get(i.address) ?? 0 }), tick: (i, s) => { if (i.load) s.mem!.set(i.address, i.in & M16) } },
  { name: 'Keyboard', project: 5, builtin: true, inputs: [], outputs: [p('out', 16)], doc: 'Встроенная клавиатура: out — код нажатой клавиши или 0.', newState: () => ({ key: 0 }), eval: (_i, s) => ({ out: s.key! }) },
  {
    name: 'Memory', project: 5, inputs: [p('in', 16), p('load'), p('address', 15)], outputs: [p('out', 16)],
    doc: 'Вся память данных Hack: адреса 0–16383 — RAM16K, 16384–24575 — Screen, 24576 — Keyboard. Чтение — out по address, запись — по такту при load = 1 (в клавиатуру не пишется).',
    newState: () => ({ mem: new Map(), key: 0 }),
    eval: (i, s) => ({ out: i.address === 24576 ? s.key! : i.address < 24576 ? s.mem!.get(i.address) ?? 0 : 0 }),
    tick: (i, s) => { if (i.load && i.address < 24576) s.mem!.set(i.address, i.in & M16) },
  },
  {
    name: 'CPU', project: 5,
    inputs: [p('inM', 16), p('instruction', 16), p('reset')], outputs: [p('outM', 16), p('writeM'), p('addressM', 15), p('pc', 15)],
    doc: 'Процессор Hack. Выполняет instruction: A-инструкция кладёт число в A; C-инструкция считает в АЛУ (вход y — A или inM по биту a), пишет результат в A/D/M по битам d1–d3 и при выполнении условия j1–j3 переходит по адресу A. outM и writeM — запись в память по адресу addressM = A. pc — адрес следующей инструкции; reset = 1 обнуляет pc.',
    newState: () => ({ A: 0, D: 0, PC: 0 }),
    relevant: (w) => (w.writeM ? ['outM', 'writeM', 'addressM', 'pc'] : ['writeM', 'addressM', 'pc']),
    eval: (i, s) => { const { out, isC, w } = cpuOut(i, s); return { outM: out, writeM: isC & (w >> 3) & 1, addressM: s.A! & M15, pc: s.PC! & M15 } },
    tick: (i, s) => {
      const { out, isC, w } = cpuOut(i, s)
      const neg = (out >> 15) & 1, zero = out === 0 ? 1 : 0, pos = !neg && !zero ? 1 : 0
      const jump = isC && (((w >> 2) & 1 & neg) | ((w >> 1) & 1 & zero) | (w & 1 & pos))
      const oldA = s.A!
      s.PC = i.reset ? 0 : jump ? oldA & M15 : (s.PC! + 1) & M15
      if (!isC) s.A = w
      else { if ((w >> 5) & 1) s.A = out; if ((w >> 4) & 1) s.D = out }
    },
  },
  { name: 'Computer', project: 5, inputs: [p('reset')], outputs: [], doc: 'Весь компьютер Hack: ROM32K, CPU и Memory. При reset = 1 программа начинается с адреса 0. Выходов нет — результат виден в памяти и на экране.', newState: () => ({}), eval: () => ({}), tick: () => {} },
)

export const chipByName = (n: string) => CHIPS.find((c) => c.name === n)
/** Чипы, которые ученик собирает сам (Nand и DFF — встроенные). */
export const BUILDABLE = CHIPS.filter((c) => !c.builtin)
export const isSequential = (c: ChipSpec) => !!c.tick

/** Заготовка HDL-файла: интерфейс задан, PARTS пишет ученик. */
export function skeleton(c: ChipSpec): string {
  const pins = (ps: Pin[]) => ps.map((x) => (x.width > 1 ? `${x.name}[${x.width}]` : x.name)).join(', ')
  return `// ${c.doc}\nCHIP ${c.name} {\n    IN ${pins(c.inputs)};\n${c.outputs.length ? `    OUT ${pins(c.outputs)};\n` : ''}\n    PARTS:\n    // Твоя реализация\n}\n`
}
