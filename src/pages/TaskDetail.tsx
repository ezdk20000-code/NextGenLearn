import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { labById, nodeById, trackById } from '../data'
import { useStore } from '../store'
import { KINDS, STATUSES, statusOf, type Check } from '../lib/tasks'
import { DuePill, PriorityChip, StatusChip } from '../components/task-ui'
import { Icon } from '../components/ui'
import { useMentorTopic, useAi } from '../ai/AiContext'

export default function TaskDetail() {
  const { id = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const t = s.tasks.find((x) => x.id === id)
  const [sub, setSub] = useState('')
  const [crit, setCrit] = useState('')
  const [comment, setComment] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const ai = useAi()
  useMentorTopic(t ? { title: t.title, summary: t.desc } : null)
  if (!t) return <Navigate to="/plan" replace />

  const track = t.trackId ? trackById(t.trackId) : undefined
  const node = t.nodeId ? nodeById(t.nodeId) : undefined
  const lab = t.labId ? labById(t.labId) : undefined
  const cards = t.nodeId ? s.allCards.filter((c) => c.nodeId === t.nodeId) : []
  const note = t.nodeId ? s.notes[t.nodeId] : undefined
  const subDone = t.subtasks.filter((c) => c.done).length
  const critDone = t.criteria.filter((c) => c.done).length
  const left = t.due ? t.due - Date.now() : null

  return (
    <div className="max-w-6xl mx-auto">
      <Link to="/plan" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />PlanFlow</Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-dim">#{t.key}</span>
        <PriorityChip p={t.priority} />
        <StatusChip s={t.status} />
        <span className="font-mono text-[11px] text-dim">· {KINDS[t.kind].label} · ~{t.estimate} мин</span>
      </div>
      <h1 className="text-2xl md:text-[30px] md:leading-9 font-extrabold tracking-tight mt-2">{t.title}</h1>
      <div className="text-sm text-mute mt-1">{track?.title ?? 'Общее'}{node ? ` / ${node.title}` : ''} · Учебный спринт #{s.sprint.n}</div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] mt-6">
        <div className="space-y-4 min-w-0">
          {/* Статус */}
          <div className="card p-2 flex flex-wrap gap-1">
            {STATUSES.map((st) => (
              <button key={st.id} onClick={() => { s.moveTask(t.id, st.id); if (st.id === 'done' && t.criteria.some((c) => !c.done)) s.notify('Сначала самопроверка: отметь критерии усвоения') }}
                className={`flex-1 min-w-[120px] rounded-md px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 ${t.status === st.id ? 'bg-s2 text-ink' : 'text-dim hover:text-ink'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
              </button>
            ))}
          </div>

          <div className="card p-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-dim">Описание</div>
            <p className="text-[15px] leading-7 mt-2 text-ink/90">{t.desc || 'Без описания.'}</p>
          </div>

          <ChecklistCard title="Критерии усвоения" hint={t.status === 'check' ? 'Отметь всё, что действительно можешь, — задача закроется сама' : 'По ним ты проверишь себя перед закрытием'}
            items={t.criteria} done={critDone} tone="amber" onToggle={(c) => s.toggleCheck(t.id, 'criteria', c)}
            add={crit} setAdd={setCrit} onAdd={() => { s.addCheck(t.id, 'criteria', crit.trim()); setCrit('') }} placeholder="Добавить критерий: «могу объяснить…»" />

          <ChecklistCard title="Шаги" hint={`${subDone} из ${t.subtasks.length}${t.subtasks.length ? ` (${Math.round((subDone / t.subtasks.length) * 100)}%)` : ''}`}
            items={t.subtasks} done={subDone} tone="violet" onToggle={(c) => s.toggleCheck(t.id, 'subtasks', c)} focusFirst={t.status === 'doing'}
            add={sub} setAdd={setSub} onAdd={() => { s.addCheck(t.id, 'subtasks', sub.trim()); setSub('') }} placeholder="Добавить шаг" />

          <div className="card p-5">
            <div className="flex items-center justify-between"><div className="font-mono text-[10px] uppercase tracking-wider text-dim">Заметки и вопросы</div><span className="font-mono text-[11px] text-dim">{t.comments.length}</span></div>
            <ul className="mt-3 space-y-3">
              {t.comments.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-bold ${c.author === 'mentor' ? 'bg-teal/20 text-teal-soft' : 'bg-violet/20 text-violet-soft'}`}>{c.author === 'mentor' ? <Icon name="smart_toy" className="text-[18px]" /> : s.name[0]}</div>
                  <div className="min-w-0">
                    <div className="text-xs text-dim">{c.author === 'mentor' ? 'ИИ-наставник (демо)' : s.name} · <span className="font-mono">{new Date(c.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>{c.parked && <span className="ml-1.5 chip bg-amber/10 text-amber-soft !py-0">мысль из фокуса</span>}</div>
                    <p className="text-sm mt-0.5">{c.text}</p>
                  </div>
                </li>
              ))}
              {t.comments.length === 0 && <li className="text-sm text-dim">Запиши вопрос, который возник, или мысль на потом.</li>}
            </ul>
            <button onClick={() => ai.openMentor(`Помоги разобраться с задачей «${t.title}». С чего начать?`)} className="btn-ghost !px-0 mt-3 text-xs text-violet-soft"><Icon name="smart_toy" className="text-[16px]" />Спросить наставника по задаче</button>
            <form onSubmit={(e) => { e.preventDefault(); if (comment.trim()) { s.addComment(t.id, comment.trim()); setComment('') } }} className="flex gap-2 mt-4">
              <input id="task-comment" className="input !py-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Вопрос или заметка…" />
              <button className="btn-secondary !px-3" aria-label="Отправить"><Icon name="send" className="text-[18px]" /></button>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4 shadow-glow-violet">
            <div className="font-mono text-[10px] uppercase tracking-wider text-violet-soft">Фокус по задаче</div>
            <div className="font-mono text-3xl font-semibold mt-2">{String(Math.floor(t.focusMin / 60)).padStart(2, '0')}:{String(t.focusMin % 60).padStart(2, '0')}<span className="text-sm text-dim"> / план {t.estimate} мин</span></div>
            <div className="h-1.5 rounded-full bg-s2 overflow-hidden mt-2"><div className="h-full bg-gradient-to-r from-violet to-[#8B5CF6]" style={{ width: `${Math.min(100, (t.focusMin / t.estimate) * 100)}%` }} /></div>
            {t.status !== 'done' && <Link to={`/focus?task=${t.id}`} className="btn-primary w-full mt-3"><Icon name="play_arrow" fill className="text-[18px]" />Начать фокус-сессию</Link>}
          </div>

          <div className="card p-4 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-dim">Сроки</div>
            <div className="flex items-center justify-between text-sm"><span className="text-mute">Дедлайн</span>{t.due ? <DuePill due={t.due} done={t.status === 'done'} /> : <span className="text-dim text-xs">не задан</span>}</div>
            {left !== null && t.status !== 'done' && <div className="font-mono text-[11px] text-dim text-right">{left > 0 ? `осталось ${Math.floor(left / 3_600_000)} ч ${Math.floor((left % 3_600_000) / 60_000)} мин` : 'срок прошёл'}</div>}
            <div>
              <label className="text-xs text-dim" htmlFor="slot-date">Блок в календаре</label>
              <div className="flex gap-2 mt-1">
                <input id="slot-date" type="date" className="input !py-1.5 !text-xs" value={t.slot?.date ?? ''} onChange={(e) => s.updateTask(t.id, { slot: e.target.value ? { date: e.target.value, start: t.slot?.start ?? '18:00' } : null })} />
                <input aria-label="Время начала" type="time" className="input !py-1.5 !text-xs !w-28" value={t.slot?.start ?? ''} disabled={!t.slot} onChange={(e) => t.slot && s.updateTask(t.id, { slot: { ...t.slot, start: e.target.value } })} />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-dim mb-3">Материалы</div>
            <div className="space-y-2">
              {node && <Artifact to={`/lesson/${node.id}`} icon="menu_book" title={`Урок: ${node.title}`} sub={s.status(node.id) === 'done' ? 'пройден' : s.status(node.id) === 'locked' ? 'пока закрыт' : `${node.minutes} мин`} />}
              {lab && <Artifact to={`/lab/${lab.id}`} icon="science" title={lab.title} sub={s.labsDone.includes(lab.id) ? 'пройдена' : lab.primitive} />}
              {t.kind === 'review' && <Artifact to={`/review${t.trackId ? `?track=${t.trackId}` : ''}`} icon="style" title="Сессия повторения" sub={`${s.dueCards(t.trackId ?? undefined).length} карточек ждут`} />}
              {cards.length > 0 && <Artifact to={`/review?track=${t.trackId}`} icon="style" title={`Карточки понятия: ${cards.length}`} sub="в колоде трека" />}
              {node && <Artifact to={`/deep?node=${node.id}`} icon="edit_note" title={note ? 'Мой конспект' : 'Написать конспект'} sub={note ? `${note.split(/\s+/).length} слов` : 'Deep Study'} />}
              {track && <Artifact to={`/track/${track.id}`} icon="hub" title="Древо знаний" sub={track.title} />}
            </div>
          </div>

          <div className="card p-4">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="text-xs text-dim hover:text-rose-soft flex items-center gap-1"><Icon name="delete" className="text-[16px]" />Удалить задачу</button>
            ) : (
              <div className="text-sm">Удалить {t.key}?
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { s.deleteTask(t.id); s.notify(`${t.key} удалена`); nav('/plan') }} className="btn !py-1.5 bg-rose text-white text-xs">Удалить</button>
                  <button onClick={() => setConfirmDel(false)} className="btn-ghost !py-1.5 text-xs">Отмена</button>
                </div>
              </div>
            )}
          </div>
          <div className="text-[11px] text-dim font-mono px-1">Статус: {statusOf(t.status).hint}</div>
        </aside>
      </div>
    </div>
  )
}

