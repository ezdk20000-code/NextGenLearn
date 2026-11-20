import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { labById, nodeById, trackById } from '../data'
import { useStore } from '../store'
import { KINDS, PRIORITIES, PRIORITY_ORDER, STATUSES, dateKey, type Priority, type Task, type TaskKind, type TaskStatus } from '../lib/tasks'
import { DuePill, PriorityChip, StatusChip, TaskCard } from '../components/task-ui'
import { Icon, Ring } from '../components/ui'

type View = 'board' | 'list' | 'calendar'
const DAY = 86_400_000

export default function PlanBoard() {
  const s = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'board'
  const [prio, setPrio] = useState<Priority | null>(null)
  const [track, setTrack] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const now = Date.now()
  const today = dateKey(now)
  const tasks = s.tasks.filter((t) => (!prio || t.priority === prio) && (!track || t.trackId === track))
  const sprintDay = Math.min(s.sprint.days, Math.floor((now - s.sprint.start) / DAY) + 1)
  const sprintTasks = s.tasks.filter((t) => t.createdAt <= s.sprint.start + s.sprint.days * DAY)
  const sprintDone = sprintTasks.filter((t) => t.status === 'done').length
  const doing = s.tasks.filter((t) => t.status === 'doing')
  const hotToday = s.tasks.filter((t) => t.status !== 'done' && t.due && dateKey(t.due) === today)
  const goal = s.prefs.dailyMinutes
  const current = doing.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0]
  const deadlines = s.tasks.filter((t) => t.status !== 'done' && t.due && t.due - now < 48 * 3_600_000).sort((a, b) => a.due! - b.due!)

  const greet = new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <div className="font-mono text-[11px] tracking-wider text-violet-soft uppercase">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} · Учебный спринт #{s.sprint.n} · день {sprintDay} из {s.sprint.days}
          </div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">Мои учебные задачи</h1>
          <p className="text-mute mt-1">{greet}, {s.name}! {hotToday.length ? <>Сегодня <b className="text-ink">{hotToday.length} {hotToday.length === 1 ? 'задача' : 'задачи'}</b> с дедлайном.</> : 'Горящих дедлайнов сегодня нет.'}</p>
        </div>
        <div className="flex gap-2">
          <Link to={current ? `/focus?task=${current.id}` : '/focus'} className="btn-secondary"><Icon name="timer" className="text-[18px]" />Фокус-сессия</Link>
          <button onClick={() => setCreating(true)} className="btn-primary"><Icon name="add" className="text-[18px]" />Новая задача</button>
        </div>
      </div>

      {/* Сводка */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
        <Metric label="Выполнено в спринте" value={`${sprintDone} / ${sprintTasks.length}`} hint={`${Math.round((sprintDone / Math.max(1, sprintTasks.length)) * 100)}% плана`} bar={sprintDone / Math.max(1, sprintTasks.length)} />
        <Metric label="В работе" value={`${doing.length} ${doing.length === 1 ? 'задача' : 'задачи'}`} hint={`${hotToday.length} с дедлайном сегодня`} />
        <Metric label="Фокус сегодня" value={`${s.focusMinutes} мин`} hint={`цель ${goal} мин · ${Math.min(100, Math.round((s.focusMinutes / goal) * 100))}%`} bar={Math.min(1, s.focusMinutes / goal)} tone="teal" />
        <div className="card p-4 flex items-center gap-3">
          <Ring value={(sprintDay / s.sprint.days) * 100} size={52} stroke={5}><span className="font-mono text-xs">{s.sprint.days - sprintDay}д</span></Ring>
          <div className="min-w-0"><div className="font-mono text-[10px] uppercase tracking-wider text-dim">Цель спринта</div><div className="text-sm font-semibold leading-snug mt-0.5 line-clamp-2">{s.sprint.goal}</div></div>
        </div>
      </div>

      {/* Переключатели */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">
        <div className="flex rounded-lg bg-[#0A0E16] border border-line p-1 shrink-0">
          {([['board', 'view_kanban', 'Канбан'], ['list', 'list', 'Список'], ['calendar', 'calendar_month', 'Календарь']] as const).map(([v, ic, t]) => (
            <button key={v} onClick={() => setParams({ view: v })} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === v ? 'bg-violet text-white' : 'text-dim hover:text-ink'}`}><Icon name={ic} className="text-[16px]" />{t}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 min-w-0">
          <button onClick={() => setPrio(null)} className={`chip !text-[11px] border shrink-0 ${!prio ? 'border-violet text-violet-soft bg-violet/10' : 'border-line text-dim'}`}>Все приоритеты</button>
          {PRIORITIES.map((p) => <button key={p.id} onClick={() => setPrio(prio === p.id ? null : p.id)} className={`chip !text-[11px] border shrink-0 ${prio === p.id ? 'border-violet text-violet-soft bg-violet/10' : 'border-line text-dim'}`}>{p.label}</button>)}
          <span className="w-px bg-line mx-1 shrink-0 hidden sm:block" />
          {s.enrolled.map((tid) => <button key={tid} onClick={() => setTrack(track === tid ? null : tid)} className={`chip !text-[11px] font-mono border shrink-0 ${track === tid ? 'border-teal text-teal-soft bg-teal/10' : 'border-line text-dim'}`}>#{trackById(tid)!.category.replace(/\s+/g, '')}</button>)}
        </div>
        <div className="xl:ml-auto">
          <button onClick={() => { const n = s.enrolled.reduce((a, tid) => a + s.addTrackTasks(tid), 0); s.notify(n ? `Добавлено задач из треков: ${n}` : 'Все ближайшие уроки уже в плане') }} className="btn-ghost !py-1.5 text-xs"><Icon name="playlist_add" className="text-[18px]" />Задачи из треков</button>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {view === 'board' && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {STATUSES.map((st) => {
                const col = tasks.filter((t) => t.status === st.id).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.due ?? Infinity) - (b.due ?? Infinity))
                return (
                  <section key={st.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || dragId; if (id) { s.moveTask(id, st.id); const t = s.tasks.find((x) => x.id === id); if (st.id === 'done' && t?.criteria.some((c) => !c.done)) s.notify('Сначала самопроверка: отметь критерии усвоения') } setDragId(null) }}
                    className={`rounded-lg border border-[rgba(148,163,184,0.06)] bg-[#0F172A] p-2.5 min-h-[160px] ${dragId ? 'ring-1 ring-violet/20' : ''}`}>
                    <div className="flex items-center gap-2 px-1.5 py-1.5">
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      <span className="text-sm font-semibold">{st.label}</span>
                      <span className="font-mono text-[11px] text-dim">{col.length}</span>
                    </div>
                    <div className="text-[11px] text-dim px-1.5 mb-2">{st.hint}</div>
                    <div className="space-y-2">
                      {col.map((t) => <TaskCard key={t.id} t={t} onDragStart={setDragId} compact={st.id === 'done'} />)}
                    </div>
                    {st.id === 'todo' && <QuickAdd />}
                  </section>
                )
              })}
            </div>
          )}

          {view === 'list' && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-dim border-b border-line">
                  <th className="p-3">Ключ</th><th className="p-3">Задача</th><th className="p-3">Статус</th><th className="p-3">Приоритет</th><th className="p-3">Срок</th><th className="p-3 text-right">Фокус</th>
                </tr></thead>
                <tbody>
                  {[...tasks].sort((a, b) => STATUSES.findIndex((x) => x.id === a.status) - STATUSES.findIndex((x) => x.id === b.status) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]).map((t) => (
                    <tr key={t.id} onClick={() => nav(`/plan/task/${t.id}`)} className="border-b border-line last:border-0 hover:bg-s2/50 cursor-pointer">
                      <td className="p-3 font-mono text-xs text-dim">{t.key}</td>
                      <td className="p-3"><div className="flex items-center gap-2"><Icon name={KINDS[t.kind].icon} className="text-[16px] text-dim" /><span className={t.status === 'done' ? 'line-through text-mute' : 'font-medium'}>{t.title}</span></div></td>
                      <td className="p-3"><StatusChip s={t.status} /></td>
                      <td className="p-3"><PriorityChip p={t.priority} /></td>
                      <td className="p-3"><DuePill due={t.due} done={t.status === 'done'} /></td>
                      <td className="p-3 text-right font-mono text-xs text-teal-soft">{t.focusMin ? `${t.focusMin}м` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'calendar' && <DayCalendar tasks={tasks} />}
        </div>

        {/* Правая колонка */}
        <aside className="space-y-4">
          <div className="card p-4 shadow-glow-violet">
            <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-violet-soft">Текущий фокус</span>{current && <span className="font-mono text-[10px] text-dim">{current.key}</span>}</div>
            {current ? (
              <>
                <Link to={`/plan/task/${current.id}`} className="block font-semibold mt-2 hover:text-violet-soft">{current.title}</Link>
                <div className="font-mono text-2xl font-semibold mt-2">{current.focusMin} <span className="text-sm text-dim">/ {current.estimate} мин</span></div>
                <div className="h-1.5 rounded-full bg-s2 overflow-hidden mt-2"><div className="h-full bg-gradient-to-r from-violet to-[#8B5CF6]" style={{ width: `${Math.min(100, (current.focusMin / current.estimate) * 100)}%` }} /></div>
                <Link to={`/focus?task=${current.id}`} className="btn-primary w-full mt-3 !py-2"><Icon name="play_arrow" fill className="text-[18px]" />Продолжить фокус</Link>
              </>
            ) : <p className="text-sm text-mute mt-2">Перетащи задачу в «В работе», чтобы начать.</p>}
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3"><span className="font-mono text-[10px] uppercase tracking-wider text-dim">Дедлайны · 48 ч</span><span className="font-mono text-[11px] text-amber-soft">{deadlines.length}</span></div>
            {deadlines.length === 0 && <p className="text-sm text-dim">Ничего не горит.</p>}
            <ul className="space-y-2.5">
              {deadlines.map((t) => {
                const h = Math.round((t.due! - now) / 3_600_000)
                return (
                  <li key={t.id}><Link to={`/plan/task/${t.id}`} className="flex items-center gap-2 text-sm hover:text-violet-soft">
                    <span className={`w-1.5 h-1.5 rounded-full ${h < 0 ? 'bg-rose' : h < 6 ? 'bg-amber' : 'bg-violet'}`} />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="font-mono text-[11px] text-dim">{h < 0 ? 'просрочено' : `через ${h} ч`}</span>
                  </Link></li>
                )
              })}
            </ul>
          </div>
          <Activity />
        </aside>
      </div>

      {creating && <NewTaskModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function Metric({ label, value, hint, bar, tone = 'violet' }: { label: string; value: string; hint: string; bar?: number; tone?: 'violet' | 'teal' }) {
  return (
    <div className="card p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className="text-xl font-bold mt-1.5">{value}</div>
      {bar !== undefined && <div className="h-1 rounded-full bg-s2 overflow-hidden mt-2"><div className={`h-full ${tone === 'teal' ? 'bg-teal' : 'bg-gradient-to-r from-violet to-[#8B5CF6]'}`} style={{ width: `${bar * 100}%` }} /></div>}
      <div className="font-mono text-[11px] text-dim mt-1.5">{hint}</div>
    </div>
  )
}

function QuickAdd() {
  const s = useStore()
  const [v, setV] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; s.addTask({ title: v.trim(), kind: 'practice', trackId: s.activeTrack, priority: 'med' }); setV('') }} className="mt-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Быстрая задача" aria-label="Быстрая задача"
        className="w-full rounded-lg border border-dashed border-[rgba(148,163,184,0.2)] bg-transparent px-3 py-2 text-xs text-ink placeholder:text-dim outline-none focus:border-violet" />
    </form>
  )
}

function Activity() {
  const s = useStore()
  const items = [
    ...s.events.map((e) => ({ at: e.at, icon: e.type === 'lesson' ? 'menu_book' : e.type === 'lab' ? 'science' : e.type === 'focus' ? 'timer' : 'flag',
      text: e.type === 'lesson' ? `Урок «${nodeById(e.ref)?.title ?? e.ref}» пройден` : e.type === 'lab' ? `Лаборатория «${labById(e.ref)?.title ?? e.ref}»` : e.type === 'focus' ? `Фокус ${e.minutes} мин${s.tasks.find((t) => t.id === e.ref) ? ` · ${s.tasks.find((t) => t.id === e.ref)!.key}` : ''}` : e.type === 'enroll' ? `Новый трек: ${trackById(e.ref)?.title}` : 'Новая карточка' })),
    ...s.tasks.filter((t) => t.doneAt).map((t) => ({ at: t.doneAt!, icon: 'task_alt', text: `${t.key} закрыта: ${t.title}` })),
  ].sort((a, b) => b.at - a.at).slice(0, 6)
  const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60_000); return m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : `${Math.round(m / 1440)} дн назад` }
  return (
    <div className="card p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-dim mb-3">Активность</div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <Icon name={it.icon} className="text-[18px] text-violet-soft mt-0.5" />
            <div className="min-w-0"><div className="text-mute leading-snug">{it.text}</div><div className="font-mono text-[10px] text-dim mt-0.5">{ago(it.at)}</div></div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Календарь дня по часам (макет _15). */
function DayCalendar({ tasks }: { tasks: Task[] }) {
  const s = useStore()
  const [day, setDay] = useState(dateKey(Date.now()))
  const week = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x })
  }, [])
  const H0 = 8, H1 = 23, PX = 64
  const slotted = tasks.filter((t) => t.slot?.date === day).sort((a, b) => a.slot!.start.localeCompare(b.slot!.start))
  const dueToday = tasks.filter((t) => t.due && dateKey(t.due) === day && t.status !== 'done')
  const unscheduled = tasks.filter((t) => !t.slot && t.status !== 'done')
  const minutes = slotted.reduce((a, t) => a + t.estimate, 0)
  const top = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return ((h - H0) + m / 60) * PX }
  const nowTop = ((new Date().getHours() - H0) + new Date().getMinutes() / 60) * PX
  const isToday = day === dateKey(Date.now())
  const freeHour = () => { for (let h = 9; h < 22; h++) { const st = `${String(h).padStart(2, '0')}:00`; if (!slotted.some((t) => t.slot!.start === st)) return st } return '21:00' }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="card p-4 min-w-0">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {week.map((d) => {
            const k = dateKey(d.getTime()); const n = s.tasks.filter((t) => t.slot?.date === k).length
            return (
              <button key={k} onClick={() => setDay(k)} className={`flex-1 min-w-[52px] rounded-lg py-2 text-center ${k === day ? 'bg-violet text-white shadow-glow' : 'text-mute hover:bg-s2'}`}>
                <div className="font-mono text-[10px] uppercase">{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                <div className="text-lg font-bold">{d.getDate()}</div>
                <div className="flex justify-center gap-0.5 h-1">{Array.from({ length: Math.min(4, n) }).map((_, i) => <span key={i} className={`w-1 h-1 rounded-full ${k === day ? 'bg-white' : 'bg-violet'}`} />)}</div>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-4 font-mono text-[11px] text-dim mt-4 mb-3">
          <span>Блоков: <b className="text-ink">{slotted.length}</b></span>
          <span>Учёба: <b className="text-ink">{(minutes / 60).toFixed(1)} ч</b></span>
          <span>Дедлайнов: <b className={dueToday.length ? 'text-rose-soft' : 'text-ink'}>{dueToday.length}</b></span>
        </div>
        <div className="relative overflow-y-auto max-h-[640px]" style={{ height: (H1 - H0) * PX }}>
          {Array.from({ length: H1 - H0 }, (_, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-line" style={{ top: i * PX }}>
              <span className="absolute -top-2 left-0 w-12 font-mono text-[10px] text-dim bg-s1 pr-1">{String(H0 + i).padStart(2, '0')}:00</span>
            </div>
          ))}
          {isToday && nowTop > 0 && nowTop < (H1 - H0) * PX && <div className="absolute left-12 right-0 h-px bg-rose z-10" style={{ top: nowTop }}><span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose" /></div>}
          {slotted.map((t) => {
            const st = STATUSES.find((x) => x.id === t.status)!
            return (
              <Link key={t.id} to={`/plan/task/${t.id}`} className={`absolute left-14 right-1 rounded-lg border p-2.5 overflow-hidden hover:border-violet/60 ${t.status === 'done' ? 'opacity-50 border-line bg-s2' : t.priority === 'crit' ? 'border-[#F43F5E]/40 bg-[#F43F5E]/10' : 'border-violet/30 bg-violet/10'}`}
                style={{ top: top(t.slot!.start) + 2, height: Math.max(54, (t.estimate / 60) * PX - 4) }}>
                <div className="flex items-center gap-2 font-mono text-[10px] text-dim"><span>{t.slot!.start}</span><span>·</span><span>{t.estimate} мин</span><span>·</span><span>{t.key}</span><span className="flex-1" /><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /></div>
                <div className="text-sm font-semibold truncate mt-0.5">{t.title}</div>
              </Link>
            )
          })}
          {dueToday.map((t) => (
            <div key={'d' + t.id} className="absolute left-14 right-1 border-t-2 border-dashed border-rose/70" style={{ top: Math.min((H1 - H0) * PX - 2, top(new Date(t.due!).toTimeString().slice(0, 5))) }}>
              <span className="absolute right-0 -top-5 font-mono text-[10px] text-rose-soft bg-s1 px-1">ДЕДЛАЙН · {t.key}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4 self-start">
        <div className="font-mono text-[10px] uppercase tracking-wider text-dim mb-3">Без времени · {unscheduled.length}</div>
        <ul className="space-y-2">
          {unscheduled.map((t) => (
            <li key={t.id} className="rounded-lg border border-line p-2.5">
              <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-dim">{t.key}</span><PriorityChip p={t.priority} /></div>
              <div className="text-sm font-medium mt-1">{t.title}</div>
              <button onClick={() => { const st = freeHour(); s.updateTask(t.id, { slot: { date: day, start: st } }); s.notify(`${t.key} запланирована на ${st}`) }} className="text-xs text-violet-soft hover:underline mt-1.5">Запланировать на этот день</button>
            </li>
          ))}
          {unscheduled.length === 0 && <li className="text-sm text-dim">Всё распланировано.</li>}
        </ul>
      </div>
    </div>
  )
}

function NewTaskModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('reading')
  const [trackId, setTrackId] = useState<string>(s.activeTrack)
  const [priority, setPriority] = useState<Priority>('med')
  const [estimate, setEstimate] = useState(25)
  const [due, setDue] = useState('')
  const [subs, setSubs] = useState('')
  const [crit, setCrit] = useState('')
  const [status] = useState<TaskStatus>('todo')
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const id = s.addTask({
      title: title.trim(), kind, trackId, priority, estimate, status, due: due ? new Date(due).getTime() : null,
      subtasks: lines(subs).map((t, i) => ({ id: `s${i}${Date.now()}`, t, done: false })),
      criteria: lines(crit).map((t, i) => ({ id: `c${i}${Date.now()}`, t, done: false })),
    })
    s.notify('Задача создана')
    onClose()
    nav(`/plan/task/${id}`)
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl border border-violet/25 bg-[rgba(30,41,59,0.97)] backdrop-blur-md p-5 space-y-3 pop max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between"><div className="font-bold text-lg">Новая учебная задача</div><button type="button" onClick={onClose} className="btn-ghost !p-1.5" aria-label="Закрыть"><Icon name="close" /></button></div>
        <input id="task-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: прочитать главу 3 «Транспортный уровень»" autoFocus />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KINDS) as TaskKind[]).filter((k) => k !== 'lesson' && k !== 'lab').map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`chip border ${kind === k ? 'border-violet bg-violet/10 text-violet-soft' : 'border-line text-mute'}`}><Icon name={KINDS[k].icon} className="text-[14px]" />{KINDS[k].label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-dim" htmlFor="task-track">Трек
            <select id="task-track" className="input mt-1 !py-2" value={trackId} onChange={(e) => setTrackId(e.target.value)}>{s.enrolled.map((t) => <option key={t} value={t}>{trackById(t)!.title}</option>)}</select>
          </label>
          <label className="text-xs text-dim" htmlFor="task-prio">Приоритет
            <select id="task-prio" className="input mt-1 !py-2" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </label>
          <label className="text-xs text-dim" htmlFor="task-est">Оценка, мин
            <input id="task-est" type="number" min={5} max={480} className="input mt-1 !py-2" value={estimate} onChange={(e) => setEstimate(+e.target.value || 25)} />
          </label>
          <label className="text-xs text-dim" htmlFor="task-due">Дедлайн
            <input id="task-due" type="datetime-local" className="input mt-1 !py-2" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <label className="block text-xs text-dim" htmlFor="task-subs">Шаги (по одному в строке)
          <textarea id="task-subs" className="input mt-1 min-h-[70px]" value={subs} onChange={(e) => setSubs(e.target.value)} placeholder={'Прочитать раздел\nВыписать термины'} />
        </label>
        <label className="block text-xs text-dim" htmlFor="task-crit">Критерии усвоения — как поймёшь, что разобрался
          <textarea id="task-crit" className="input mt-1 min-h-[60px]" value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="Объясню разницу между TCP и UDP за минуту" />
        </label>
        <button className="btn-primary w-full" disabled={!title.trim()}>Создать задачу</button>
      </form>
    </div>
  )
}
