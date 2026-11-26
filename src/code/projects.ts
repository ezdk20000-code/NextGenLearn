// Программные проекты CS1 (6, 7, 8, 10, 11): этапы, тестовые программы и проверки.
// Решение ученика — функция на JavaScript; проверки сравнивают её результат с эталоном
// или запускают результат на эмуляторе Hack / ВМ и сравнивают поведение.

import { assemble, newMachine, runUntilHalt, toBin } from '../hack/hack'
import { compileProgram, parse as jackParse, tokenize, tokensXml } from '../jack/jack'
import { Vm } from '../vm/vm'
import { OS, osText, setInput } from '../vm/os'
import { translate } from '../vm/translator'

export interface Diff { line: number; want: string; got: string; note?: string }
export interface Verdict { ok: boolean; msg: string; diff?: Diff[] }
export interface TestCase { name: string; input: unknown[]; check: (output: unknown) => Verdict }
export interface Stage { id: string; title: string; tests: TestCase[] }
export interface CodeProject { id: string; title: string; fn: string; signature: string; starter: string; stages: Stage[]; hints: string[] }

const lines = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : String(x ?? '').split('\n')).map((s) => s.trim()).filter(Boolean)

/** Построчное сравнение (пробелы внутри строк не важны). */
function compareLines(want: string[], got: string[], label: (i: number) => string | undefined = () => undefined): Verdict {
  const norm = (s: string) => s.replace(/\s+/g, '')
  for (let i = 0; i < Math.max(want.length, got.length); i++) {
    if (norm(want[i] ?? '') !== norm(got[i] ?? '')) {
      const diff: Diff[] = []
      for (let k = Math.max(0, i - 2); k < Math.min(Math.max(want.length, got.length), i + 3); k++) diff.push({ line: k, want: want[k] ?? '—', got: got[k] ?? '—', note: k === i ? label(k) : undefined })
      return { ok: false, msg: `Строка ${i}: ожидалось «${want[i] ?? 'конец вывода'}», получено «${got[i] ?? 'конец вывода'}».`, diff }
    }
  }
  return { ok: true, msg: `Совпадают все ${want.length} строк.` }
}

// ─── Проект 6: ассемблер ───
const ADD = '// 2 + 3 → RAM[0]\n@2\nD=A\n@3\nD=D+A\n@0\nM=D\n'
const MAX_L = '// max(RAM[0], RAM[1]) → RAM[2], без символов\n@0\nD=M\n@1\nD=D-M\n@10\nD;JGT\n@1\nD=M\n@12\n0;JMP\n@0\nD=M\n@2\nM=D\n@14\n0;JMP\n'
const MAX = '// max с метками\n@R0\nD=M\n@R1\nD=D-M\n@FIRST\nD;JGT\n@R1\nD=M\n@OUTPUT\n0;JMP\n(FIRST)\n@R0\nD=M\n(OUTPUT)\n@R2\nM=D\n(END)\n@END\n0;JMP\n'
const RECT = '// прямоугольник 16 пикселей шириной и RAM[0] строк\n@0\nD=M\n@INFINITE_LOOP\nD;JLE\n@counter\nM=D\n@SCREEN\nD=A\n@address\nM=D\n(LOOP)\n@address\nA=M\nM=-1\n@address\nD=M\n@32\nD=D+A\n@address\nM=D\n@counter\nMD=M-1\n@LOOP\nD;JGT\n(INFINITE_LOOP)\n@INFINITE_LOOP\n0;JMP\n'
const BIG_JACK = `class Main {
  function void main() { var int i, s; var Array a; let a = Array.new(20); let i = 0;
    while (i < 20) { let a[i] = Main.square(i) - (i * 3); let i = i + 1; }
    let s = 0; let i = 0; while (i < 20) { if (a[i] > 10) { let s = s + a[i]; } else { let s = s - 1; } let i = i + 1; }
    do Output.printInt(s); return; }
  function int square(int x) { return x * x; }
}`
/** Большая программа: Jack → ВМ → ассемблер эталонными инструментами (≈ тысячи строк). */
export const bigAsm = () => translate(compileProgram({ Main: BIG_JACK }), true)

