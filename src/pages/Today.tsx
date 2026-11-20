import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../store'
import { NODES, TRACK, nodeById } from '../data/networks'
import { Bar, Icon, Ring, Stat } from '../components/ui'
import { usePlan } from './planData'

export default function Today() {
  const s = useStore()
  const nav = useNavigate()
  const [topic, setTopic] = useState('')
  const due = s.dueCards().length
  const next = s.nextNode ? nodeById(s.nextNode) : undefined
  const plan = usePlan()
  const doneCount = NODES.filter((n) => s.status(n.id) === 'done').length
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
              <div className="label text-violet-soft">Продолжить · {TRACK.domain}</div>
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
        <Stat label="Серия" value={`${s.streak} дня`} hint="не прерывай цепочку" icon="local_fire_department" tone="amber" />
        <Stat label="Опыт" value={s.xp} hint={`уровень ${1 + Math.floor(s.xp / 250)}`} icon="bolt" />
        <Stat label="Фокус сегодня" value={`${s.focusMinutes} мин`} hint="цель — 60 мин" icon="timer" tone="teal" />
        <Stat label="Лаборатории" value={`${s.labsDone.length} / 3`} hint="практика по треку" icon="science" tone="teal" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* План на день */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label">План на сегодня</div>
              <div className="font-semibold mt-1">Собран автоматически под твои 45 минут в день</div>
            </div>
            <Link to="/plan" className="btn-ghost !px-2 !py-1.5 text-xs">Весь план <Icon name="arrow_forward" className="text-[16px]" /></Link>
          </div>
          <div className="space-y-2">
            {plan.map((p) => {
              const done = s.planDone.includes(p.id)
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-lg border border-line p-3 ${done ? 'opacity-50' : 'hover:border-violet/40'}`}>
                  <button onClick={() => s.togglePlan(p.id)} aria-label="Отметить"
                    className={`w-5 h-5 rounded-md border grid place-items-center shrink-0 ${done ? 'bg-teal border-teal' : 'border-s3'}`}>
                    {done && <Icon name="check" className="text-[16px] text-white" />}
                  </button>
                  <span className="font-mono text-xs text-dim w-11">{p.time}</span>
                  <Icon name={p.icon} className={`text-[20px] ${p.tone}`} />
                  <button onClick={() => nav(p.to)} className={`flex-1 text-left text-sm font-medium min-w-0 truncate ${done ? 'line-through' : ''}`}>{p.title}</button>
                  <span className="text-xs text-dim hidden sm:block">{p.minutes} мин</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Новая тема */}
        <div className="lg:col-span-2 card p-5 flex flex-col">
          <div className="label text-teal-soft">Изучить что угодно</div>
          <div className="text-lg font-bold mt-1">Чему хочешь научиться дальше?</div>
          <p className="text-sm text-mute mt-1">Опиши тему своими словами — NGL построит граф понятий, уроки, практику и карточки.</p>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); nav('/new', { state: { topic } }) }}>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Например: «как работает блокчейн»" />
            <button className="btn-teal w-full"><Icon name="auto_awesome" className="text-[18px]" /> Собрать программу</button>
          </form>
          <div className="flex flex-wrap gap-2 mt-4">
            {['Квантовая физика', 'Испанский B2', 'Переговоры', 'SQL'].map((t) => (
              <button key={t} onClick={() => nav('/new', { state: { topic: t } })} className="chip bg-s2 text-mute hover:text-ink">{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Ближайшие понятия */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="label">Твой путь по треку</div>
          <Link to="/track" className="btn-ghost !px-2 !py-1.5 text-xs">Открыть древо <Icon name="arrow_forward" className="text-[16px]" /></Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {NODES.map((n) => {
            const st = s.status(n.id)
            return (
              <Link key={n.id} to={st === 'locked' ? '/track' : `/lesson/${n.id}`}
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
