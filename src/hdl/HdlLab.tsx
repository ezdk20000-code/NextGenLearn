import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { BUILDABLE, CHIPS, chipByName, isSequential, skeleton, type ChipSpec } from './chips'
import { compile, HdlError, type Circuit } from './hdl'
import { runTests, show, type TestResult } from './tests'

// ─── Сохранение кода и решённых чипов в браузере ───
const KEY = 'ngl-hdl-v1'
interface Saved { code: Record<string, string>; solved: string[] }
const loadSaved = (): Saved => { try { const r = localStorage.getItem(KEY); if (r) return { code: {}, solved: [], ...JSON.parse(r) } } catch { /* */ } return { code: {}, solved: [] } }
const persist = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* */ } }
export const hdlSolved = () => loadSaved().solved

const ORDER = CHIPS.map((c) => c.name)
const allowed = (name: string) => (chip: string) => chip === 'Nand' || chip === 'DFF' || ORDER.indexOf(chip) < ORDER.indexOf(name)

export const HINTS: Record<string, string> = {
  Not: 'Что выдаст Nand, если на оба его входа подать один и тот же сигнал?',
  And: 'And — это Nand, после которого стоит инвертор. Инвертор ты только что собрал.',
  Or: 'Закон де Моргана: a ИЛИ b = НЕ(НЕ a И НЕ b). А «НЕ (… И …)» — это Nand.',
  Xor: 'Xor = (a ИЛИ b) И НЕ(a И b). Есть и решение из четырёх Nand.',
  Mux: 'out = (a И НЕ sel) ИЛИ (b И sel). Понадобятся Not, два And и Or.',
  DMux: 'a = in И НЕ sel, b = in И sel.',
  Not16: 'Шестнадцать Not, по одному на бит: Not(in=in[0], out=out[0]); …',
  And16: 'По And на каждый бит: a[i], b[i] → out[i].',
  Or16: 'По Or на каждый бит.',
  Mux16: 'По Mux на каждый бит с общим sel.',
  Or8Way: 'Цепочка из семи Or: сначала in[0] и in[1], потом результат и in[2]…',
  Mux4Way16: 'Два Mux16 выбирают по sel[0] между a/b и c/d, третий — по sel[1] между результатами.',
  Mux8Way16: 'Два Mux4Way16 по sel[0..1] и Mux16 по sel[2].',
  DMux4Way: 'Сначала DMux по sel[1] делит на «верхнюю» и «нижнюю» пару, затем два DMux по sel[0].',
  DMux8Way: 'DMux по sel[2], затем два DMux4Way по sel[0..1].',
  HalfAdder: 'sum — это Xor, carry — это And.',
  FullAdder: 'Два полусумматора подряд: первый складывает a и b, второй — их сумму и c. Переносы объедини через Or.',
  Add16: 'Цепочка: HalfAdder для бита 0, затем 15 FullAdder, перенос каждого идёт в следующий.',
  Inc16: 'Прибавь единицу через Add16: подай на b константу, у которой только бит 0 равен true — b[0]=true.',
  ALU: 'Иди по шагам документации: Mux16 с false для zx, Not16 + Mux16 для nx, то же для y; And16 и Add16, выбор по f; Not16 + Mux16 для no. Флаги: ng = out[15], zr — Or8Way по двум половинам и Not.',
  Bit: 'DFF плюс Mux: если load = 1, на DFF идёт in, иначе — его же выход (заведи для него второй провод: out=out, out=fb).',
  Register: '16 чипов Bit с общим load.',
  RAM8: 'DMux8Way направляет load в нужный регистр по address, Mux8Way16 выбирает выход нужного регистра.',
  RAM64: 'То же, что RAM8, только из восьми RAM8: старшие биты адреса выбирают блок, младшие идут внутрь.',
  RAM512: 'Восемь RAM64; address[6..8] выбирает блок.',
  RAM4K: 'Восемь RAM512; address[9..11] выбирает блок.',
  RAM16K: 'Четыре RAM4K: DMux4Way и Mux4Way16 по address[12..13].',
  Memory: 'Два старших бита адреса (address[13..14]) решают, куда идти: 00 и 01 — RAM16K, 10 — Screen, 11 — Keyboard. DMux4Way распределит load, Mux4Way16 выберет выход.',
  CPU: 'Нарисуй схему по книге: Mux16 перед регистром A (инструкция или выход АЛУ), ARegister, DRegister, Mux16 «A или inM» по биту a, ALU с битами c1–c6, логика записи (биты d) и переходов (биты j и флаги zr, ng), PC с load = «переход» и inc = true.',
  Computer: 'Три части: ROM32K выдаёт инструкцию по pc, CPU её выполняет, Memory принимает outM/writeM/addressM и отдаёт inM.',
  PC: 'Register с load=true, а на вход — цепочка Mux16 в порядке приоритета: inc, затем load, затем reset (последний Mux16 главнее всех).',
}

