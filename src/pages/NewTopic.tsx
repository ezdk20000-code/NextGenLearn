import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon, PageHeader } from '../components/ui'
import { TRACKS, trackById } from '../data'

const LEVELS = [
  { id: 'zero', label: 'С нуля', hint: 'Никогда не сталкивался' },
  { id: 'some', label: 'Есть база', hint: 'Знаю термины, хочу системно' },
  { id: 'pro', label: 'Углубиться', hint: 'Работаю с этим, нужны детали' },
]
const GOALS = ['Понять, как это работает', 'Пройти собеседование', 'Применять в работе', 'Сдать экзамен']
const STEPS = [
  { icon: 'psychology', t: 'Анализирую тему и твой уровень', d: 'Определяю границы, термины и типичные заблуждения' },
  { icon: 'hub', t: 'Строю граф понятий', d: '13 узлов, 5 уровней, зависимости «что сначала»' },
  { icon: 'menu_book', t: 'Пишу уроки', d: 'Объяснения, аналогии, проверки после каждой идеи' },
  { icon: 'science', t: 'Подбираю интерактивную практику', d: '3 лаборатории: рукопожатие TCP, подсети, инкапсуляция' },
  { icon: 'style', t: 'Создаю карточки для повторения', d: 'FSRS-расписание под удержание 90%' },
  { icon: 'event_note', t: 'Раскладываю по календарю', d: '45 минут в день · ~3 недели' },
]

export default function NewTopic() {
  const loc = useLocation() as { state?: { topic?: string } }
  const [topic, setTopic] = useState(loc.state?.topic || 'Сетевые протоколы с нуля')
  const [level, setLevel] = useState('zero')
  const [goal, setGoal] = useState(GOALS[0])
  const [minutes, setMinutes] = useState(45)
  const [phase, setPhase] = useState<'form' | 'gen' | 'done'>('form')
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (phase !== 'gen') return
    if (step >= STEPS.length) { setPhase('done'); return }
    const t = window.setTimeout(() => setStep((x) => x + 1), 650)
    return () => window.clearTimeout(t)
  }, [phase, step])

  // В прототипе генерации нет: подбираем ближайший трек каталога по словам запроса
  const words = topic.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 3).map((w) => w.slice(0, 5))
  const match = TRACKS.map((t) => ({ t, score: words.filter((w) => `${t.title} ${t.subtitle} ${t.tags.join(' ')} ${t.category}`.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score)[0]
  const TRACK = match && match.score > 0 ? match.t : trackById('networks')!
  const isDemo = !!match && match.score > 0

  if (phase === 'form') {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader eyebrow="Индивидуальная программа" title="Чему ты хочешь научиться?"
          sub="Любая тема — от квантовой физики до переговоров. Чем точнее опишешь цель, тем точнее будет программа." />
        <form className="card p-5 md:p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); setStep(0); setPhase('gen') }}>
          <div>
            <label className="label block mb-2">Тема</label>
            <textarea className="input min-h-[88px] text-base" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <div className="label mb-2">Твой уровень</div>
            <div className="grid sm:grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button type="button" key={l.id} onClick={() => setLevel(l.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${level === l.id ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'}`}>
                  <div className="font-semibold text-sm">{l.label}</div>
                  <div className="text-xs text-dim mt-0.5">{l.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Зачем</div>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button type="button" key={g} onClick={() => setGoal(g)}
                  className={`chip !text-xs !px-3 !py-1.5 border ${goal === g ? 'border-teal bg-teal/10 text-teal-soft' : 'border-line text-mute'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between"><span className="label">Время в день</span><span className="font-mono text-sm text-violet-soft">{minutes} мин</span></div>
            <input type="range" min={10} max={120} step={5} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="w-full mt-2 accent-violet" />
          </div>
          <button className="btn-primary w-full !py-3 text-base"><Icon name="auto_awesome" className="text-[20px]" /> Собрать программу</button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow={phase === 'gen' ? 'Генерация программы…' : 'Программа готова'} title={isDemo ? TRACK.title : topic}
        sub={isDemo ? `Ближайшая программа в каталоге: ${TRACK.subtitle.toLowerCase()}` : 'Генерация новых программ появится вместе с ИИ-бэкендом. Пока покажем похожий трек из каталога.'} />
      <div className="card p-5 md:p-6">
        <ol className="space-y-1">
          {STEPS.map((st, i) => {
            const state = i < step ? 'done' : i === step && phase === 'gen' ? 'run' : 'wait'
            return (
              <li key={st.t} className={`flex gap-4 rounded-lg p-3 transition-all ${state === 'run' ? 'bg-violet/10' : ''} ${state === 'wait' ? 'opacity-35' : ''}`}>
                <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${state === 'done' ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-violet-soft'}`}>
                  <Icon name={state === 'done' ? 'check' : st.icon} className={`text-[22px] ${state === 'run' ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{st.t}</div>
                  <div className="text-xs text-dim mt-0.5">{st.d}</div>
                </div>
              </li>
            )
          })}
        </ol>
        {phase === 'done' && (
          <div className="pop mt-6 border-t border-line pt-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{TRACK.playable ? TRACK.nodes.length : TRACK.syllabus?.length}</div><div className="text-xs text-dim">{TRACK.playable ? 'понятий' : 'модулей'}</div></div>
              <div><div className="text-2xl font-bold">{TRACK.weeks} нед</div><div className="text-xs text-dim">программа</div></div>
              <div><div className="text-2xl font-bold">~{TRACK.hours} ч</div><div className="text-xs text-dim">до мастерства</div></div>
            </div>
            <div className="mt-4 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm text-amber-soft flex gap-2"><Icon name="info" className="text-[18px] shrink-0" />Это демонстрация: генерация новой программы появится вместе с ИИ-бэкендом. Ниже — подходящий трек из каталога.</div>
            <Link to={`/catalog/${TRACK.id}`} className="btn-primary w-full mt-4 !py-3"><Icon name="visibility" className="text-[20px]" /> {TRACK.title}</Link>
            <Link to="/catalog" className="btn-ghost w-full mt-2">Весь каталог</Link>
          </div>
        )}
      </div>
    </div>
  )
}
