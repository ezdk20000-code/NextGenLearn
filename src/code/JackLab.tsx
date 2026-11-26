import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import CodeEditor from '../components/CodeEditor'
import { compileProgram, JackError } from '../jack/jack'
import { Vm } from '../vm/vm'
import { OS, osText } from '../vm/os'
import { VmScreen } from '../vm/VmView'

// ─── Проект 12: ОС на Jack. Тестовые программы используют класс ученика вместо встроенного. ───
export interface OsStage { cls: string; title: string; starter: string; tests: { name: string; main: string }[]; doc: string }
const T = (body: string) => `class Main { function void main() { ${body} return; } }`
export const OS_STAGES: OsStage[] = [
  { cls: 'Math', title: 'Math', doc: 'multiply, divide, sqrt, abs, min, max — без встроенных * и / (в Jack они сами вызывают Math.multiply и Math.divide!). Используй сдвиги через сложение и двоичный поиск для sqrt.',
    starter: 'class Math {\n  /** Возвращает |x|. */\n  function int abs(int x) { if (x < 0) { return -x; } return x; }\n\n  /** x * y сдвигами и сложениями. */\n  function int multiply(int x, int y) {\n    // TODO\n    return 0;\n  }\n\n  function int divide(int x, int y) { return 0; }\n  function int sqrt(int x) { return 0; }\n  function int max(int a, int b) { if (a > b) { return a; } return b; }\n  function int min(int a, int b) { if (a < b) { return a; } return b; }\n}\n',
    tests: [
      { name: 'multiply', main: T('do Output.printInt(Math.multiply(7, 6)); do Output.printString(" "); do Output.printInt(Math.multiply(-12, 11)); do Output.printString(" "); do Output.printInt(Math.multiply(181, 181)); do Output.printString(" "); do Output.printInt(Math.multiply(0, 99));') },
      { name: 'divide', main: T('do Output.printInt(Math.divide(100, 7)); do Output.printString(" "); do Output.printInt(Math.divide(-91, 7)); do Output.printString(" "); do Output.printInt(Math.divide(32767, 2)); do Output.printString(" "); do Output.printInt(Math.divide(5, 9));') },
      { name: 'sqrt, min, max, abs', main: T('do Output.printInt(Math.sqrt(10000)); do Output.printString(" "); do Output.printInt(Math.sqrt(32767)); do Output.printString(" "); do Output.printInt(Math.sqrt(2)); do Output.printString(" "); do Output.printInt(Math.max(-5, 3)); do Output.printInt(Math.min(-5, 3)); do Output.printInt(Math.abs(-77));') },
    ] },
  { cls: 'String', title: 'String', doc: 'Строка — объект с полями: массив символов, длина, вместимость. new, dispose, length, charAt, setCharAt, appendChar, eraseLastChar, intValue, setInt, newLine (128), backSpace (129), doubleQuote (34).',
    starter: 'class String {\n  field Array chars;\n  field int length, maxLength;\n\n  constructor String new(int maxLen) {\n    // TODO\n    return this;\n  }\n  method void dispose() { return; }\n  method int length() { return length; }\n  method char charAt(int j) { return chars[j]; }\n  method void setCharAt(int j, char c) { return; }\n  method String appendChar(char c) { return this; }\n  method void eraseLastChar() { return; }\n  method int intValue() { return 0; }\n  method void setInt(int val) { return; }\n  function char newLine() { return 128; }\n  function char backSpace() { return 129; }\n  function char doubleQuote() { return 34; }\n}\n',
    tests: [
      { name: 'appendChar, length, charAt', main: T('var String s; let s = String.new(10); do s.appendChar(72); do s.appendChar(105); do Output.printInt(s.length()); do Output.printString(" "); do Output.printInt(s.charAt(1));') },
      { name: 'строковые константы', main: T('do Output.printString("Hello, Jack!");') },
      { name: 'setInt, intValue, eraseLastChar', main: T('var String s; let s = String.new(8); do s.setInt(-1234); do Output.printInt(s.intValue() + 1); do s.eraseLastChar(); do Output.printString(" "); do Output.printInt(s.length()); do Output.printString(" "); do Output.printInt(String.newLine());') },
    ] },
  { cls: 'Memory', title: 'Memory', doc: 'peek, poke, alloc, deAlloc. Куча — адреса 2048…16383. Простейший рабочий вариант: список свободных блоков (free list). Тест использует только Memory напрямую.',
    starter: 'class Memory {\n  static Array ram;\n  static int free;\n\n  function void init() { let ram = 0; let free = 2048; return; }\n  function int peek(int address) { return ram[address]; }\n  function void poke(int address, int value) { let ram[address] = value; return; }\n  function int alloc(int size) {\n    // TODO: найди свободный блок нужного размера\n    return 0;\n  }\n  function void deAlloc(int o) { return; }\n}\n',
    tests: [
      { name: 'alloc / poke / peek', main: T('var int a, b; do Memory.init(); let a = Memory.alloc(10); let b = Memory.alloc(5); do Memory.poke(a + 9, 111); do Memory.poke(b, 222); do Output.printInt(Memory.peek(a + 9) + Memory.peek(b)); if ((a < 2048) | (b < 2048) | ((b > a) & (b < (a + 10)))) { do Output.printString(" BAD"); }') },
      { name: 'deAlloc и повторное использование', main: T('var int i, p; do Memory.init(); let i = 0; while (i < 300) { let p = Memory.alloc(40); do Memory.poke(p, i); do Memory.deAlloc(p); let i = i + 1; } do Output.printString("ok");') },
    ] },
  { cls: 'Screen', title: 'Screen', doc: 'clearScreen, setColor, drawPixel, drawLine, drawRectangle, drawCircle. Пиксель (x, y) — бит x % 16 слова 16384 + 32·y + x / 16. Линию рисуй алгоритмом из книги, круг — горизонтальными линиями.',
    starter: 'class Screen {\n  static boolean color;\n  function void init() { let color = true; return; }\n  function void clearScreen() { return; }\n  function void setColor(boolean b) { let color = b; return; }\n  function void drawPixel(int x, int y) {\n    // TODO: адрес слова и маска бита\n    return;\n  }\n  function void drawLine(int x1, int y1, int x2, int y2) { return; }\n  function void drawRectangle(int x1, int y1, int x2, int y2) { return; }\n  function void drawCircle(int x, int y, int r) { return; }\n}\n',
    tests: [
      { name: 'drawPixel, drawRectangle', main: T('do Screen.init(); do Screen.setColor(true); do Screen.drawPixel(0, 0); do Screen.drawPixel(511, 255); do Screen.drawRectangle(100, 50, 140, 80); do Screen.setColor(false); do Screen.drawPixel(110, 60);') },
      { name: 'drawLine (все направления)', main: T('do Screen.init(); do Screen.setColor(true); do Screen.drawLine(10, 10, 200, 10); do Screen.drawLine(10, 20, 10, 120); do Screen.drawLine(20, 20, 120, 70); do Screen.drawLine(300, 200, 250, 100);') },
      { name: 'drawCircle', main: T('do Screen.init(); do Screen.setColor(true); do Screen.drawCircle(256, 128, 40);') },
    ] },
]

