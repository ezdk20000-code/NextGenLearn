import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PLAYABLE } from '../data'
import { useStore } from '../store'
import { Icon, Ring } from '../components/ui'

const TITLES = [
  { from: 1, t: 'Новичок' }, { from: 3, t: 'Исследователь' }, { from: 6, t: 'Практик' },
  { from: 10, t: 'Эрудит' }, { from: 15, t: 'Магистр синтеза' }, { from: 25, t: 'Архитектор знаний' },
]

export default function Profile() {
  const s = useStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [name, setName] = useState(s.name)
  const title = [...TITLES].reverse().find((t) => s.level >= t.from)!
  const nextTitle = TITLES.find((t) => t.from > s.level)
  const weekAgo = Date.now() - 7 * 86_400_000
  const focusWeek = s.events.filter((e) => e.type === 'focus' && e.at >= weekAgo).reduce((a, e) => a + (e.minutes ?? 0), 0)

  const achievements = [
    { icon: 'school', t: 'Первый шаг', d: 'Пройти первый урок', ok: s.lessonsDone.length >= 1 },
    { icon: 'science', t: 'Экспериментатор', d: 'Пройти первую лабораторию', ok: s.labsDone.length >= 1 },
    { icon: 'biotech', t: 'Лаборант', d: 'Пройти три лаборатории', ok: s.labsDone.length >= 3, progress: `${Math.min(3, s.labsDone.length)}/3` },
    { icon: 'local_fire_department', t: 'Неделя в потоке', d: 'Заниматься 7 дней подряд', ok: s.streak >= 7, progress: `${Math.min(7, s.streak)}/7` },
    { icon: 'style', t: 'Память на страже', d: '50 ответов на карточки', ok: s.reviewLog.length >= 50, progress: `${Math.min(50, s.reviewLog.length)}/50` },
    { icon: 'edit_note', t: 'Автор', d: 'Создать свою карточку', ok: s.userCards.length >= 1 },
    { icon: 'hub', t: 'Полимат', d: 'Учиться в двух треках', ok: s.enrolled.length >= 2 },
    { icon: 'workspace_premium', t: 'Мастер трека', d: 'Освоить все понятия трека', ok: PLAYABLE.some((t) => s.progressOf(t.id) === 100) },
  ]
  const got = achievements.filter((a) => a.ok).length

  const copy = async () => {
    try { await navigator.clipboard.writeText(s.exportJson()); s.notify('Данные скопированы в буфер обмена') }
    catch { s.notify('Не удалось скопировать — браузер запретил доступ к буферу') }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="card p-5 text-center">
          <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-violet-soft to-violet grid place-items-center text-3xl font-extrabold text-[#1000a9]">{s.name[0]}</div>
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && s.setName(name.trim())}
            className="mt-3 text-xl font-bold bg-transparent text-center outline-none border-b border-transparent focus:border-violet w-full" aria-label="Имя" />
          <div className="text-sm text-teal-soft font-semibold mt-1">Уровень {s.level} · {title.t}</div>
          <div className="mt-4 text-left">
            <div className="flex justify-between text-xs text-dim mb-1.5"><span>{s.xp} XP</span><span>до уровня {s.level + 1}: {250 - (s.xp % 250)} XP</span></div>
            <div className="h-2 rounded-full bg-s2 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${s.levelProgress}%` }} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-lg bg-s2/60 p-2.5"><div className="text-lg font-bold text-amber-soft">{s.streak}</div><div className="text-[11px] text-dim">дней подряд</div></div>
            <div className="rounded-lg bg-s2/60 p-2.5"><div className="text-lg font-bold">{(focusWeek / 60).toFixed(1)} ч</div><div className="text-[11px] text-dim">фокус за неделю</div></div>
            <div className="rounded-lg bg-s2/60 p-2.5"><div className="text-lg font-bold text-teal-soft">{s.lessonsDone.length}</div><div className="text-[11px] text-dim">понятий</div></div>
          </div>
        </div>

        <div className="card p-5">
          <div className="label">Путь мастерства</div>
          <div className="flex items-center gap-4 mt-3">
            <Ring value={nextTitle ? ((s.level - title.from) / (nextTitle.from - title.from)) * 100 : 100} size={64} stroke={6}><Icon name="military_tech" className="text-violet-soft" /></Ring>
            <div>
              <div className="font-bold">{title.t}</div>
              <div className="text-xs text-dim">{nextTitle ? `Следующий титул «${nextTitle.t}» — с уровня ${nextTitle.from}` : 'Высший титул'}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4">
            {s.enrolled.map((tid) => { const t = PLAYABLE.find((x) => x.id === tid)!; return <span key={tid} className="chip bg-s2 text-mute"><Icon name={t.cover.icon} className="text-[14px]" />{t.category}</span> })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between"><div className="label">Достижения</div><span className="text-xs text-dim">{got} из {achievements.length}</span></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
            {achievements.map((a) => (
              <div key={a.t} className={`rounded-lg border p-3 ${a.ok ? 'border-amber/40 bg-amber/5' : 'border-line opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <Icon name={a.ok ? a.icon : 'lock'} fill={a.ok} className={`text-[24px] ${a.ok ? 'text-amber-soft' : 'text-dim'}`} />
                  {!a.ok && a.progress && <span className="font-mono text-[11px] text-dim">{a.progress}</span>}
                </div>
                <div className="font-semibold text-sm mt-2">{a.t}</div>
                <div className="text-xs text-dim mt-0.5">{a.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="label">Параметры обучения</div>
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex justify-between"><label htmlFor="daily" className="text-sm font-semibold">Время в день</label><span className="font-mono text-sm text-violet-soft">{s.prefs.dailyMinutes} мин</span></div>
              <input id="daily" type="range" min={10} max={120} step={5} value={s.prefs.dailyMinutes} onChange={(e) => s.setPrefs({ dailyMinutes: +e.target.value })} className="w-full mt-2 accent-violet" />
              <div className="text-xs text-dim">План дня собирается под это время.</div>
            </div>
            <div>
              <div className="text-sm font-semibold">Стиль ИИ-наставника</div>
              <div className="flex rounded-lg bg-[#0A0E16] border border-line p-1 mt-2 max-w-md">
                {([['socratic', 'Сократовский диалог'], ['direct', 'Прямые ответы']] as const).map(([v, t]) => (
                  <button key={v} onClick={() => s.setPrefs({ mentorStyle: v })} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${s.prefs.mentorStyle === v ? 'bg-s2 text-ink' : 'text-dim'}`}>{t}</button>
                ))}
              </div>
              <div className="text-xs text-dim mt-1">{s.prefs.mentorStyle === 'socratic' ? 'Наводящие вопросы вместо готовых ответов.' : 'Короткое объяснение и сразу правильный ответ.'}</div>
            </div>
            <Toggle label="Фоновый звук в Deep Study" hint="Включать выбранный фон при старте фокус-сессии" on={s.prefs.autoAmbient} set={(v) => s.setPrefs({ autoAmbient: v })} />
            <Toggle label="Напоминания о повторении" hint="Когда карточки созрели, а ты ещё не занимался сегодня" on={s.prefs.reminders} set={(v) => s.setPrefs({ reminders: v })} />
            <Link to="/settings/fsrs" className="flex items-center justify-between rounded-lg border border-line p-3 hover:border-s3">
              <span><span className="text-sm font-semibold block">Интервальное повторение</span><span className="text-xs text-dim">Цель удержания {Math.round(s.srs.requestRetention * 100)}% · FSRS-6</span></span>
              <Icon name="chevron_right" className="text-dim" />
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <div className="label">Данные</div>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            <button onClick={copy} className="flex items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-s3">
              <Icon name="content_copy" className="text-violet-soft" />
              <span><span className="text-sm font-semibold block">Скопировать все данные</span><span className="text-xs text-dim">JSON: прогресс, карточки, журнал повторений</span></span>
            </button>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} className="flex items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-rose/50">
                <Icon name="restart_alt" className="text-rose-soft" />
                <span><span className="text-sm font-semibold block">Сбросить демо-прогресс</span><span className="text-xs text-dim">Вернуть прототип к начальному состоянию</span></span>
              </button>
            ) : (
              <div className="rounded-lg border border-rose/50 bg-rose/5 p-3 text-sm pop">
                Сбросить весь прогресс?
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { s.reset(); setConfirmReset(false); s.notify('Прогресс сброшен') }} className="btn !py-1.5 bg-rose text-white text-xs">Сбросить</button>
                  <button onClick={() => setConfirmReset(false)} className="btn-ghost !py-1.5 text-xs">Отмена</button>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-dim mt-3">В прототипе данные хранятся только в этом браузере.</p>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button onClick={() => set(!on)} className="w-full flex items-center gap-3 text-left" role="switch" aria-checked={on}>
      <span className="flex-1"><span className="text-sm font-semibold block">{label}</span><span className="text-xs text-dim">{hint}</span></span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-teal' : 'bg-s3'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} /></span>
    </button>
  )
}