// ─── Подсветка синтаксиса HDL ───
function highlight(src: string) {
  return src.split('\n').map((line, i) => {
    const parts: { t: string; c: string }[] = []
    const re = /(\/\/.*$)|\b(CHIP|IN|OUT|PARTS)\b|\b(true|false)\b|\b([A-Z][A-Za-z0-9]*)(?=\s*\()|(\d+)|([A-Za-z_][A-Za-z0-9_]*)/g
    let last = 0, m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push({ t: line.slice(last, m.index), c: '' })
      parts.push({ t: m[0], c: m[1] ? 'text-dim italic' : m[2] ? 'text-violet-soft font-bold' : m[3] ? 'text-amber-soft' : m[4] ? 'text-teal-soft' : m[5] ? 'text-amber-soft' : 'text-ink/90' })
      last = m.index + m[0].length
    }
    parts.push({ t: line.slice(last), c: '' })
    return <div key={i} className="min-h-[1.5rem]">{parts.map((p, k) => <span key={k} className={p.c}>{p.t}</span>)}</div>
  })
}

function Editor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: number }) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const pre = useRef<HTMLDivElement>(null)
  const lines = value.split('\n').length
  return (
    <div className="flex rounded-lg border border-line bg-[#0A0E16] font-mono text-[13px] leading-6 overflow-hidden">
      <div className="py-3 px-2 text-right text-dim select-none border-r border-line min-w-[2.5rem]">{Array.from({ length: lines }, (_, i) => <div key={i} className={error === i + 1 ? 'text-rose-soft font-bold' : ''}>{String(i + 1).padStart(2, '0')}</div>)}</div>
      <div className="relative flex-1 min-w-0">
        <div ref={pre} aria-hidden className="absolute inset-0 py-3 px-3 whitespace-pre overflow-hidden pointer-events-none">{highlight(value)}</div>
        <textarea ref={ta} value={value} spellCheck={false} aria-label="HDL-код" wrap="off"
          onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft } }}
          onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; onChange(value.slice(0, s) + '    ' + value.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 4 }) } }}
          onChange={(e) => onChange(e.target.value)}
          className="relative w-full min-h-[340px] py-3 px-3 bg-transparent text-transparent caret-ink outline-none resize-y whitespace-pre overflow-auto" style={{ caretColor: '#E2E8F0' }} />
      </div>
    </div>
  )
}