function asmTest(name: string, src: () => string): TestCase {
  return {
    name, input: [],
    check: (out) => {
      const s = src()
      const ref = assemble(s)
      const srcLines = ref.rom.map((r) => r.text)
      return compareLines(ref.rom.map((r) => toBin(r.code)), lines(out), (i) => (srcLines[i] ? `инструкция: ${srcLines[i]}` : undefined))
    },
  }
}
const withInput = (t: TestCase, src: () => string): TestCase => ({ ...t, get input() { return [src()] } })

export const P6: CodeProject = {
  id: 'cs1-p6', title: 'Ассемблер Hack', fn: 'assemble', signature: 'assemble(source: string): string[]',
  starter: `// Проект 6. Верни массив строк — по 16-битному машинному слову на инструкцию.
// Таблицы спецификации Hack (comp, dest, jump) составь сам по книге.

export function assemble(source) {
  const result = []
  for (const raw of source.split('\\n')) {
    const line = raw.replace(/\\/\\/.*$/, '').trim()
    if (!line) continue
    // TODO: A-инструкция, C-инструкция, метки и переменные
  }
  return result
}
`,
  stages: [
    { id: 's1', title: '1. Без символов', tests: [withInput(asmTest('Add.asm', () => ADD), () => ADD), withInput(asmTest('MaxL.asm', () => MAX_L), () => MAX_L)] },
    { id: 's2', title: '2. Метки и переменные', tests: [withInput(asmTest('Max.asm', () => MAX), () => MAX), withInput(asmTest('Rect.asm', () => RECT), () => RECT)] },
    { id: 's3', title: '3. Большая программа', tests: [withInput(asmTest('Program.asm (Jack → ВМ → asm)', bigAsm), bigAsm)] },
  ],
  hints: [
    'Сначала сделай этап 1: A-инструкция — это 0 и 15 бит числа (toString(2).padStart(16, "0")). C-инструкция — "111" + a + c1..c6 + d1d2d3 + j1j2j3.',
    'Раздели C-инструкцию на части: dest — до «=», jump — после «;», остальное — comp. Бит a = 1, если в comp есть M.',
    'Метки и переменные — два прохода. Первый: считай адреса инструкций и запоминай (LABEL) → адрес. Второй: @symbol — ищи в таблице, если нет — новая переменная с адреса 16.',
  ],
}