function Artifact({ to, icon, title, sub }: { to: string; icon: string; title: string; sub: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-line p-2.5 hover:border-violet/40">
      <Icon name={icon} className="text-[20px] text-violet-soft" />
      <span className="flex-1 min-w-0"><span className="text-sm font-medium block truncate">{title}</span><span className="font-mono text-[10px] text-dim">{sub}</span></span>
      <Icon name="chevron_right" className="text-[18px] text-dim" />
    </Link>
  )
}

function ChecklistCard({ title, hint, items, done, tone, onToggle, add, setAdd, onAdd, placeholder, focusFirst }: {
  title: string; hint: string; items: Check[]; done: number; tone: 'amber' | 'violet'; onToggle: (id: string) => void
  add: string; setAdd: (v: string) => void; onAdd: () => void; placeholder: string; focusFirst?: boolean
}) {
  const firstOpen = items.find((c) => !c.done)?.id
  return (
    <div className={`card p-5 ${tone === 'amber' ? 'border-amber/25' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`font-mono text-[10px] uppercase tracking-wider ${tone === 'amber' ? 'text-amber-soft' : 'text-dim'}`}>{title}</div>
        <span className="font-mono text-[11px] text-dim">{done} / {items.length}</span>
      </div>
      <div className="text-xs text-dim mt-1">{hint}</div>
      <ul className="mt-3 space-y-1.5">
        {items.map((c) => (
          <li key={c.id}>
            <button onClick={() => onToggle(c.id)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-s2/60">
              <span className={`w-[18px] h-[18px] rounded-[4px] border grid place-items-center shrink-0 ${c.done ? (tone === 'amber' ? 'bg-amber border-amber' : 'bg-violet border-violet') : 'border-[rgba(148,163,184,0.3)]'}`}>{c.done && <Icon name="check" className="text-[14px] text-white" />}</span>
              <span className={`flex-1 text-sm ${c.done ? 'line-through text-dim' : ''}`}>{c.t}</span>
              {focusFirst && c.id === firstOpen && <span className="font-mono text-[10px] text-violet-soft bg-violet/15 rounded px-1.5 py-0.5">В ФОКУСЕ</span>}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); if (add.trim()) onAdd() }} className="mt-2">
        <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder={`+ ${placeholder}`} aria-label={placeholder}
          className="w-full rounded-lg border border-dashed border-[rgba(148,163,184,0.2)] bg-transparent px-3 py-2 text-xs placeholder:text-dim outline-none focus:border-violet" />
      </form>
    </div>
  )
}
