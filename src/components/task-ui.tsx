import { Link } from 'react-router-dom'
import { trackById } from '../data'
import { KINDS, priorityOf, statusOf, type Priority, type Task, type TaskStatus } from '../lib/tasks'
import { Icon } from './ui'

export function PriorityChip({ p }: { p: Priority }) {
  const pr = priorityOf(p)
  return <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${pr.tone}`}>{pr.label}</span>
}

export function StatusChip({ s }: { s: TaskStatus }) {
  const st = statusOf(s)
  return <span className={`inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${st.tone}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
}

export function TrackTag({ trackId }: { trackId: string | null }) {
  const t = trackId ? trackById(trackId) : null
  return <span className="font-mono text-[10px] text-dim">#{t ? t.category.replace(/\s+/g, '') : 'Общее'}</span>
}

/** Срок: «Сегодня, 18:00», «Завтра», «через 3 дн», «просрочено». */
export function dueLabel(due: number | null) {
  if (!due) return null
  const now = new Date()
  const d = new Date(due)
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000)
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const hot = due - Date.now() < 24 * 3_600_000
  const late = due < Date.now()
  const text = late ? 'Просрочено' : days === 0 ? `Сегодня, ${time}` : days === 1 ? `Завтра, ${time}` : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return { text, hot, late }
}

export function DuePill({ due, done }: { due: number | null; done?: boolean }) {
  const d = dueLabel(due)
  if (!d) return null
  const cls = done ? 'text-dim' : d.late ? 'text-rose-soft bg-rose/10' : d.hot ? 'text-amber-soft bg-amber/10' : 'text-mute bg-s3/30'
  return <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] ${cls}`}><Icon name="schedule" className="text-[13px]" />{d.text}</span>
}

export function TaskCard({ t, compact, onDragStart }: { t: Task; compact?: boolean; onDragStart?: (id: string) => void }) {
  const subDone = t.subtasks.filter((c) => c.done).length
  const crit = t.criteria.filter((c) => c.done).length
  const done = t.status === 'done'
  return (
    <Link to={`/plan/task/${t.id}`} draggable={!!onDragStart} onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); onDragStart?.(t.id) }}
      className={`block rounded-lg border bg-s2 p-3.5 transition-all hover:-translate-y-0.5 hover:border-violet/40 ${t.priority === 'crit' && !done ? 'border-[#F43F5E]/40' : 'border-[rgba(148,163,184,0.12)]'} ${done ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-dim tracking-wider">{t.key}</span>
        <Icon name={KINDS[t.kind].icon} className="text-[15px] text-dim" />
        <span className="flex-1" />
        <PriorityChip p={t.priority} />
      </div>
      <div className={`mt-2 text-sm font-semibold leading-snug ${done ? 'line-through' : ''}`}>{t.title}</div>
      {!compact && t.desc && <p className="text-xs text-mute mt-1 line-clamp-2">{t.desc}</p>}
      {t.status === 'doing' && t.subtasks.length > 0 && (
        <div className="mt-2.5 h-1 rounded-full bg-[rgba(148,163,184,0.12)] overflow-hidden"><div className="h-full bg-gradient-to-r from-violet to-[#8B5CF6]" style={{ width: `${(subDone / t.subtasks.length) * 100}%` }} /></div>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <DuePill due={t.due} done={done} />
        {t.subtasks.length > 0 && <span className="inline-flex items-center gap-1 font-mono text-[10px] text-dim"><Icon name="checklist" className="text-[13px]" />{subDone}/{t.subtasks.length}</span>}
        {t.status === 'check' && t.criteria.length > 0 && <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-soft"><Icon name="fact_check" className="text-[13px]" />{crit}/{t.criteria.length}</span>}
        {t.focusMin > 0 && <span className="inline-flex items-center gap-1 font-mono text-[10px] text-teal-soft"><Icon name="timer" className="text-[13px]" />{t.focusMin}м</span>}
        <span className="flex-1" />
        <TrackTag trackId={t.trackId} />
      </div>
    </Link>
  )
}
