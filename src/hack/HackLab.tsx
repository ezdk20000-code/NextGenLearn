import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { assemble, decode, newMachine, runUntilHalt, signed, step, toBin, type AsmLine, type Machine } from './hack'

// Задачи проекта 4: условие, заготовка и автотест.
export interface HackTask {
  id: string
  title: string
  brief: string
  start: string
  check: (rom: AsmLine[]) => { ok: boolean; msg: string; passed: number; total: number }
  setup?: (m: Machine) => void
}

const FILL_CYCLES = 400000
const screenIs = (m: Machine, v: number) => { for (let i = 16384; i < 24576; i++) if (m.ram[i] !== v) return false; return true }

export const HACK_TASKS: HackTask[] = [
  {
    id: 'mult', title: 'Mult', brief: 'Перемножь R0 и R1, результат запиши в R2. Числа неотрицательные, R0·R1 < 32768. В конце — бесконечный цикл-останов.',
    start: '// Mult.asm: R2 = R0 * R1\n// Подсказка: R2 = 0; повторять R1 раз: R2 = R2 + R0\n\n(END)\n@END\n0;JMP\n',
    setup: (m) => { m.ram[0] = 6; m.ram[1] = 7 },
    check: (rom) => {
      const cases = [[0, 0], [1, 0], [0, 2], [3, 1], [2, 4], [6, 7], [11, 13], [100, 3]]
      let passed = 0
      for (const [a, b] of cases) {
        const m = newMachine(); m.ram[0] = a; m.ram[1] = b; m.ram[2] = 12345
        const halted = runUntilHalt(m, rom)
        if (!halted) return { ok: false, msg: `R0=${a}, R1=${b}: программа не остановилась — нет цикла-останова или бесконечный цикл.`, passed, total: cases.length }
        if (m.ram[2] !== a * b) return { ok: false, msg: `R0=${a}, R1=${b}: ожидалось R2=${a * b}, получилось ${signed(m.ram[2])}. Не забудь обнулить R2 в начале.`, passed, total: cases.length }
        passed++
      }
      return { ok: true, msg: `Все ${cases.length} наборов: 0×0 … 100×3.`, passed, total: cases.length }
    },
  },
  {
    id: 'fill', title: 'Fill', brief: 'Бесконечный цикл: пока нажата любая клавиша (KBD ≠ 0), экран полностью чёрный; когда отпущена — полностью белый.',
    start: '// Fill.asm\n// Слушай KBD; закрась все 8192 слова экрана значением -1 (чёрный) или 0 (белый)\n\n(LOOP)\n@LOOP\n0;JMP\n',
    check: (rom) => {
      const m = newMachine()
      const runFor = (n: number) => { for (let i = 0; i < n; i++) step(m, rom) }
      m.key = 75; runFor(FILL_CYCLES)
      if (!screenIs(m, 0xffff)) return { ok: false, msg: 'Клавиша нажата, но экран не стал полностью чёрным (каждое слово = −1).', passed: 0, total: 3 }
      m.key = 0; runFor(FILL_CYCLES)
      if (!screenIs(m, 0)) return { ok: false, msg: 'Клавишу отпустили, но экран не стал полностью белым.', passed: 1, total: 3 }
      m.key = 32; runFor(FILL_CYCLES)
      if (!screenIs(m, 0xffff)) return { ok: false, msg: 'Повторное нажатие не закрасило экран — программа должна слушать клавиатуру бесконечно.', passed: 2, total: 3 }
      return { ok: true, msg: 'Нажата → чёрный, отпущена → белый, снова нажата → чёрный.', passed: 3, total: 3 }
    },
  },
]

const KEY = 'ngl-hack-v1'
interface Saved { code: Record<string, string>; solved: string[] }
const load = (): Saved => { try { const r = localStorage.getItem(KEY); if (r) return { code: {}, solved: [], ...JSON.parse(r) } } catch { /* */ } return { code: {}, solved: [] } }
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* */ } }

function hl(line: string) {
  const m = /^(\s*)([^/]*?)(\s*)(\/\/.*)?$/.exec(line)!
  const body = m[2]
  const cls = body.startsWith('(') ? 'text-amber-soft' : body.startsWith('@') ? 'text-teal-soft' : 'text-violet-soft'
  return <>{m[1]}<span className={cls}>{body}</span>{m[3]}{m[4] && <span className="text-dim italic">{m[4]}</span>}</>
}