// ─── Проекты 7–8: транслятор ВМ ───
interface VmCase { name: string; files: Record<string, string>; init?: Record<number, number>; boot: boolean; cycles: number; check: number[] }
const VM_INIT = { 0: 256, 1: 300, 2: 400, 3: 3000, 4: 3010 }
export const VM_CASES: Record<string, VmCase> = {
  SimpleAdd: { name: 'SimpleAdd', files: { SimpleAdd: 'push constant 7\npush constant 8\nadd\n' }, init: VM_INIT, boot: false, cycles: 60, check: [0, 256] },
  StackTest: { name: 'StackTest', files: { StackTest: 'push constant 17\npush constant 17\neq\npush constant 17\npush constant 16\neq\npush constant 892\npush constant 891\nlt\npush constant 32767\npush constant 32766\ngt\npush constant 57\npush constant 31\npush constant 53\nadd\npush constant 112\nsub\nneg\nand\npush constant 82\nor\nnot\n' }, init: VM_INIT, boot: false, cycles: 1000, check: [0, 256, 257, 258, 259, 260] },
  BasicTest: { name: 'BasicTest', files: { BasicTest: 'push constant 10\npop local 0\npush constant 21\npush constant 22\npop argument 2\npop argument 1\npush constant 36\npop this 6\npush constant 42\npush constant 45\npop that 5\npop that 2\npush constant 510\npop temp 6\npush local 0\npush that 5\nadd\npush argument 1\nsub\npush this 6\npush this 6\nadd\nsub\npush temp 6\nadd\n' }, init: VM_INIT, boot: false, cycles: 1000, check: [0, 256, 300, 401, 402, 3006, 3012, 3015, 11] },
  PointerTest: { name: 'PointerTest', files: { PointerTest: 'push constant 3030\npop pointer 0\npush constant 3040\npop pointer 1\npush constant 32\npop this 2\npush constant 46\npop that 6\npush pointer 0\npush pointer 1\nadd\npush this 2\nsub\npush that 6\nadd\n' }, init: VM_INIT, boot: false, cycles: 1000, check: [0, 256, 3, 4, 3032, 3046] },
  StaticTest: { name: 'StaticTest', files: { StaticTest: 'push constant 111\npush constant 333\npush constant 888\npop static 8\npop static 3\npop static 1\npush static 3\npush static 1\nsub\npush static 8\nadd\n' }, init: VM_INIT, boot: false, cycles: 1000, check: [0, 256] },
  BasicLoop: { name: 'BasicLoop', files: { BasicLoop: 'push constant 0\npop local 0\nlabel LOOP\npush argument 0\npush local 0\nadd\npop local 0\npush argument 0\npush constant 1\nsub\npop argument 0\npush argument 0\nif-goto LOOP\npush local 0\n' }, init: { ...VM_INIT, 400: 3 }, boot: false, cycles: 2000, check: [0, 256] },
  FibonacciSeries: { name: 'FibonacciSeries', files: { FibonacciSeries: 'push argument 1\npop pointer 1\npush constant 0\npop that 0\npush constant 1\npop that 1\npush argument 0\npush constant 2\nsub\npop argument 0\nlabel LOOP\npush argument 0\nif-goto COMPUTE\ngoto END\nlabel COMPUTE\npush that 0\npush that 1\nadd\npop that 2\npush pointer 1\npush constant 1\nadd\npop pointer 1\npush argument 0\npush constant 1\nsub\npop argument 0\ngoto LOOP\nlabel END\n' }, init: { ...VM_INIT, 400: 6, 401: 3000 }, boot: false, cycles: 5000, check: [3000, 3001, 3002, 3003, 3004, 3005] },
  NestedCall: { name: 'NestedCall', files: { Sys: 'function Sys.init 0\npush constant 4000\npop pointer 0\npush constant 5000\npop pointer 1\ncall Sys.main 0\npop temp 1\nlabel LOOP\ngoto LOOP\nfunction Sys.main 5\npush constant 4001\npop pointer 0\npush constant 5001\npop pointer 1\npush constant 200\npop local 1\npush constant 40\npop local 2\npush constant 6\npop local 3\npush constant 123\ncall Sys.add12 1\npop temp 0\npush local 0\npush local 1\npush local 2\npush local 3\npush local 4\nadd\nadd\nadd\nadd\nreturn\nfunction Sys.add12 0\npush constant 4002\npop pointer 0\npush constant 5002\npop pointer 1\npush argument 0\npush constant 12\nadd\nreturn\n' }, boot: true, cycles: 4000, check: [0, 3, 4, 5, 6] },
  FibonacciElement: { name: 'FibonacciElement', files: { Main: 'function Main.fibonacci 0\npush argument 0\npush constant 2\nlt\nif-goto IF_TRUE\ngoto IF_FALSE\nlabel IF_TRUE\npush argument 0\nreturn\nlabel IF_FALSE\npush argument 0\npush constant 2\nsub\ncall Main.fibonacci 1\npush argument 0\npush constant 1\nsub\ncall Main.fibonacci 1\nadd\nreturn\n', Sys: 'function Sys.init 0\npush constant 7\ncall Main.fibonacci 1\npop temp 0\nlabel WHILE\ngoto WHILE\n' }, boot: true, cycles: 20000, check: [0, 5] },
  StaticsTest: { name: 'StaticsTest', files: { Class1: 'function Class1.set 0\npush argument 0\npop static 0\npush argument 1\npop static 1\npush constant 0\nreturn\nfunction Class1.get 0\npush static 0\npush static 1\nsub\nreturn\n', Class2: 'function Class2.set 0\npush argument 0\npop static 0\npush argument 1\npop static 1\npush constant 0\nreturn\nfunction Class2.get 0\npush static 0\npush static 1\nsub\nreturn\n', Sys: 'function Sys.init 0\npush constant 6\npush constant 8\ncall Class1.set 2\npop temp 0\npush constant 23\npush constant 15\ncall Class2.set 2\npop temp 0\ncall Class1.get 0\npop temp 1\ncall Class2.get 0\npop temp 2\nlabel WHILE\ngoto WHILE\n' }, boot: true, cycles: 5000, check: [0, 6, 7] },
}

/** Эталон: тот же ВМ-код на интерпретаторе. */
function vmReference(c: VmCase) {
  const vm = new Vm(c.files, {})
  if (c.init) Object.entries(c.init).forEach(([a, v]) => { vm.ram[Number(a)] = v })
  if (c.boot) vm.boot()
  vm.run(c.cycles * 4)
  return vm.ram
}