function run(files: Record<string, string>, steps = 4_000_000) {
  const vm = new Vm(compileProgram(files), OS)
  vm.boot(); vm.run(steps)
  let screen = 0
  for (let a = 16384; a < 24576; a++) screen = (Math.imul(screen, 31) + vm.ram[a]) | 0
  return { vm, text: osText(vm).trimEnd(), screen }
}

/** Проверка класса ОС ученика: та же тестовая программа со встроенной ОС и с его классом. */
export function checkOsClass(stage: OsStage, src: string) {
  return stage.tests.map((t) => {
    try {
      const want = run({ Main: t.main })
      const got = run({ Main: t.main, [stage.cls]: src })
      if (!got.vm.halted) return { name: t.name, ok: false, msg: 'Программа не завершилась: бесконечный цикл или слишком медленный алгоритм.' }
      if (got.text !== want.text) return { name: t.name, ok: false, msg: `Вывод «${got.text.split('\n')[0].trim()}», а нужно «${want.text.split('\n')[0].trim()}».` }
      if (got.screen !== want.screen) return { name: t.name, ok: false, msg: 'Картинка на экране отличается от эталона.' }
      return { name: t.name, ok: true, msg: 'Совпадает со встроенной ОС.' }
    } catch (e) { return { name: t.name, ok: false, msg: (e as Error).message } }
  })
}

