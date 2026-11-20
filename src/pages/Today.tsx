import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { dayKey, useStore } from '../store'
import { nodeById, trackById } from '../data'
import { Bar, Icon, Ring, Stat, plural } from '../components/ui'
import { thumbStyle } from '../components/TrackCover'
import { KINDS, PRIORITY_ORDER, dateKey } from '../lib/tasks'
import { PriorityChip } from '../components/task-ui'

export default function Today() {
  const s = useStore()
  const nav = useNavigate()
  const [topic, setTopic] = useState('')
  const due = s.dueCards().length
  const next = s.nextNode ? nodeById(s.nextNode) : undefined
  const todayKey = dateKey(Date.now())
  const plan = s.tasks
    .filter((t) => t.slot?.date === todayKey || (t.due && dateKey(t.due) === todayKey) || t.status === 'doing' || t.status === 'check')
    .sort((a, b) => (a.slot?.start ?? '99') .localeCompare(b.slot?.start ?? '99') || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  const planMin = plan.filter((t) => t.status !== 'done').reduce((a, t) => a + t.estimate, 0)
  const TRACK = trackById(s.activeTrack)!
  const NODES = TRACK.nodes
  const doneCount = NODES.filter((n) => s.status(n.id) === 'done').length
  const others = s.enrolled.filter((t) => t !== s.activeTrack).map((t) => trackById(t)!)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="space-y-6">
      <div>
        <div className="label text-teal-soft mb-2">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">{greet}, {s.name}!</h1>
        <p className="text-mute mt-1">На сегодня: {due > 0 ? `${due} карточек на повтор` : 'повторение выполнено'}{next ? ` и новый урок «${next.title}»` : ''}.</p>
      </div>

      {/* Продолжить */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 card p-5 md:p-6 shadow-glow-violet relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-violet/10 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row gap-5 sm:items-center">
            <Ring value={s.trackProgress} size={96} stroke={8}>
              <div className="text-center">
                <div className="text-xl font-bold">{s.trackProgress}%</div>
                <div className="text-[10px] text-dim">трек</div>
              </div>
            </Ring>
            <div className="flex-1 min-w-0">
              <div className="label text-violet-soft">Продолжить · {TRACK.category}</div>
              <div className="text-xl font-bold mt-1">{TRACK.title}</div>
              <div className="text-sm text-mute mt-1">{doneCount} из {NODES.length} понятий освоено</div>
              {next && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link to={`/lesson/${next.id}`} className="btn-primary">
                    <Icon name="play_arrow" fill className="text-[20px]" /> Урок: {next.title}
                  </Link>
                  <span className="text-xs text-dim flex items-center gap-1"><Icon name="schedule" className="text-[16px]" />{next.minutes} мин · +{next.xp} XP</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5 shadow-glow-amber flex flex-col">
          <div className="flex items-center justify-between">
            <span className="label text-amber-soft">Интервальное повторение</span>
            <Icon name="style" className="text-amber-soft" />
          </div>
          <div className="text-4xl font-extrabold mt-3">{due}</div>
          <div className="text-sm text-mute">карточек ждут сегодня</div>
          <p className="text-xs text-dim mt-2">Алгоритм FSRS напоминает ровно тогда, когда ты начинаешь забывать.</p>
          <Link to="/review" className={`mt-auto pt-4`}>
            <span className={`btn w-full ${due ? 'bg-amber text-[#2a1700] hover:brightness-110' : 'bg-s2 text-mute'}`}>
              <Icon name="bolt" fill className="text-[18px]" /> {due ? 'Повторить за ~' + Math.max(1, Math.round(due * 0.4)) + ' мин' : 'Всё повторено'}
            </span>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Серия" value={`${s.streak} ${plural(s.streak, ['день', 'дня', 'дней'])}`} hint={s.activeDays.has(dayKey(Date.now())) ? 'сегодня засчитано' : 'позанимайся сегодня, чтобы продлить'} icon="local_fire_department" tone="amber" />
        <Stat label="Опыт" value={s.xp} hint={`уровень ${s.level}`} icon="bolt" />
        <Stat label="Фокус сегодня" value={`${s.focusMinutes} мин`} hint={`цель — ${s.prefs.dailyMinutes} мин`} icon="timer" tone="teal" />
        <Stat label="Лаборатории" value={`${TRACK.labs.filter((l) => s.labsDone.includes(l.id)).length} / ${TRACK.labs.length}`} hint="практика по треку" icon="science" tone="teal" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* План на день */}
        <div className="lg:col-span-3 card p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label">PlanFlow · сегодня</div>
              <div className="font-semibold mt-1">{plan.filter((t) => t.status !== 'done').length} задач · ~{planMin} мин из {s.prefs.dailyMinutes}</div>
            </div>
            <Link to="/plan" className="btn-ghost !px-2 !py-1.5 text-xs">Доска <Icon name="arrow_forward" className="text-[16px]" /></Link>
          </div>
          <div className="space-y-2">
            {plan.map((t) => {
              const done = t.status === 'done'
              return (
                <div key={t.id} className={`flex items-center gap-3 rounded-lg border border-line p-3 ${done ? 'opacity-50' : 'hover:border-violet/40'}`}>
                  <button onClick={() => { s.moveTask(t.id, done ? 'doing' : 'done'); if (!done && t.criteria.some((c) => !c.done)) s.notify('Задача на самопроверке — отметь критерии усвоения') }} aria-label="Отметить"
                    className={`w-5 h-5 rounded-md border grid place-items-center shrink-0 ${done ? 'bg-teal border-teal' : t.status === 'check' ? 'border-amber' : 'border-s3'}`}>
                    {done && <Icon name="check" className="text-[16px] text-white" />}
                  </button>
                  <span className="font-mono text-xs text-dim w-11">{t.slot?.start ?? '—'}</span>
                  <Icon name={KINDS[t.kind].icon} className="text-[20px] text-violet-soft" />
                  <button onClick={() => nav(`/plan/task/${t.id}`)} className={`flex-1 text-left text-sm font-medium min-w-0 truncate ${done ? 'line-through' : ''}`}>{t.title}</button>
                  <span className="hidden sm:block"><PriorityChip p={t.priority} /></span>
                  <span className="text-xs text-dim hidden md:block font-mono">{t.estimate}м</span>
                </div>
              )
            })}
            {plan.length === 0 && <div className="text-sm text-dim">На сегодня задач нет. <Link to="/plan" className="text-violet-soft">Запланировать</Link></div>}
          </div>
        </div>

        {/* Новая тема */}
        <div className="lg:col-span-2 card p-5 flex flex-col">
          <div className="label text-teal-soft">Мои треки</div>
          <div className="space-y-2 mt-3">
            {[TRACK, ...others].map((t) => (
              <Link key={t.id} to={`/track/${t.id}`} onClick={() => s.setActiveTrack(t.id)} className={`flex items-center gap-3 rounded-lg border p-3 ${t.id === s.activeTrack ? 'border-violet/50 bg-violet/5' : 'border-line hover:border-s3'}`}>
                <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={thumbStyle(t)}/>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{t.title}</div><div className="mt-1.5"><Bar value={s.progressOf(t.id)} color="teal" /></div></div>
                <span className="font-mono text-xs text-dim">{s.progressOf(t.id)}%</span>
              </Link>
            ))}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); nav('/catalog') }}>
            <input className="input !py-2.5" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Чему ещё научиться?" onFocus={() => nav('/catalog')} />
          </form>
          <Link to="/catalog" className="btn-teal w-full mt-2"><Icon name="explore" className="text-[18px]" /> Каталог треков</Link>
        </div>
      </div>

      {/* Ближайшие понятия */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label">Твой путь по треку</div>
          <Link to={`/track/${TRACK.id}`} className="btn-ghost !px-2 !py-1.5 text-xs">Открыть древо <Icon name="arrow_forward" className="text-[16px]" /></Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {NODES.map((n) => {
            const st = s.status(n.id)
            return (
              <Link key={n.id} to={st === 'locked' ? `/track/${TRACK.id}` : `/lesson/${n.id}`}
                className={`shrink-0 w-44 rounded-lg border p-3 transition-colors ${st === 'done' ? 'border-teal/30 bg-teal/5' : st === 'available' ? 'border-violet/50 bg-violet/5 hover:shadow-glow' : 'border-line opacity-50'}`}>
                <div className="flex items-center justify-between">
                  <Icon name={st === 'done' ? 'check_circle' : st === 'available' ? 'radio_button_checked' : 'lock'} fill={st === 'done'}
                    className={`text-[18px] ${st === 'done' ? 'text-teal-soft' : st === 'available' ? 'text-violet-soft' : 'text-dim'}`} />
                  <span className="text-[10px] text-dim font-mono">{n.minutes}м</span>
                </div>
                <div className="text-sm font-semibold mt-2 leading-snug">{n.title}</div>
                <div className="mt-2"><Bar value={s.mastery(n.id)} color="teal" /></div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