function vmTest(key: string): TestCase {
  const c = VM_CASES[key]
  return {
    name: `${c.name}.vm`, input: [c.files, c.boot],
    check: (out) => {
      const asm = assemble(String(out ?? ''))
      if (asm.errors.length) return { ok: false, msg: `Твой вывод не собирается ассемблером: ${asm.errors[0]}` }
      const m = newMachine()
      if (c.init) Object.entries(c.init).forEach(([a, v]) => { m.ram[Number(a)] = v })
      runUntilHalt(m, asm.rom, c.cycles * 30)
      const ref = vmReference(c)
      const diff: Diff[] = []
      for (const a of c.check) { const w = ref[a], g = (m.ram[a] << 16) >> 16; if (w !== g) diff.push({ line: a, want: String(w), got: String(g), note: a === 0 ? 'SP' : a < 5 ? ['SP', 'LCL', 'ARG', 'THIS', 'THAT'][a] : a < 13 ? `temp ${a - 5}` : undefined }) }
      if (diff.length) return { ok: false, msg: `После выполнения не совпали ячейки RAM: ${diff.map((d) => `RAM[${d.line}] = ${d.got}, нужно ${d.want}`).join('; ')}.`, diff }
      return { ok: true, msg: `Совпали RAM[${c.check.join('], RAM[')}] после выполнения на эмуляторе Hack.` }
    },
  }
}

export const P7: CodeProject = {
  id: 'cs1-p7', title: 'Транслятор ВМ, часть 1', fn: 'translate', signature: 'translate(files: {[имя]: текст .vm}, bootstrap: boolean): string',
  starter: `// Проект 7. Переведи ВМ-код в ассемблер Hack. files — объект { ИмяФайла: текст }.
// bootstrap пока всегда false. Верни текст на ассемблере.

export function translate(files, bootstrap) {
  const out = []
  for (const [file, text] of Object.entries(files)) {
    for (const raw of text.split('\\n')) {
      const line = raw.replace(/\\/\\/.*$/, '').trim()
      if (!line) continue
      const [op, segment, index] = line.split(/\\s+/)
      // TODO: push constant, арифметика, затем сегменты памяти
    }
  }
  return out.join('\\n')
}
`,
  stages: [
    { id: 's1', title: '1. Стек и арифметика', tests: [vmTest('SimpleAdd'), vmTest('StackTest')] },
    { id: 's2', title: '2. Сегменты памяти', tests: [vmTest('BasicTest'), vmTest('PointerTest'), vmTest('StaticTest')] },
  ],
  hints: [
    'push constant x: @x, D=A, затем «положить D на стек»: @SP, A=M, M=D, @SP, M=M+1. Оформи это функцией-помощником.',
    'eq/gt/lt требуют меток: вычисли D = x − y, положи −1 (истина) и перепрыгни запись 0, если условие выполнено. Метки делай уникальными счётчиком.',
    'local/argument/this/that: адрес = базовый регистр + i. temp i — RAM[5 + i], pointer 0/1 — THIS/THAT, static i — символ Файл.i.',
  ],
}

export const P8: CodeProject = {
  id: 'cs1-p8', title: 'Транслятор ВМ, часть 2', fn: 'translate', signature: 'translate(files, bootstrap): string',
  starter: '// Проект 8. Продолжи свой транслятор из проекта 7: label, goto, if-goto,\n// function, call, return и загрузочный код (SP = 256, call Sys.init), если bootstrap = true.\n\nexport function translate(files, bootstrap) {\n  // вставь сюда код из проекта 7 и расширь его\n  return \'\'\n}\n',
  stages: [
    { id: 's1', title: '1. Ветвления', tests: [vmTest('BasicLoop'), vmTest('FibonacciSeries')] },
    { id: 's2', title: '2. Функции и вызовы', tests: [vmTest('NestedCall'), vmTest('FibonacciElement'), vmTest('StaticsTest')] },
  ],
  hints: [
    'label X внутри функции f пиши как (f$X) — так метки разных функций не столкнутся. goto — @f$X, 0;JMP; if-goto — снять со стека и D;JNE.',
    'call f n: положи адрес возврата (уникальная метка), LCL, ARG, THIS, THAT; ARG = SP − 5 − n; LCL = SP; goto f; затем (метка возврата).',
    'return: frame = LCL; ret = *(frame − 5); *ARG = pop(); SP = ARG + 1; THAT, THIS, ARG, LCL = *(frame − 1…4); goto ret. Сохрани ret до перезаписи!',
  ],
}