function AsmEditor({ value, onChange, current }: { value: string; onChange: (v: string) => void; current: number | null }) {
  const pre = useRef<HTMLDivElement>(null)
  const lines = value.split('\n')
  return (
    <div className="flex rounded-lg border border-line bg-[#0A0E16] font-mono text-[13px] leading-6 overflow-hidden">
      <div className="py-3 px-2 text-right text-dim select-none border-r border-line min-w-[2.5rem]">{lines.map((_, i) => <div key={i} className={current === i ? 'text-amber-soft font-bold' : ''}>{String(i).padStart(2, '0')}</div>)}</div>
      <div className="relative flex-1 min-w-0">
        <div ref={pre} aria-hidden className="absolute inset-0 py-3 whitespace-pre overflow-hidden pointer-events-none">
          {lines.map((l, i) => <div key={i} className={`px-3 min-h-[1.5rem] ${current === i ? 'bg-amber/10 border-l-2 border-amber' : ''}`}>{hl(l)}</div>)}
        </div>
        <textarea value={value} spellCheck={false} wrap="off" aria-label="Код на ассемблере Hack"
          onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft } }}
          onChange={(e) => onChange(e.target.value)}
          className="relative w-full min-h-[380px] py-3 px-3 bg-transparent text-transparent outline-none resize-y whitespace-pre overflow-auto" style={{ caretColor: '#E2E8F0' }} />
      </div>
    </div>
  )
}

function Screen({ m, tick }: { m: Machine; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!; const img = ctx.createImageData(512, 256)
    for (let w = 0; w < 8192; w++) {
      const v = m.ram[16384 + w]; const row = w >> 5, col0 = (w & 31) << 4
      for (let b = 0; b < 16; b++) { const on = (v >> b) & 1; const p = (row * 512 + col0 + b) * 4; const g = on ? 15 : 240; img.data[p] = g; img.data[p + 1] = g; img.data[p + 2] = g + (on ? 8 : 0); img.data[p + 3] = 255 }
    }
    ctx.putImageData(img, 0, 0)
  }, [m, tick])
  return <canvas ref={ref} width={512} height={256} className="w-full rounded-md border border-line" style={{ imageRendering: 'pixelated' }} aria-label="Экран Hack 512 на 256" />
}

