import { useEffect, useState } from 'react'
import { Icon } from '../components/ui'
import CodeEditor from '../components/CodeEditor'
import { runUserCode } from './runner'
import type { CodeProject, Verdict } from './projects'

const KEY = 'ngl-code-v1'
interface Saved { code: Record<string, string>; stages: Record<string, string[]> }
const load = (): Saved => { try { const r = localStorage.getItem(KEY); if (r) return { code: {}, stages: {}, ...JSON.parse(r) } } catch { /* */ } return { code: {}, stages: {} } }
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* */ } }

interface Row { name: string; status: 'idle' | 'pass' | 'fail'; ms?: number; verdict?: Verdict }

/** Песочница кода: пишешь транслятор на JavaScript, тесты сравнивают с эталоном. */
export default function CodeLab({ project, onDone }: { project: CodeProject; onDone: (mistakes: number) => void }) {
  const [saved, setSaved] = useState<Saved>(load)
  const passed = saved.stages[project.id] ?? []
  const [si, setSi] = useState(() => Math.max(0, project.stages.findIndex((s) => !passed.includes(s.id))))
  const stage = project.stages[si]
  const code = saved.code[project.id] ?? project.starter
  const [rows, setRows] = useState<Row[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(0)
  const [hint, setHint] = useState(0)
  const [runs, setRuns] = useState(0)

  useEffect(() => { setRows(stage.tests.map((t) => ({ name: t.name, status: 'idle' }))); setError(null); setSel(0) }, [si]) // eslint-disable-line

  const setCode = (v: string) => { const s = { ...saved, code: { ...saved.code, [project.id]: v } }; setSaved(s); save(s) }
  const run = async () => {
    setBusy(true); setError(null); setRuns((r) => r + 1)
    const res = await runUserCode(code, project.fn, stage.tests.map((t) => t.input as unknown[]))
    setLogs(res.logs.slice(-200))
    if (res.error) { setError(res.error); setRows(stage.tests.map((t) => ({ name: t.name, status: 'fail' }))); setBusy(false); return }
    const out: Row[] = stage.tests.map((t, k) => {
      let v: Verdict
      try { v = t.check(res.results![k]) } catch (e) { v = { ok: false, msg: `Результат не удалось проверить: ${(e as Error).message}` } }
      return { name: t.name, status: v.ok ? 'pass' : 'fail', ms: res.ms[k], verdict: v }
    })
    setRows(out); setSel(Math.max(0, out.findIndex((r) => r.status === 'fail')))
    setBusy(false)
    if (out.every((r) => r.status === 'pass') && !passed.includes(stage.id)) {
      const s = { ...saved, stages: { ...saved.stages, [project.id]: [...passed, stage.id] } }
      setSaved(s); save(s)
      if (project.stages.every((x) => s.stages[project.id].includes(x.id))) onDone(Math.max(0, runs + 1 - project.stages.length))
    }
  }
  const okCount = rows.filter((r) => r.status === 'pass').length
  const cur = rows[sel]
  const unlocked = (i: number) => i === 0 || project.stages.slice(0, i).every((s) => passed.includes(s.id))

  return (
    <div className="space-y-4" onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!busy) void run() } }}>
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="chip bg-violet/15 text-violet-soft font-mono">JavaScript</span>
        <div className="flex flex-wrap rounded-lg bg-s2/60 p-0.5 text-sm">
          {project.stages.map((s, i) => (
            <button key={s.id} disabled={!unlocked(i)} onClick={() => setSi(i)} className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 ${i === si ? 'bg-violet/25 text-violet-soft' : unlocked(i) ? 'text-mute hover:text-ink' : 'text-dim opacity-60'}`}>
              <Icon name={passed.includes(s.id) ? 'check_circle' : unlocked(i) ? 'radio_button_unchecked' : 'lock'} fill={passed.includes(s.id)} className={`text-[15px] ${passed.includes(s.id) ? 'text-teal-soft' : ''}`} />{s.title}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { if (confirm('Вернуть заготовку? Твой код этого проекта будет стёрт.')) setCode(project.starter) }} className="btn-ghost !py-1.5 text-xs"><Icon name="restart_alt" className="text-[16px]" />Сброс к заготовке</button>
          <button onClick={() => void run()} disabled={busy} className="btn-primary !py-1.5"><Icon name="play_arrow" fill className="text-[18px]" />{busy ? 'Выполняется…' : 'Запустить тесты'}<span className="text-[10px] opacity-70 hidden sm:inline">Ctrl+Enter</span></button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_430px]">
        <section className="space-y-4 min-w-0">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2"><span className="font-bold font-mono">{project.fn}.js</span><code className="text-[11px] text-dim font-mono truncate">{project.signature}</code></div>
            <CodeEditor value={code} onChange={setCode} lang="js" label={`Код функции ${project.fn}`} minH={460} />
            {error && <div className="mt-3 rounded-lg bg-rose/10 border border-rose/30 p-3 text-sm font-mono text-rose-soft pop">Ошибка выполнения: {error}</div>}
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2"><span className="font-bold flex items-center gap-1.5"><Icon name="terminal" className="text-[18px] text-teal-soft" />Консоль</span><button onClick={() => setLogs([])} className="text-xs text-dim hover:text-ink">Очистить</button></div>
            <div className="rounded-lg bg-[#0A0E16] border border-line p-3 font-mono text-xs max-h-48 overflow-y-auto min-h-[3rem]">{logs.length ? logs.map((l, i) => <div key={i} className="text-mute">&gt; {l}</div>) : <span className="text-dim">Здесь появится вывод console.log</span>}</div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between"><span className="font-bold flex items-center gap-1.5"><Icon name="fact_check" className="text-[18px] text-violet-soft" />Тесты</span><span className="text-xs text-dim font-mono">{okCount} из {rows.length} пройдено</span></div>
            <div className="h-1.5 rounded-full bg-s2 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${rows.length ? (okCount / rows.length) * 100 : 0}%` }} /></div>
            <ul className="mt-3 space-y-1.5">
              {rows.map((r, i) => (
                <li key={r.name}>
                  <button onClick={() => setSel(i)} className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left ${r.status === 'fail' ? 'border-rose/40 bg-rose/5' : r.status === 'pass' ? 'border-teal/30' : 'border-line'} ${sel === i ? 'ring-1 ring-violet/60' : ''}`}>
                    <Icon name={r.status === 'pass' ? 'check_circle' : r.status === 'fail' ? 'cancel' : 'radio_button_unchecked'} fill={r.status !== 'idle'} className={`text-[18px] ${r.status === 'pass' ? 'text-teal-soft' : r.status === 'fail' ? 'text-rose-soft' : 'text-dim'}`} />
                    <span className="flex-1 font-mono truncate">{r.name}</span>
                    {r.ms !== undefined && <span className="text-[11px] text-dim font-mono">{r.ms.toFixed(1)} мс</span>}
                    <span className={`chip !py-0.5 !text-[10px] ${r.status === 'pass' ? 'bg-teal/15 text-teal-soft' : r.status === 'fail' ? 'bg-rose/15 text-rose-soft' : 'bg-s2 text-dim'}`}>{r.status === 'pass' ? 'Пройден' : r.status === 'fail' ? 'Ошибка' : 'Ждёт'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {cur?.verdict && (
            <div className="card p-4 pop">
              <div className="font-bold flex items-center gap-1.5"><Icon name="compare_arrows" className="text-[18px] text-amber-soft" />Сравнение с эталоном · <span className="font-mono">{cur.name}</span></div>
              <p className={`text-sm mt-2 ${cur.verdict.ok ? 'text-teal-soft' : 'text-rose-soft'}`}>{cur.verdict.msg}</p>
              {cur.verdict.diff && (
                <table className="w-full mt-3 text-[11px] font-mono">
                  <thead><tr className="text-dim"><th className="text-left py-1">#</th><th className="text-left">Ожидается</th><th className="text-left">Твой вывод</th></tr></thead>
                  <tbody>{cur.verdict.diff.map((d) => {
                    const bad = d.want.replace(/\s+/g, '') !== d.got.replace(/\s+/g, '')
                    return (
                      <tr key={d.line} className={bad ? 'bg-rose/10' : ''}>
                        <td className="py-1 pr-2 text-dim align-top">{d.line}</td>
                        <td className="pr-2 break-all align-top">{d.want}</td>
                        <td className={`break-all align-top ${bad ? 'text-rose-soft' : ''}`}>{d.got}{d.note && <div className="text-amber-soft mt-0.5 font-sans">{d.note}</div>}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              )}
            </div>
          )}
          {passed.includes(stage.id) && si < project.stages.length - 1 && <button onClick={() => setSi(si + 1)} className="btn-primary w-full">Следующий этап: {project.stages[si + 1].title}<Icon name="arrow_forward" className="text-[18px]" /></button>}
          <div className="rounded-lg border border-amber/25 bg-amber/5 p-4 text-sm">
            <div className="flex items-center gap-1.5 text-amber-soft font-semibold text-xs"><Icon name="lightbulb" className="text-[16px]" />Подсказка наставника</div>
            {hint > 0 ? project.hints.slice(0, hint).map((h, i) => <p key={i} className="mt-2 text-mute">{h}</p>) : null}
            {hint < project.hints.length && <button onClick={() => setHint(hint + 1)} className="text-xs text-violet-soft hover:underline mt-2">{hint ? 'Ещё подсказка' : 'Показать подсказку'}</button>}
          </div>
        </aside>
      </div>
      <div className="text-xs text-dim flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal" />Код выполняется в твоём браузере в отдельном потоке · сохраняется автоматически</div>
    </div>
  )
}