// ─── Схема собранного чипа ───
function Schematic({ circuit, spec }: { circuit: Circuit; spec: ChipSpec }) {
  const insts = circuit.insts.slice(0, 32)
  const driver = new Map<string, number>()
  insts.forEach((i, k) => i.outs.forEach((o) => driver.set(o.dst.name, k)))
  const depth: number[] = []
  const d = (k: number, seen = new Set<number>()): number => {
    if (depth[k] !== undefined) return depth[k]
    if (seen.has(k)) return 1
    seen.add(k)
    const src = insts[k].ins.map((c) => ('const' in c.src ? 0 : driver.has(c.src.name) && !insts[driver.get(c.src.name)!].spec.tick ? d(driver.get(c.src.name)!, seen) : 0))
    return (depth[k] = 1 + Math.max(0, ...src))
  }
  insts.forEach((_, k) => d(k))
  const cols = Math.max(1, ...depth)
  const byCol: number[][] = Array.from({ length: cols + 1 }, () => [])
  insts.forEach((_, k) => byCol[depth[k]].push(k))
  const rows = Math.max(spec.inputs.length, spec.outputs.length, ...byCol.map((c) => c.length))
  const H = Math.max(180, rows * 58 + 30)
  const W = 130 + cols * 150 + 130
  const pos = new Map<string, { x: number; y: number }>()
  spec.inputs.forEach((p, i) => pos.set(p.name, { x: 60, y: (H / (spec.inputs.length + 1)) * (i + 1) }))
  const boxPos = byCol.map((col, c) => col.map((k, j) => ({ k, x: 100 + (c - 1) * 150 + 40, y: (H / (col.length + 1)) * (j + 1) }))).flat()
  boxPos.forEach((b) => insts[b.k].outs.forEach((o) => { if (!pos.has(o.dst.name) || spec.outputs.every((p) => p.name !== o.dst.name)) pos.set(o.dst.name, { x: b.x + 90, y: b.y }) }))
  const outY = (i: number) => (H / (spec.outputs.length + 1)) * (i + 1)
  const val = (n: string) => circuit.value(n)
  const lit = (n: string) => val(n) !== 0
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[520px]" role="img" aria-label="Схема чипа">
      {boxPos.map((b) => insts[b.k].ins.map((c, j) => {
        if ('const' in c.src) return null
        const from = pos.get(c.src.name)
        if (!from) return null
        const n = insts[b.k].ins.length
        const ty = b.y - 14 + (28 / (n + 1)) * (j + 1)
        const mx = (from.x + b.x) / 2
        return <path key={`${b.k}-${j}`} d={`M${from.x},${from.y} C${mx},${from.y} ${mx},${ty} ${b.x},${ty}`} fill="none" stroke={lit(c.src.name) ? '#4FDBC8' : '#334155'} strokeWidth={lit(c.src.name) ? 2 : 1.3} />
      }))}
      {spec.outputs.map((p, i) => {
        const drv = insts.findIndex((x) => x.outs.some((o) => o.dst.name === p.name))
        const b = boxPos.find((x) => x.k === drv)
        if (!b) return null
        return <path key={p.name} d={`M${b.x + 90},${b.y} C${W - 90},${b.y} ${W - 120},${outY(i)} ${W - 70},${outY(i)}`} fill="none" stroke={lit(p.name) ? '#4FDBC8' : '#334155'} strokeWidth={2} />
      })}
      {spec.inputs.map((p) => { const q = pos.get(p.name)!; return <g key={p.name} transform={`translate(${q.x},${q.y})`}><rect x={-48} y={-12} width={48} height={24} rx={5} fill="#0A0E16" stroke={lit(p.name) ? '#14B8A6' : '#334155'} /><text x={-24} y={4} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill={lit(p.name) ? '#4FDBC8' : '#94A3B8'}>{p.name}={show(val(p.name), p.width)}</text></g> })}
      {boxPos.map((b) => {
        const i = insts[b.k]
        const on = i.outs.some((o) => lit(o.dst.name))
        return <g key={b.k} transform={`translate(${b.x},${b.y})`}><rect x={0} y={-16} width={90} height={32} rx={7} fill="#111827" stroke={i.spec.tick ? '#F59E0B' : on ? '#14B8A6' : '#6366F1'} strokeWidth={1.4} /><text x={45} y={4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#C0C1FF">{i.spec.name}</text></g>
      })}
      {spec.outputs.map((p, i) => <g key={p.name} transform={`translate(${W - 70},${outY(i)})`}><circle r={9} fill={lit(p.name) ? 'rgba(79,219,200,0.25)' : '#0A0E16'} stroke={lit(p.name) ? '#4FDBC8' : '#334155'} strokeWidth={2} /><text x={14} y={4} fontSize="11" fontFamily="JetBrains Mono" fill={lit(p.name) ? '#4FDBC8' : '#94A3B8'}>{p.name}={show(val(p.name), p.width)}</text></g>)}
      {circuit.insts.length > insts.length && <text x={10} y={H - 8} fontSize="10" fill="#64748B">показаны первые {insts.length} частей из {circuit.insts.length}</text>}
    </svg>
  )
}

