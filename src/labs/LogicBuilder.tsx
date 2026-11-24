import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import { GATE_INFO, combos, evaluate, sourcesFor, type Bit, type Gate, type GateType } from './logic'

export interface LogicTask {
  id: string
  title: string
  brief: string
  inputs: string[]
  outputs: { name: string; target: (v: Record<string, Bit>) => Bit }[]
  allowed: GateType[]
  maxGates: number
  hint?: string
}

const ON = '#4FDBC8'
const OFF = '#475569'

/** Схема: колонки по «глубине» вентиля, провода — кривые. */
function Diagram({ inputs, gates, values, outMap }: { inputs: string[]; gates: Gate[]; values: Record<string, Bit>; outMap: Record<string, string> }) {
  const depth: Record<string, number> = {}
  inputs.forEach((i) => { depth[i] = 0 })
  gates.forEach((g) => { depth[g.id] = 1 + Math.max(depth[g.a] ?? 0, GATE_INFO[g.type].arity === 1 ? 0 : depth[g.b] ?? 0) })
  const cols = Math.max(1, ...gates.map((g) => depth[g.id]))
  const W = 150 + cols * 140 + 110
  const byCol: Record<number, string[]> = {}
  ;[...inputs, ...gates.map((g) => g.id)].forEach((id) => { (byCol[depth[id]] ??= []).push(id) })
  const rows = Math.max(...Object.values(byCol).map((c) => c.length), Object.keys(outMap).length, 2)
  const H = Math.max(160, rows * 70 + 20)
  const pos: Record<string, { x: number; y: number }> = {}
  Object.entries(byCol).forEach(([c, ids]) => ids.forEach((id, k) => { pos[id] = { x: 40 + Number(c) * 140, y: (H / (ids.length + 1)) * (k + 1) } }))
  const outs = Object.entries(outMap).filter(([, src]) => src)
  const wire = (from: string, x2: number, y2: number, key: string) => {
    const p = pos[from]; if (!p) return null
    const x1 = p.x + (inputs.includes(from) ? 26 : 64)
    const mx = (x1 + x2) / 2
    return <path key={key} d={`M${x1},${p.y} C${mx},${p.y} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={values[from] ? ON : OFF} strokeWidth={values[from] ? 2.5 : 1.5} />
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[420px]" role="img" aria-label="Схема">
      {gates.map((g) => {
        const p = pos[g.id]
        const two = GATE_INFO[g.type].arity === 2
        return <g key={g.id + 'w'}>{wire(g.a, p.x, two ? p.y - 10 : p.y, g.id + 'a')}{two && wire(g.b, p.x, p.y + 10, g.id + 'b')}</g>
      })}
      {outs.map(([name, src], k) => wire(src, W - 80, (H / (outs.length + 1)) * (k + 1), 'o' + name))}
      {inputs.map((i) => (
        <g key={i} transform={`translate(${pos[i].x},${pos[i].y})`}>
          <rect x={-14} y={-14} width={40} height={28} rx={6} fill="#0A0E16" stroke={values[i] ? ON : '#334155'} />
          <text x={6} y={5} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fill={values[i] ? ON : '#94A3B8'}>{i}={values[i]}</text>
        </g>
      ))}
      {gates.map((g) => (
        <g key={g.id} transform={`translate(${pos[g.id].x},${pos[g.id].y})`}>
          <rect x={0} y={-20} width={64} height={40} rx={8} fill="#111827" stroke={values[g.id] ? ON : '#6366F1'} strokeWidth={1.5} />
          <text x={32} y={-2} textAnchor="middle" fontSize="11" fontWeight="700" fill="#C0C1FF">{GATE_INFO[g.type].label}</text>
          <text x={32} y={13} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fill="#64748B">{g.id}</text>
        </g>
      ))}
      {outs.map(([name, src], k) => {
        const y = (H / (outs.length + 1)) * (k + 1)
        return (
          <g key={name} transform={`translate(${W - 80},${y})`}>
            <circle r={13} fill={values[src] ? 'rgba(79,219,200,0.25)' : '#0A0E16'} stroke={values[src] ? ON : '#334155'} strokeWidth={2} />
            <text x={22} y={5} fontSize="13" fontFamily="JetBrains Mono" fill={values[src] ? ON : '#94A3B8'}>{name}={values[src]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Конструктор схем: добавляешь вентили, соединяешь, сверяешь таблицу истинности с целью. */
export default function LogicBuilder({ task, onSolved }: { task: LogicTask; onSolved: (attempts: number) => void }) {
  const [gates, setGates] = useState<Gate[]>([])
  const [outMap, setOutMap] = useState<Record<string, string>>({})
  const [probe, setProbe] = useState<Record<string, Bit>>({})
  const [attempts, setAttempts] = useState(0)
  const [verdict, setVerdict] = useState<null | { ok: boolean; msg: string }>(null)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    setGates([]); setOutMap(Object.fromEntries(task.outputs.map((o) => [o.name, '']))); setVerdict(null); setAttempts(0); setHint(false)
    setProbe(Object.fromEntries(task.inputs.map((i) => [i, 0 as Bit])))
  }, [task.id]) // eslint-disable-line

  const values = useMemo(() => evaluate(probe, gates), [probe, gates])
  const table = useMemo(() => combos(task.inputs).map((row) => {
    const v = evaluate(row, gates)
    return { row, got: task.outputs.map((o) => (outMap[o.name] ? v[outMap[o.name]] : null)), want: task.outputs.map((o) => o.target(row)) }
  }), [gates, outMap, task])

  const add = (type: GateType) => {
    if (gates.length >= task.maxGates) return
    const id = `g${gates.length + 1}`
    const src = sourcesFor(task.inputs, gates, gates.length)
    setGates([...gates, { id, type, a: src[0], b: src[Math.min(1, src.length - 1)] }])
    setVerdict(null)
  }
  const update = (i: number, patch: Partial<Gate>) => { setGates(gates.map((g, k) => (k === i ? { ...g, ...patch } : g))); setVerdict(null) }
  const removeLast = () => {
    const last = gates[gates.length - 1]
    setGates(gates.slice(0, -1))
    setOutMap(Object.fromEntries(Object.entries(outMap).map(([k, v]) => [k, v === last?.id ? '' : v])))
    setVerdict(null)
  }
  const check = () => {
    setAttempts((a) => a + 1)
    if (task.outputs.some((o) => !outMap[o.name])) { setVerdict({ ok: false, msg: 'Подключи каждый выход схемы к какому-нибудь вентилю или входу.' }); return }
    const bad = table.filter((r) => r.got.some((g, k) => g !== r.want[k]))
    if (bad.length) {
      const r = bad[0]
      setVerdict({ ok: false, msg: `Не совпадает ${bad.length} из ${table.length} строк. Например, при ${task.inputs.map((i) => `${i}=${r.row[i]}`).join(', ')} нужно ${task.outputs.map((o, k) => `${o.name}=${r.want[k]}`).join(', ')}, а схема даёт ${task.outputs.map((o, k) => `${o.name}=${r.got[k]}`).join(', ')}.` })
      return
    }
    setVerdict({ ok: true, msg: `Схема работает на всех ${table.length} комбинациях входов. Вентилей: ${gates.length}.` })
    onSolved(attempts + 1)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet/30 bg-violet/5 p-4">
        <div className="label text-violet-soft">Задача</div>
        <div className="font-semibold mt-1">{task.title}</div>
        <p className="text-sm text-mute mt-1">{task.brief}</p>
        <div className="text-xs text-dim mt-2">Разрешено: {task.allowed.map((t) => GATE_INFO[t].label).join(', ')} · не больше {task.maxGates} вентилей</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="card p-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Палитра</span>
            {task.allowed.map((t) => (
              <button key={t} onClick={() => add(t)} disabled={gates.length >= task.maxGates} className="btn-secondary !py-1.5 !px-3 text-xs"><Icon name="add" className="text-[16px]" />{GATE_INFO[t].label}</button>
            ))}
            {gates.length > 0 && <button onClick={removeLast} className="btn-ghost !py-1.5 !px-2 text-xs ml-auto"><Icon name="undo" className="text-[16px]" />Убрать последний</button>}
          </div>
          <div className="mt-3 rounded-lg border border-line bg-[#0A0E16] grid-bg overflow-x-auto">
            <Diagram inputs={task.inputs} gates={gates} values={values} outMap={outMap} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <span className="text-dim">Пощёлкай входы:</span>
            {task.inputs.map((i) => (
              <button key={i} onClick={() => setProbe({ ...probe, [i]: (probe[i] ? 0 : 1) as Bit })} className={`chip border font-mono ${probe[i] ? 'border-teal bg-teal/15 text-teal-soft' : 'border-line text-mute'}`}>{i} = {probe[i] ?? 0}</button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {gates.length === 0 && <p className="text-sm text-dim">Добавь вентиль из палитры. Каждый вентиль может брать сигналы со входов схемы или с выходов вентилей, добавленных раньше.</p>}
            {gates.map((g, i) => {
              const src = sourcesFor(task.inputs, gates, i)
              const two = GATE_INFO[g.type].arity === 2
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm font-mono">
                  <span className="text-dim w-7">{g.id}</span><span>=</span>
                  <span className="text-violet-soft font-bold">{g.type}</span>(
                  <select aria-label={`${g.id} вход 1`} value={g.a} onChange={(e) => update(i, { a: e.target.value })} className="input !w-auto !py-1 !px-2">{src.map((x) => <option key={x}>{x}</option>)}</select>
                  {two && <>,<select aria-label={`${g.id} вход 2`} value={g.b} onChange={(e) => update(i, { b: e.target.value })} className="input !w-auto !py-1 !px-2">{src.map((x) => <option key={x}>{x}</option>)}</select></>})
                  <span className={`ml-auto chip ${values[g.id] ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}>{values[g.id]}</span>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-3 pt-1">
              {task.outputs.map((o) => (
                <label key={o.name} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-amber-soft">выход {o.name} ←</span>
                  <select value={outMap[o.name] ?? ''} onChange={(e) => { setOutMap({ ...outMap, [o.name]: e.target.value }); setVerdict(null) }} className="input !w-auto !py-1 !px-2 font-mono">
                    <option value="">—</option>
                    {[...task.inputs, ...gates.map((g) => g.id)].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">Таблица истинности</div>
          <table className="w-full text-sm font-mono">
            <thead><tr className="text-dim text-xs">{task.inputs.map((i) => <th key={i} className="py-1 text-left">{i}</th>)}{task.outputs.map((o) => <th key={o.name} className="py-1 text-left">{o.name} нужно</th>)}{task.outputs.map((o) => <th key={o.name + 'g'} className="py-1 text-left">схема</th>)}</tr></thead>
            <tbody>
              {table.map((r, k) => {
                const ok = r.got.every((g, j) => g === r.want[j])
                return (
                  <tr key={k} className="border-t border-line">
                    {task.inputs.map((i) => <td key={i} className="py-1">{r.row[i]}</td>)}
                    {r.want.map((w, j) => <td key={j} className="py-1 text-amber-soft">{w}</td>)}
                    {r.got.map((g, j) => <td key={j} className={`py-1 ${g === null ? 'text-dim' : ok ? 'text-teal-soft' : 'text-rose-soft'}`}>{g ?? '·'}</td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button onClick={check} className="btn-primary w-full mt-4"><Icon name="fact_check" className="text-[18px]" />Проверить схему</button>
          {task.hint && !verdict?.ok && <button onClick={() => setHint(true)} className="btn-ghost w-full mt-2 text-xs">Подсказка</button>}
          {hint && task.hint && !verdict?.ok && <p className="text-xs text-mute mt-2 pop">{task.hint}</p>}
          {verdict && <div className={`mt-3 rounded-lg p-3 text-sm pop ${verdict.ok ? 'bg-teal/10' : 'bg-rose/10'}`}><b className={verdict.ok ? 'text-teal-soft' : 'text-rose-soft'}>{verdict.ok ? 'Работает!' : 'Пока нет.'}</b> {verdict.msg}</div>}
        </div>
      </div>
    </div>
  )
}