const KEY = 'ngl-jack-v1'
const load = (): Record<string, Record<string, string>> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }
const save = (s: Record<string, Record<string, string>>) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* */ } }

const GAME_START = {
  Main: `/** Проект 9: твоя программа на Jack. Пример — квадрат, который двигается стрелками. */
class Main {
  function void main() {
    var int x, y, key;
    let x = 240; let y = 112;
    do Output.printString("Arrows: move, q: quit");
    while (~(key = 81)) {
      do Screen.setColor(true);
      do Screen.drawRectangle(x, y, x + 20, y + 20);
      let key = Keyboard.keyPressed();
      do Screen.setColor(false);
      do Screen.drawRectangle(x, y, x + 20, y + 20);
      if ((key = 130) & (x > 2)) { let x = x - 2; }
      if ((key = 132) & (x < 489)) { let x = x + 2; }
      if ((key = 131) & (y > 14)) { let y = y - 2; }
      if ((key = 133) & (y < 233)) { let y = y + 2; }
    }
    return;
  }
}
`,
}
const KEYMAP: Record<string, number> = { ArrowLeft: 130, ArrowUp: 131, ArrowRight: 132, ArrowDown: 133, Enter: 128, Backspace: 129, Escape: 140 }

/** Jack-среда: редактор классов, компиляция, запуск на ВМ с экраном и клавиатурой. */
export default function JackLab({ mode, onDone }: { mode: 'game' | 'os'; onDone: (mistakes: number) => void }) {
  const [store, setStore] = useState(load)
  const [stageI, setStageI] = useState(0)
  const stage = OS_STAGES[stageI]
  const files: Record<string, string> = mode === 'game' ? (store.game ?? GAME_START) : { [stage.cls]: store.os?.[stage.cls] ?? stage.starter }
  const names = Object.keys(files)
  const [tab, setTab] = useState(names[0])
  const active = files[tab] !== undefined ? tab : names[0]
  const vmRef = useRef<Vm | null>(null)
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [results, setResults] = useState<ReturnType<typeof checkOsClass> | null>(null)
  const [solved, setSolved] = useState<string[]>(() => (store.solved ? Object.keys(store.solved) : []))
  const [ran, setRan] = useState(false)

  const update = (name: string, v: string) => {
    const s = { ...store }
    if (mode === 'game') s.game = { ...files, [name]: v }
    else s.os = { ...(s.os ?? {}), [name]: v }
    setStore(s); save(s); setResults(null)
  }
  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = () => {
      const v = vmRef.current
      if (!v) return
      try { for (let i = 0; i < 20000 && !v.halted; i++) v.step() } catch (e) { setErr((e as Error).message); setRunning(false); return }
      if (v.steps > 3000) setRan(true)
      setTick((t) => t + 1)
      if (v.halted) { setRunning(false); return }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running])

  const start = () => {
    setErr(null)
    try {
      const vm = new Vm(compileProgram(mode === 'game' ? files : { Main: stage.tests[0].main, ...files }), OS)
      vm.boot(); vmRef.current = vm; setRunning(true); setTick((t) => t + 1)
    } catch (e) { setErr(e instanceof JackError ? e.message : `Ошибка: ${(e as Error).message}`) }
  }
  const test = () => {
    setErr(null)
    try { compileProgram(files) } catch (e) { setErr((e as Error).message); return }
    const r = checkOsClass(stage, files[stage.cls]); setResults(r)
    if (r.every((x) => x.ok) && !solved.includes(stage.cls)) {
      const sv = [...solved, stage.cls]; setSolved(sv)
      const s = { ...store, solved: Object.fromEntries(sv.map((x) => [x, '1'])) }; setStore(s); save(s)
      if (OS_STAGES.every((st) => sv.includes(st.cls))) onDone(0)
    }
  }
  const addClass = () => {
    const n = prompt('Имя нового класса (с большой буквы):')?.trim()
    if (!n || !/^[A-Z]\w*$/.test(n) || files[n]) return
    update(n, `class ${n} {\n}\n`); setTab(n)
  }
  const vm = vmRef.current

  return (
    <div className="space-y-4">
      {mode === 'os' && (
        <div className="card p-3 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-dim">Классы ОС:</span>
          {OS_STAGES.map((s, i) => <button key={s.cls} onClick={() => { setStageI(i); setTab(s.cls); setResults(null) }} className={`chip border !px-3 !py-1.5 ${i === stageI ? 'border-violet bg-violet/15 text-violet-soft' : 'border-line text-mute'}`}>{solved.includes(s.cls) && <Icon name="check_circle" fill className="text-[14px] text-teal-soft" />}{s.title}.jack</button>)}
          <span className="text-xs text-dim ml-auto">Output, Keyboard, Array и Sys остаются встроенными</span>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_540px]">
        <section className="card p-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {names.map((n) => <button key={n} onClick={() => setTab(n)} className={`px-3 py-1.5 rounded-md font-mono text-sm ${n === active ? 'bg-s1 text-ink border border-line' : 'text-dim'}`}>{n}.jack</button>)}
            {mode === 'game' && <button onClick={addClass} className="btn-ghost !py-1 !px-2 text-xs"><Icon name="add" className="text-[16px]" />класс</button>}
            <div className="ml-auto flex gap-2">
              <button onClick={start} className="btn-secondary !py-1.5"><Icon name="play_arrow" fill className="text-[18px]" />{mode === 'game' ? 'Скомпилировать и запустить' : 'Запустить пример'}</button>
              {mode === 'os' && <button onClick={test} className="btn-primary !py-1.5"><Icon name="fact_check" className="text-[18px]" />Тесты {stage.cls}</button>}
            </div>
          </div>
          {mode === 'os' && <p className="text-xs text-mute mb-2">{stage.doc}</p>}
          <CodeEditor value={files[active]} onChange={(v) => update(active, v)} lang="jack" label={`${active}.jack`} minH={440} />
          {err && <div className="mt-3 rounded-lg bg-rose/10 border border-rose/30 p-3 text-sm font-mono text-rose-soft">{err}</div>}
        </section>
        <aside className="space-y-4">
          <div className="card p-4" tabIndex={0}
            onKeyDown={(e) => { if (!vm) return; const k = KEYMAP[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase().charCodeAt(0) : 0); if (k) { e.preventDefault(); vm.key = k } }}
            onKeyUp={() => { if (vm) vm.key = 0 }}>
            <div className="flex items-center justify-between mb-2"><span className="font-bold">Экран 512×256</span><span className="text-xs text-dim">{running ? 'работает · нажми сюда и используй клавиатуру' : vm?.halted ? 'программа завершилась' : 'остановлен'}</span></div>
            {vm ? <VmScreen vm={vm} tick={tick} /> : <div className="aspect-[2/1] rounded-md border border-dashed border-line grid place-items-center text-sm text-dim">Нажми «Запустить»</div>}
            <div className="flex gap-2 mt-2">{running && <button onClick={() => setRunning(false)} className="btn-ghost !py-1 text-xs"><Icon name="stop" className="text-[16px]" />Стоп</button>}<span className="text-xs text-dim font-mono ml-auto">шагов ВМ: {vm?.steps ?? 0}</span></div>
          </div>
          {mode === 'os' && results && (
            <div className="card p-4 space-y-2 pop">
              {results.map((r) => <div key={r.name} className={`rounded-lg p-2.5 text-sm ${r.ok ? 'bg-teal/10' : 'bg-rose/10'}`}><div className="flex justify-between font-mono text-xs"><span>{r.name}</span><span>{r.ok ? '✓' : '✗'}</span></div>{!r.ok && <div className="text-rose-soft text-xs mt-1">{r.msg}</div>}</div>)}
            </div>
          )}
          {mode === 'game' && (
            <div className="card p-4 text-sm">
              <div className="font-bold">Сдать проект 9</div>
              <p className="text-mute mt-1">Напиши свою интерактивную программу: игру, рисовалку, калькулятор. Требование одно — она компилируется и работает. Компилятор и ОС пока встроенные: в проектах 10–12 ты заменишь их своими.</p>
              <button disabled={!ran} onClick={() => onDone(0)} className="btn-primary w-full mt-3"><Icon name="workspace_premium" className="text-[18px]" />{ran ? 'Сдать программу' : 'Сначала запусти программу'}</button>
            </div>
          )}
          <div className="text-xs text-dim">Код сохраняется в этом браузере. Компиляция — встроенным компилятором Jack, выполнение — на виртуальной машине Hack со встроенной ОС.</div>
        </aside>
      </div>
    </div>
  )
}