/** HDL-песочница проекта: список чипов, редактор, схема, автотесты. */
export default function HdlLab({ project, onDone }: { project: 1 | 2 | 3 | 5; onDone: (mistakes: number) => void }) {
  const chips = BUILDABLE.filter((c) => c.project === project)
  const [saved, setSaved] = useState<Saved>(loadSaved)
  const firstOpen = chips.find((c) => !saved.solved.includes(c.name)) ?? chips[0]
  const [cur, setCur] = useState(firstOpen.name)
  const spec = chipByName(cur)!
  const code = saved.code[cur] ?? skeleton(spec)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<HdlError | null>(null)
  const [probe, setProbe] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'hdl' | 'spec'>('hdl')
  const [hint, setHint] = useState(false)
  const [runs, setRuns] = useState(0)
  const [, force] = useState(0)

  useEffect(() => { setResult(null); setError(null); setHint(false); setTab('hdl'); setProbe(Object.fromEntries(spec.inputs.map((p) => [p.name, 0]))) }, [cur]) // eslint-disable-line

  const circuit = useMemo(() => {
    try { const c = compile(code, spec, allowed(cur)); return c } catch { return null }
  }, [code, cur]) // eslint-disable-line
  const live = useMemo(() => {
    if (!circuit) return null
    try { circuit.set(probe); circuit.eval(); return circuit } catch { return null }
  }, [circuit, probe])

  const unlocked = (i: number) => i === 0 || chips.slice(0, i).every((c) => saved.solved.includes(c.name))
  const solvedCount = chips.filter((c) => saved.solved.includes(c.name)).length

  const setCode = (v: string) => { const s = { ...saved, code: { ...saved.code, [cur]: v } }; setSaved(s); persist(s); setResult(null); setError(null) }
  const run = () => {
    setRuns((r) => r + 1)
    try {
      const c = compile(code, spec, allowed(cur))
      const r = runTests(spec, c)
      setResult(r); setError(null)
      if (!r.firstFail && !saved.solved.includes(cur)) {
        const s = { ...saved, solved: [...saved.solved, cur] }
        setSaved(s); persist(s)
        if (chips.every((x) => s.solved.includes(x.name))) onDone(Math.max(0, runs - chips.length))
      }
    } catch (e) {
      setResult(null); setError(e instanceof HdlError ? e : new HdlError(String(e)))
    }
  }
  const curIdx = chips.findIndex((c) => c.name === cur)
  const next = chips[curIdx + 1]
  const partsUsed = circuit ? Object.entries(circuit.insts.reduce<Record<string, number>>((a, i) => ({ ...a, [i.spec.name]: (a[i.spec.name] ?? 0) + 1 }), {})) : []
  const shownRows = result ? (result.firstFail ? [result.firstFail, ...result.rows.filter((r) => r !== result.firstFail)].slice(0, 12) : result.rows.slice(0, 12)) : []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[230px_1fr_330px]">
        {/* Чипы проекта */}
        <aside className="card p-4 self-start">
          <div className="flex items-center justify-between"><div className="font-bold">Чипы проекта {project}</div><span className="chip bg-teal/15 text-teal-soft font-mono">{Math.round((solvedCount / chips.length) * 100)}%</span></div>
          <div className="text-xs text-dim mt-0.5">{solvedCount} из {chips.length} собрано</div>
          <div className="h-1.5 rounded-full bg-s2 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${(solvedCount / chips.length) * 100}%` }} /></div>
          <ul className="mt-3 space-y-0.5 max-h-[60vh] overflow-y-auto">
            {chips.map((c, i) => {
              const ok = saved.solved.includes(c.name), open = unlocked(i), active = c.name === cur
              return (
                <li key={c.name}>
                  <button disabled={!open} onClick={() => setCur(c.name)} className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left ${active ? 'bg-violet/15 text-ink font-semibold' : open ? 'text-mute hover:bg-s1' : 'text-dim opacity-60'}`}>
                    <Icon name={ok ? 'check_circle' : open ? (active ? 'memory' : 'radio_button_unchecked') : 'lock'} fill={ok} className={`text-[18px] ${ok ? 'text-teal-soft' : active ? 'text-violet-soft' : ''}`} />
                    <span className="flex-1 font-mono">{c.name}</span>
                    {isSequential(c) && <Icon name="timer" className="text-[14px] text-amber-soft" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Редактор и схема */}
        <section className="space-y-4 min-w-0">
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex rounded-lg bg-s2/60 p-0.5 text-sm">
                <button onClick={() => setTab('hdl')} className={`px-3 py-1.5 rounded-md font-mono ${tab === 'hdl' ? 'bg-s1 text-ink' : 'text-dim'}`}>{cur}.hdl</button>
                <button onClick={() => setTab('spec')} className={`px-3 py-1.5 rounded-md ${tab === 'spec' ? 'bg-s1 text-ink' : 'text-dim'}`}>Спецификация</button>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={() => { if (confirm('Вернуть заготовку? Твой код этого чипа будет стёрт.')) setCode(skeleton(spec)) }} className="btn-ghost !py-1.5 !px-2.5 text-xs"><Icon name="restart_alt" className="text-[16px]" />Сброс</button>
                <button onClick={run} className="btn-primary !py-1.5"><Icon name="play_arrow" fill className="text-[18px]" />Запустить тесты</button>
              </div>
            </div>
            {tab === 'hdl' ? (
              <>
                <Editor value={code} onChange={setCode} error={error?.line} />
                {error && <div className="mt-3 rounded-lg bg-rose/10 border border-rose/30 p-3 text-sm font-mono text-rose-soft pop">{error.message}</div>}
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-ink/90 leading-7">{spec.doc}</p>
                <div className="grid sm:grid-cols-2 gap-2 font-mono text-xs">
                  <div className="rounded-lg bg-s2/60 p-3"><div className="label mb-1">Входы</div>{spec.inputs.map((p) => <div key={p.name}>{p.name}{p.width > 1 ? `[${p.width}]` : ''}</div>)}</div>
                  <div className="rounded-lg bg-s2/60 p-3"><div className="label mb-1">Выходы</div>{spec.outputs.map((p) => <div key={p.name}>{p.name}{p.width > 1 ? `[${p.width}]` : ''}</div>)}</div>
                </div>
                <div className="rounded-lg border border-line p-3 text-xs text-mute">
                  <div className="label mb-1">Можно использовать</div>
                  <div className="font-mono">{['Nand', ...(project >= 3 ? ['DFF'] : []), ...(project === 5 ? ['ARegister', 'DRegister', 'ROM32K', 'Screen', 'Keyboard'] : []), ...ORDER.filter((n) => !chipByName(n)!.builtin && allowed(cur)(n))].join(', ')}</div>
                  <p className="mt-2">Синтаксис: <code className="font-mono text-teal-soft">Чип(вывод=провод, вывод[0..7]=провод, вывод=true);</code> Нумерация битов справа налево, бит 0 — младший.</p>
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-bold flex items-center gap-1.5"><Icon name="schema" className="text-teal-soft text-[20px]" />Схема чипа</span>
              <span className="text-xs text-dim">{live ? 'синхронизирована с кодом' : 'появится, когда код соберётся без ошибок'}</span>
            </div>
            {live ? (
              <>
                <div className="rounded-lg border border-line bg-[#0A0E16] grid-bg overflow-x-auto"><Schematic circuit={live} spec={spec} /></div>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  <span className="text-dim">Входы:</span>
                  {spec.inputs.map((p) => p.width === 1
                    ? <button key={p.name} onClick={() => setProbe({ ...probe, [p.name]: probe[p.name] ? 0 : 1 })} className={`chip border font-mono ${probe[p.name] ? 'border-teal bg-teal/15 text-teal-soft' : 'border-line text-mute'}`}>{p.name}={probe[p.name] ?? 0}</button>
                    : <label key={p.name} className="chip border border-line font-mono">{p.name}=<input type="number" value={show(probe[p.name] ?? 0, p.width)} onChange={(e) => setProbe({ ...probe, [p.name]: (Number(e.target.value) | 0) & ((1 << p.width) - 1) })} className="w-20 bg-transparent outline-none" /></label>)}
                  {isSequential(spec) && <button onClick={() => { try { live.tick(); force((x) => x + 1) } catch (e) { setError(e as HdlError) } }} className="btn-secondary !py-1 !px-2.5 text-xs"><Icon name="timer" className="text-[16px]" />Такт</button>}
                </div>
              </>
            ) : <div className="h-24 grid place-items-center text-sm text-dim rounded-lg border border-dashed border-line">Пока нечего показать</div>}
          </div>
        </section>

        {/* Тесты */}
        <aside className="card p-4 self-start space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="label text-teal-soft">Тестирование</div><div className="font-bold font-mono">{cur}</div></div>
            {result && <span className={`chip ${result.firstFail ? 'bg-rose/15 text-rose-soft' : 'bg-teal/15 text-teal-soft'}`}>{result.passed}/{result.total}</span>}
          </div>
          {!result && !error && <p className="text-sm text-dim">Нажми «Запустить тесты»: схема получит {isSequential(spec) ? 'последовательность входов с тактами' : 'все нужные комбинации входов'} и сравнится с эталоном.</p>}
          {error && <p className="text-sm text-rose-soft">Код не собрался — исправь ошибку в редакторе.</p>}
          {result && spec.name === 'Computer' && (
            <ul className="space-y-1.5 text-xs font-mono">{result.rows.map((r) => (
              <li key={r.step} className={`rounded-md p-2 ${r.ok ? 'bg-teal/10' : 'bg-rose/10'}`}>
                <div className="flex justify-between"><span>{r.step}</span><span>{r.ok ? '✓' : '✗'}</span></div>
                {!r.ok && <div className="text-rose-soft mt-1">{Object.keys(r.want).map((k) => `${k}: ${r.got[k]}≠${r.want[k]}`).join(', ') || 'В схеме нет частей ROM32K и Memory'}</div>}
              </li>
            ))}</ul>
          )}
          {result && spec.name !== 'Computer' && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead><tr className="text-dim">{isSequential(spec) && <th className="text-left py-1">t</th>}{spec.inputs.slice(0, 4).map((p) => <th key={p.name} className="text-left py-1">{p.name}</th>)}{spec.outputs.slice(0, 3).map((p) => <th key={p.name} className="text-left py-1">{p.name}</th>)}<th /></tr></thead>
                <tbody>{shownRows.map((r, k) => (
                  <tr key={k} className={`border-t border-line ${r.ok ? '' : 'bg-rose/10'}`}>
                    {isSequential(spec) && <td className="py-1 text-dim">{r.step}</td>}
                    {spec.inputs.slice(0, 4).map((p) => <td key={p.name} className="py-1">{show(r.inputs[p.name], p.width)}</td>)}
                    {spec.outputs.slice(0, 3).map((p) => <td key={p.name} className={`py-1 ${r.ok ? 'text-teal-soft' : 'text-rose-soft'}`}>{r.ok ? show(r.got[p.name], p.width) : `${show(r.got[p.name], p.width)}≠${show(r.want[p.name], p.width)}`}</td>)}
                    <td className="py-1">{r.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}</tbody>
              </table>
              {result.firstFail && <p className="text-xs text-mute mt-2">Первая ошибка вверху: «получено≠ожидалось». Подай эти входы на схему и посмотри, где сигнал идёт не так.</p>}
            </div>
          )}
          {result && !result.firstFail && (
            <div className="rounded-lg bg-teal/10 p-3 text-sm pop">
              <b className="text-teal-soft">Чип {cur} собран!</b> Теперь его можно использовать как часть следующих чипов.
              {next && <button onClick={() => setCur(next.name)} className="btn-primary w-full mt-3">Дальше: {next.name}<Icon name="arrow_forward" className="text-[18px]" /></button>}
            </div>
          )}
          <div className="rounded-lg border border-amber/25 bg-amber/5 p-3 text-sm">
            <div className="flex items-center gap-1.5 text-amber-soft font-semibold text-xs"><Icon name="lightbulb" className="text-[16px]" />Подсказка наставника</div>
            {hint ? <p className="mt-1 text-mute">{HINTS[cur]}</p> : <button onClick={() => setHint(true)} className="text-xs text-violet-soft hover:underline mt-1">Показать подсказку</button>}
          </div>
        </aside>
      </div>
      <div className="card px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mute font-mono">
        <span className="flex items-center gap-1.5"><Icon name="memory" className="text-[15px] text-teal-soft" />Части: {partsUsed.length ? partsUsed.map(([n, k]) => `${n} ×${k}`).join(', ') : '—'}</span>
        <span>Встроенные: Nand{project >= 3 ? ', DFF' : ''}{project === 5 ? ', ARegister, DRegister, ROM32K, Screen, Keyboard' : ''}</span>
        <span className="ml-auto">Код сохраняется в этом браузере</span>
      </div>
    </div>
  )
}
