import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayKey, useStore } from '../store'
import { PRIORITY_ORDER } from '../lib/tasks'
import { PriorityChip } from '../components/task-ui'
import { Icon, Ring } from '../components/ui'

const AMBIENT = ['Тишина', 'Альфа 10 Гц', 'Дождь в лесу', 'Коричневый шум', 'Кофейня']
const ROUNDS = 4

export default function FocusSession() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const candidates = s.tasks.filter((t) => t.status === 'doing' || t.status === 'todo').sort((a, b) => (a.status === 'doing' ? -1 : 1) - (b.status === 'doing' ? -1 : 1) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  const task = s.tasks.find((t) => t.id === params.get('task')) ?? candidates[0]

  const [len, setLen] = useState(25)
  const [left, setLeft] = useState(25 * 60)
  const [run, setRun] = useState(false)
  const [brk, setBrk] = useState(false)
  const [turbo, setTurbo] = useState(false)
  const [amb, setAmb] = useState(s.prefs.autoAmbient ? AMBIENT[1] : AMBIENT[0])
  const [vol, setVol] = useState(65)
  const [thought, setThought] = useState('')

  const today = dayKey(Date.now())
  const sessionsToday = s.events.filter((e) => e.type === 'focus' && dayKey(e.at) === today)
  const round = Math.min(ROUNDS, sessionsToday.filter((e) => e.ref === task?.id).length + 1)
  let focusStreak = 0
  const focusDays = new Set(s.events.filter((e) => e.type === 'focus').map((e) => dayKey(e.at)))
  for (let d = focusDays.has(today) ? 0 : 1; focusDays.has(dayKey(Date.now() - d * 86_400_000)); d++) focusStreak++

  useEffect(() => {
    if (!run) return
    const t = window.setInterval(() => setLeft((x) => Math.max(0, x - (turbo ? 60 : 1))), 1000)
    return () => window.clearInterval(t)
  }, [run, turbo])
  useEffect(() => {
    if (left !== 0 || !run) return
    setRun(false)
    if (brk) { setBrk(false); setLeft(len * 60); s.notify('Перерыв окончен — следующий раунд'); return }
    if (task) s.logTaskFocus(task.id, len); else s.addFocus(len)
    s.notify(`Раунд завершён · ${len} мин в ${task?.key ?? 'фокус'} · +20 XP`)
    setBrk(true); setLeft(5 * 60)
  }, [left, run]) // eslint-disable-line

  const total = (brk ? 5 : len) * 60
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const current = task?.subtasks.find((c) => !c.done)
  const parked = task?.comments.filter((c) => c.parked) ?? []

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-teal-soft flex items-center gap-2">{run && <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />}Глубокий фокус · раунд {round} / {ROUNDS}</div>
          {task ? (
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2"><span className="font-mono text-base text-dim mr-2">#{task.key}</span>{task.title}</h1>
          ) : <h1 className="text-2xl font-extrabold mt-2">Фокус-сессия</h1>}
        </div>
        <select aria-label="Задача" value={task?.id ?? ''} onChange={(e) => setParams({ task: e.target.value })} className="input !w-auto !py-2 max-w-xs">
          {candidates.map((t) => <option key={t.id} value={t.id}>{t.key} · {t.title}</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card p-6 shadow-glow-teal">
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: ROUNDS }).map((_, i) => <span key={i} className={`h-1.5 w-10 rounded-full ${i < round - 1 ? 'bg-teal' : i === round - 1 ? 'bg-violet' : 'bg-s2'}`} />)}
          </div>
          <div className="grid place-items-center">
            <Ring value={100 - (left / total) * 100} size={240} stroke={10}>
              <div className="text-center">
                <div className={`font-mono text-[11px] uppercase tracking-wider ${brk ? 'text-amber-soft' : 'text-violet-soft'}`}>{brk ? 'перерыв' : 'фокус'}</div>
                <div className="font-mono text-6xl font-semibold tracking-tight mt-1">{mm}:{ss}</div>
                <div className="text-xs text-dim mt-1">{brk ? 'встань, разомнись, попей воды' : 'до 5-минутного перерыва'}</div>
              </div>
            </Ring>
          </div>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button onClick={() => setLeft((x) => x + 300)} className="btn-ghost !px-3 font-mono text-xs" aria-label="Добавить 5 минут">+5м</button>
            <button onClick={() => setRun((r) => !r)} className="w-16 h-16 rounded-full bg-violet grid place-items-center shadow-glow" aria-label="Старт или пауза"><Icon name={run ? 'pause' : 'play_arrow'} fill className="text-[32px]" /></button>
            <button onClick={() => { setRun(false); setBrk(false); setLeft(len * 60) }} className="btn-ghost !p-3 rounded-full" aria-label="Сброс"><Icon name="restart_alt" /></button>
            <button onClick={() => setTurbo((t) => !t)} className={`btn-ghost !p-3 rounded-full ${turbo ? '!text-amber-soft' : ''}`} title="Демо: ускорить ×60" aria-label="Ускорить"><Icon name="fast_forward" /></button>
          </div>
          <div className="flex justify-center gap-1 mt-4">
            {[25, 50].map((m) => <button key={m} onClick={() => { setLen(m); if (!brk) setLeft(m * 60); setRun(false) }} className={`px-3 py-1 rounded-md font-mono text-xs ${len === m ? 'bg-s2 text-ink' : 'text-dim'}`}>{m} мин</button>)}
          </div>
          {turbo && <div className="text-center text-[11px] text-amber-soft mt-2">демо-режим: 1 секунда = 1 минута</div>}

          <div className="mt-6 rounded-lg border border-line p-4">
            <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-dim">Фон</span><span className="font-mono text-[11px] text-dim">{amb} · {vol}%</span></div>
            <div className="flex flex-wrap gap-1.5 mt-2">{AMBIENT.map((a) => <button key={a} onClick={() => setAmb(a)} className={`chip border ${amb === a ? 'border-teal bg-teal/10 text-teal-soft' : 'border-line text-mute'}`}>{a}</button>)}</div>
            <input aria-label="Громкость" type="range" min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} className="w-full mt-3 accent-teal" />
            <div className="text-[11px] text-dim">Звук появится в рабочей версии.</div>
          </div>
        </div>

        <aside className="space-y-4">
          {task && (
            <div className="card p-4">
              <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-dim">Текущие шаги</span><span className="font-mono text-[11px] text-dim">{task.subtasks.filter((c) => c.done).length} / {task.subtasks.length}</span></div>
              <ul className="mt-3 space-y-1">
                {task.subtasks.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => s.toggleCheck(task.id, 'subtasks', c.id)} className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm ${c.id === current?.id ? 'bg-violet/10 border border-violet/30' : ''}`}>
                      <span className={`w-4 h-4 rounded-[4px] border grid place-items-center shrink-0 ${c.done ? 'bg-teal border-teal' : 'border-[rgba(148,163,184,0.3)]'}`}>{c.done && <Icon name="check" className="text-[12px] text-white" />}</span>
                      <span className={`flex-1 ${c.done ? 'line-through text-dim' : ''}`}>{c.t}</span>
                      {c.id === current?.id && <span className="font-mono text-[9px] text-violet-soft">В ФОКУСЕ</span>}
                    </button>
                  </li>
                ))}
                {task.subtasks.length === 0 && <li className="text-sm text-dim">Шагов нет — добавь их в карточке задачи.</li>}
              </ul>
              <div className="flex items-center justify-between mt-3">
                <PriorityChip p={task.priority} />
                <Link to={`/plan/task/${task.id}`} className="text-xs text-violet-soft hover:underline">Карточка задачи</Link>
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-dim">Сброс мыслей</div>
            <p className="text-xs text-dim mt-1">Отвлекающая мысль? Запиши и вернись к задаче — она сохранится в заметках задачи.</p>
            <form onSubmit={(e) => { e.preventDefault(); if (thought.trim() && task) { s.addComment(task.id, thought.trim(), true); setThought('') } }} className="flex gap-2 mt-2">
              <input className="input !py-2" value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Записать и забыть…" aria-label="Мысль" />
              <button className="btn-secondary !px-3" aria-label="Записать"><Icon name="arrow_upward" className="text-[18px]" /></button>
            </form>
            {parked.length > 0 && <ul className="mt-2 space-y-1 text-sm text-mute">{parked.slice(-4).reverse().map((c, i) => <li key={i} className="flex gap-2"><Icon name="bookmark" className="text-[15px] text-dim mt-0.5" />{c.text}</li>)}</ul>}
          </div>

          <div className="card p-4 grid grid-cols-3 gap-2 text-center">
            <div><div className="font-mono text-lg font-semibold">{Math.min(100, Math.round((s.focusMinutes / s.prefs.dailyMinutes) * 100))}%</div><div className="text-[10px] text-dim">{s.focusMinutes} из {s.prefs.dailyMinutes} мин</div></div>
            <div><div className="font-mono text-lg font-semibold">{sessionsToday.length}</div><div className="text-[10px] text-dim">сессий сегодня</div></div>
            <div><div className="font-mono text-lg font-semibold text-amber-soft">{focusStreak}</div><div className="text-[10px] text-dim">дней фокуса подряд</div></div>
          </div>
        </aside>
      </div>
    </div>
  )
}