/** Эмулятор компьютера Hack: код, ROM, регистры, декодер, RAM, экран, клавиатура, автотесты. */
export default function HackLab({ onDone }: { onDone: (mistakes: number) => void }) {
  const [saved, setSaved] = useState<Saved>(load)
  const [ti, setTi] = useState(HACK_TASKS.findIndex((t) => !load().solved.includes(t.id)) >= 0 ? HACK_TASKS.findIndex((t) => !load().solved.includes(t.id)) : 0)
  const task = HACK_TASKS[ti]
  const code = saved.code[task.id] ?? task.start
  const asm = useMemo(() => assemble(code), [code])
  const mRef = useRef<Machine>(newMachine())
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [ramFrom, setRamFrom] = useState(0)
  const [verdict, setVerdict] = useState<null | ReturnType<HackTask['check']>>(null)
  const [tries, setTries] = useState(0)
  const m = mRef.current

  const reset = () => { const n = newMachine(); task.setup?.(n); mRef.current = n; setRunning(false); setTick((t) => t + 1) }
  useEffect(reset, [ti]) // eslint-disable-line
  useEffect(() => {
    if (!running) return
    let raf = 0
    const per = [1, 10, 200, 3000, 30000][speed]
    const loop = () => {
      const mm = mRef.current
      for (let i = 0; i < per; i++) { const pc = mm.PC; step(mm, asm.rom); if (mm.PC === pc || mm.PC >= asm.rom.length) { setRunning(false); break } }
      setTick((t) => t + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, speed, asm])

  const setCode = (v: string) => { const s = { ...saved, code: { ...saved.code, [task.id]: v } }; setSaved(s); save(s); setVerdict(null) }
  const runTests = () => {
    if (asm.errors.length) return
    setTries((t) => t + 1)
    const r = task.check(asm.rom)
    setVerdict(r)
    if (r.ok && !saved.solved.includes(task.id)) {
      const s = { ...saved, solved: [...saved.solved, task.id] }; setSaved(s); save(s)
      if (HACK_TASKS.every((t) => s.solved.includes(t.id))) onDone(Math.max(0, tries + 1 - HACK_TASKS.length))
    }
  }
  const cur = asm.rom[m.PC]
  const dec = cur ? decode(cur.code) : null
  const word = cur?.code ?? 0
  const ctrl = (word >> 6) & 63
  const touched = (i: number) => m.ram[i] !== 0

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-s2/60 p-0.5 text-sm">
          {HACK_TASKS.map((t, i) => <button key={t.id} onClick={() => setTi(i)} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${i === ti ? 'bg-violet/25 text-violet-soft' : 'text-dim hover:text-ink'}`}>{saved.solved.includes(t.id) && <Icon name="check_circle" fill className="text-[15px] text-teal-soft" />}{t.title}</button>)}
        </div>
        <button onClick={() => { const pc = m.PC; step(m, asm.rom); if (m.PC === pc) setRunning(false); setTick((t) => t + 1) }} disabled={running || asm.errors.length > 0} className="btn-secondary !py-1.5"><Icon name="skip_next" className="text-[18px]" />Шаг</button>
        <button onClick={() => setRunning(true)} disabled={running || asm.errors.length > 0} className="btn-primary !py-1.5"><Icon name="play_arrow" fill className="text-[18px]" />Выполнить</button>
        <button onClick={() => setRunning(false)} disabled={!running} className="btn-ghost !py-1.5"><Icon name="pause" className="text-[18px]" />Стоп</button>
        <button onClick={reset} className="btn-ghost !py-1.5"><Icon name="restart_alt" className="text-[18px]" />Сброс</button>
        <label className="flex items-center gap-2 text-xs text-dim ml-1">Скорость<input type="range" min={0} max={4} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="accent-violet w-24" /></label>
        <span className="ml-auto chip bg-s2 text-mute font-mono">тактов: {m.cycles}</span>
        <span className="chip border border-amber/40 bg-amber/10 text-amber-soft font-mono">PC: {m.PC}</span>
      </div>

      <div className="rounded-lg border border-violet/30 bg-violet/5 p-3 text-sm"><b className="text-violet-soft">{task.title}.asm.</b> {task.brief}</div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px_330px]">
        <section className="space-y-4 min-w-0">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2"><span className="font-bold font-mono">{task.title}.asm</span><span className="chip bg-s2 text-dim font-mono !text-[10px]">ROM: {asm.rom.length} инструкций</span></div>
            <AsmEditor value={code} onChange={setCode} current={cur ? cur.src : null} />
            {asm.errors.length > 0 && <div className="mt-3 rounded-lg bg-rose/10 border border-rose/30 p-3 text-sm font-mono text-rose-soft">{asm.errors[0]}</div>}
          </div>
          <div className="card p-4">
            <div className="font-bold mb-1">ROM · машинный код</div>
            <div className="text-xs text-dim mb-2 font-mono">C-инструкция: <span className="text-violet-soft">111</span> <span className="text-amber-soft">a</span> <span className="text-teal-soft">cccccc</span> <span className="text-violet-soft">ddd</span> <span className="text-rose-soft">jjj</span></div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs font-mono">
                <tbody>{asm.rom.map((l, i) => {
                  const b = toBin(l.code)
                  return (
                    <tr key={i} className={i === m.PC ? 'bg-amber/10' : ''}>
                      <td className={`py-0.5 pr-2 ${i === m.PC ? 'text-amber-soft font-bold' : 'text-dim'}`}>{i}</td>
                      <td className="pr-2 truncate max-w-[9rem]">{l.text.replace(/\/\/.*/, '')}</td>
                      <td className="whitespace-nowrap">{l.code & 0x8000 ? <><span className="text-violet-soft">{b.slice(0, 3)}</span><span className="text-amber-soft">{b[3]}</span><span className="text-teal-soft">{b.slice(4, 10)}</span><span className="text-violet-soft">{b.slice(10, 13)}</span><span className="text-rose-soft">{b.slice(13)}</span></> : <><span className="text-dim">0</span>{b.slice(1)}</>}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="card p-4 space-y-2">
            <div className="font-bold">Регистры процессора</div>
            {[['A', m.A, 'адрес или данные'], ['D', m.D, 'данные'], ['PC', m.PC, 'адрес следующей инструкции']].map(([n, v, d]) => (
              <div key={n as string} className={`rounded-lg border p-3 ${n === 'PC' ? 'border-amber/40 bg-amber/5' : 'border-line'}`}>
                <div className="flex justify-between text-xs"><span className={n === 'PC' ? 'text-amber-soft font-semibold' : 'text-violet-soft font-semibold'}>Регистр {n}</span><span className="font-mono text-dim">0x{((v as number) & 0xffff).toString(16).toUpperCase().padStart(4, '0')}</span></div>
                <div className="flex items-end justify-between mt-1"><span className="text-2xl font-bold font-mono">{signed(v as number)}</span><span className="font-mono text-[11px] text-dim">{toBin(v as number).replace(/(.{4})/g, '$1 ')}</span></div>
                <div className="text-[11px] text-dim">{d as string}</div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between"><div className="font-bold">Декодер</div><span className="chip bg-amber/15 text-amber-soft !text-[10px]">{dec ? (dec.kind === 'A' ? 'A-инструкция' : 'C-инструкция') : 'нет инструкции'}</span></div>
            {dec?.kind === 'A' && <p className="text-sm text-mute mt-2 font-mono">A ← {dec.value}</p>}
            {dec?.kind === 'C' && (
              <div className="mt-2 space-y-1.5 text-sm font-mono">
                <div className="flex justify-between"><span className="text-dim">comp</span><span className="text-teal-soft">{dec.comp}</span></div>
                <div className="flex justify-between"><span className="text-dim">вход y АЛУ</span><span>{(word >> 12) & 1 ? `M = RAM[${m.A}] = ${signed(m.ram[m.A & 0x7fff])}` : `A = ${signed(m.A)}`}</span></div>
                <div className="flex justify-between"><span className="text-dim">dest</span><span className="text-violet-soft">{dec.dest || '—'}</span></div>
                <div className="flex justify-between"><span className="text-dim">jump</span><span className="text-rose-soft">{dec.jump || '—'}</span></div>
                <div className="label pt-2">Управление АЛУ</div>
                <div className="grid grid-cols-6 gap-1 text-center">{['zx', 'nx', 'zy', 'ny', 'f', 'no'].map((n, k) => { const on = (ctrl >> (5 - k)) & 1; return <div key={n} className={`rounded-md py-1 ${on ? 'bg-violet/25 text-violet-soft' : 'bg-s2/60 text-dim'}`}><div className="text-[10px]">{n}</div><div>{on}</div></div> })}</div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-bold">RAM</div>
              <div className="flex gap-1 text-[11px]">{[['R0..R15', 0], ['16+', 16], ['SCREEN', 16384]].map(([l, a]) => <button key={l as string} onClick={() => setRamFrom(a as number)} className={`chip !py-0.5 border ${ramFrom === a ? 'border-violet text-violet-soft' : 'border-line text-dim'}`}>{l as string}</button>)}</div>
            </div>
            <table className="w-full text-xs font-mono">
              <tbody>{Array.from({ length: 16 }, (_, k) => ramFrom + k).map((a) => (
                <tr key={a} className={touched(a) ? 'bg-teal/5' : ''}>
                  <td className="py-0.5 text-dim">{a}</td><td className="text-violet-soft">{a < 16 ? `R${a}` : a >= 16384 ? `S+${a - 16384}` : ''}</td>
                  <td className={`text-right ${touched(a) ? 'text-teal-soft' : ''}`}>{signed(m.ram[a])}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-bold">Экран 512×256</div><span className="text-[11px] text-dim font-mono">RAM 16384…24575</span></div>
            <Screen m={m} tick={tick} />
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between"><div className="font-bold">Клавиатура</div><span className="font-mono text-xs text-dim">KBD = {m.key}</span></div>
            <button onPointerDown={() => { m.key = 75; setTick((t) => t + 1) }} onPointerUp={() => { m.key = 0; setTick((t) => t + 1) }} onPointerLeave={() => { if (m.key) { m.key = 0; setTick((t) => t + 1) } }}
              className={`w-full mt-2 rounded-lg border py-3 font-mono select-none ${m.key ? 'border-teal bg-teal/15 text-teal-soft' : 'border-line text-mute'}`}>{m.key ? 'клавиша нажата (K = 75)' : 'зажми, чтобы нажать клавишу'}</button>
          </div>
        </section>
      </div>

      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          {verdict ? <div className="text-sm"><b className={verdict.ok ? 'text-teal-soft' : 'text-rose-soft'}>{verdict.ok ? `Тесты пройдены: ${verdict.passed}/${verdict.total}.` : `Пройдено ${verdict.passed} из ${verdict.total}.`}</b> {verdict.msg}</div>
            : <div className="text-sm text-dim">Автотест прогонит программу на нескольких наборах данных{task.id === 'fill' ? ' и проверит экран при нажатой и отпущенной клавише' : ''}.</div>}
        </div>
        <button onClick={runTests} disabled={asm.errors.length > 0} className="btn-primary shrink-0"><Icon name="fact_check" className="text-[18px]" />Проверить {task.title}</button>
        {verdict?.ok && ti < HACK_TASKS.length - 1 && <button onClick={() => setTi(ti + 1)} className="btn-secondary shrink-0">Дальше: {HACK_TASKS[ti + 1].title}<Icon name="arrow_forward" className="text-[18px]" /></button>}
      </div>
    </div>
  )
}