// ─── Проект 10: синтаксический анализатор ───
export const JACK_SAMPLES: Record<string, string> = {
  Main: `// Главный класс игры
class Main {
    function void main() {
        var SquareGame game;
        let game = SquareGame.new();
        do game.run();
        do game.dispose();
        return;
    }
}`,
  SquareGame: `class SquareGame {
    field Square square;
    field int direction;
    constructor SquareGame new() {
        let square = Square.new(0, 0, 30);
        let direction = 0;
        return this;
    }
    method void dispose() { do square.dispose(); do Memory.deAlloc(this); return; }
    method void moveSquare() {
        if (direction = 1) { do square.moveUp(); }
        if (direction = 2) { do square.moveDown(); }
        do Sys.wait(5);
        return;
    }
    method void run() {
        var char key; var boolean exit;
        let exit = false;
        while (~exit) {
            while (key = 0) { let key = Keyboard.keyPressed(); do moveSquare(); }
            if (key = 81) { let exit = true; }
            if (key = 131) { let direction = 1; } else { let direction = 2; }
            while (~(key = 0)) { let key = Keyboard.keyPressed(); do moveSquare(); }
        }
        return;
    }
}`,
  ArrayTest: `class ArrayTest {
    function int sum(Array a, int n) {
        var int i, s;
        let i = 0; let s = 0;
        while (i < n) { let s = s + a[i]; let i = i + 1; }
        do Output.printString("sum is ");
        return -s * (2 + a[n - 1]) / 2;
    }
}`,
}
const xmlTest = (name: string, src: string, kind: 'tokens' | 'tree'): TestCase => ({
  name: `${name}${kind === 'tokens' ? 'T' : ''}.xml`, input: [src],
  check: (out) => compareLines(lines(kind === 'tokens' ? tokensXml(tokenize(src, name)) : jackParse(src, name).xml), lines(out)),
})
export const P10: CodeProject = {
  id: 'cs1-p10', title: 'Синтаксический анализатор Jack', fn: 'analyze', signature: 'analyze(source: string, mode: "tokens" | "tree"): string',
  starter: `// Проект 10. mode = "tokens" — XML со списком токенов, mode = "tree" — XML-дерево разбора.
// Формат: <tokens> … </tokens>, каждый токен: <keyword> class </keyword>, символы < > & " экранируются.

export function analyze(source, mode) {
  // TODO: токенизатор, затем компилятор-разборщик рекурсивным спуском
  return ''
}
`,
  stages: [
    { id: 's1', title: '1. Токенизатор', tests: Object.entries(JACK_SAMPLES).map(([n, s]) => ({ ...xmlTest(n, s, 'tokens'), input: [s, 'tokens'] })) },
    { id: 's2', title: '2. Дерево разбора', tests: Object.entries(JACK_SAMPLES).map(([n, s]) => ({ ...xmlTest(n, s, 'tree'), input: [s, 'tree'] })) },
  ],
  hints: [
    'Токенизатор: пропусти пробелы и комментарии (// и /* */), затем по первому символу реши: символ из «{}()[].,;+-*/&|<>=~», число, строка в кавычках, слово (ключевое слово или идентификатор).',
    'Дерево: по функции на каждое правило грамматики (compileClass, compileStatements, compileExpression…). Каждая открывает свой тег, разбирает части и закрывает тег. Отступ — 2 пробела на уровень.',
    'Ловушка term: после идентификатора смотри на следующий токен: «[» — массив, «(» или «.» — вызов подпрограммы, иначе — переменная.',
  ],
}

// ─── Проект 11: компилятор ───
interface JackCase { name: string; files: Record<string, string>; input?: string }
export const JACK_CASES: JackCase[] = [
  { name: 'Seven', files: { Main: 'class Main { function void main() { do Output.printInt(1 + (2 * 3)); return; } }' } },
  { name: 'ConvertToBin', files: { Main: 'class Main {\n function void main() { var int v, i, mask; let v = 13; let i = 0; let mask = 1;\n  while (i < 8) { if (~((v & mask) = 0)) { do Memory.poke(8000 + i, 1); } else { do Memory.poke(8000 + i, 0); } let mask = mask + mask; let i = i + 1; }\n  do Output.printInt(Memory.peek(8000) + Memory.peek(8002) + Memory.peek(8003)); return; } }' } },
  { name: 'Average', input: '3\n10\n20\n31\n', files: { Main: 'class Main {\n function void main() { var Array a; var int n, i, sum; let n = Keyboard.readInt("How many? "); let a = Array.new(n); let i = 0; let sum = 0;\n  while (i < n) { let a[i] = Keyboard.readInt("Next: "); let sum = sum + a[i]; let i = i + 1; }\n  do Output.printString("Average: "); do Output.printInt(sum / n); return; } }' } },
  { name: 'Objects', files: { Main: 'class Main { function void main() { var Counter c; let c = Counter.new(5); do c.inc(); do c.inc(); do Output.printInt(c.get()); do Output.printString(" "); do Output.printInt(Counter.created()); return; } }', Counter: 'class Counter { field int value; static int count;\n constructor Counter new(int start) { let value = start; let count = count + 1; return this; }\n method void inc() { let value = value + 1; return; }\n method int get() { return value; }\n function int created() { return count; } }' } },
  { name: 'Square', files: { Main: 'class Main { function void main() { do Screen.setColor(true); do Screen.drawRectangle(10, 10, 60, 40); do Screen.setColor(false); do Screen.drawRectangle(20, 20, 30, 30); return; } }' } },
]
function runJack(vmFiles: Record<string, string>, input?: string) {
  const vm = new Vm(vmFiles, OS)
  if (input) setInput(vm, input)
  vm.boot(); vm.run(3_000_000)
  let screen = 0
  for (let a = 16384; a < 24576; a++) screen = (Math.imul(screen, 31) + vm.ram[a]) | 0
  return { text: osText(vm).trimEnd(), screen, halted: vm.halted }
}
const jackTest = (c: JackCase): TestCase => ({
  name: c.name, input: [c.files],
  check: (out) => {
    let got
    try { got = runJack(out as Record<string, string>, c.input) } catch (e) { return { ok: false, msg: `Твой ВМ-код упал при выполнении: ${(e as Error).message}` } }
    const want = runJack(compileProgram(c.files), c.input)
    if (!got.halted) return { ok: false, msg: 'Программа не завершилась (нет return в Main.main или бесконечный цикл).' }
    if (got.text !== want.text) return { ok: false, msg: 'Вывод на экран отличается.', diff: [{ line: 0, want: want.text.split('\n')[0], got: got.text.split('\n')[0] }] }
    if (got.screen !== want.screen) return { ok: false, msg: 'Изображение на экране отличается от эталона.' }
    return { ok: true, msg: 'Программа работает так же, как скомпилированная эталонным компилятором.' }
  },
})
export const P11: CodeProject = {
  id: 'cs1-p11', title: 'Компилятор Jack', fn: 'compile', signature: 'compile(files: {[Класс]: исходник Jack}): {[Класс]: ВМ-код}',
  starter: `// Проект 11. Расширь анализатор из проекта 10: вместо XML генерируй ВМ-код.
// Верни объект { ИмяКласса: текст .vm }. Проверка запускает твой ВМ-код со встроенной ОС.

export function compile(files) {
  const result = {}
  for (const [name, source] of Object.entries(files)) {
    result[name] = '' // TODO: таблицы символов и генерация кода
  }
  return result
}
`,
  stages: [
    { id: 's1', title: '1. Выражения и функции', tests: [jackTest(JACK_CASES[0]), jackTest(JACK_CASES[1])] },
    { id: 's2', title: '2. Массивы и ввод', tests: [jackTest(JACK_CASES[2])] },
    { id: 's3', title: '3. Объекты и экран', tests: [jackTest(JACK_CASES[3]), jackTest(JACK_CASES[4])] },
  ],
  hints: [
    'Две таблицы символов: класса (static, field) и подпрограммы (argument, local). У method аргумент 0 — this, поэтому параметры нумеруются с 1.',
    'Выражение — обход в обратной польской записи: term, term, оператор. * и / — вызовы Math.multiply 2 и Math.divide 2. true — push constant 0, not.',
    'Метод: push argument 0, pop pointer 0. Конструктор: push constant <полей>, call Memory.alloc 1, pop pointer 0. a[i]: push a, push i, add, pop pointer 1, push that 0.',
  ],
}

export const CODE_PROJECTS: Record<string, CodeProject> = { 'cs1-p6': P6, 'cs1-p7': P7, 'cs1-p8': P8, 'cs1-p10': P10, 'cs1-p11': P11 }
