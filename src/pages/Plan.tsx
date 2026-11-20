import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Icon, PageHeader, Ring } from '../components/ui'
import { usePlan } from './planData'

const AMBIENT = ['Тишина', 'Дождь', 'Кофейня', 'Бинауральные 10 Гц']

export default function Plan() {
  const s = useStore()
  const nav = useNavigate()
  const plan = usePlan()
  const [len, setLen] = useState(25)
  const [left, setLeft] = useState(25 * 60)
  const [run, setRun] = useState(false)
  const [turbo, setTurbo] = useState(false)
  const [amb, setAmb] = useState(AMBIENT[0])
  const [thought, setThought] = useState('')
  const [parked, setParked] = useState<string[]>([])

  useEffect(() => {
    if (!run) return
    const t = window.setInterval(() => setLeft((x) => Math.max(0, x - (turbo ? 60 : 1))), 1000)
    return () => window.clearInterval(t)
  }, [run, turbo])

  useEffect(() => {
    if (left === 0 && run) {
      setRun(false)
      s.addFocus(len)
      s.addXp(20)
      s.notify(`Фокус-сессия ${len} мин завершена · +20 XP`)
      setLeft(len * 60)
    }
  }, [left, run]) // eslint-disable-line

  const today = new Date()
  const week = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - ((today.getDay() + 6) % 7) + i)
    return d
  })
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div>
      <PageHeader eyebrow="Планировщик" title="План и фокус" sub="NGL раскладывает трек по дням под твоё время. Фокус-сессии защищают от отвлечений." />

      <div className="card p-3 md:p-4 mb-4 flex gap-1.5 overflow-x-auto">
        {week.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString()
          const past = d < today && !isToday
          return (
            <div key={i} className={`flex-1 min-w-[56px] rounded-lg text-center py-2.5 ${isToday ? 'bg-violet text-white shadow-glow' : 'text-mute'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
              <div className="text-lg font-bold">{d.getDate()}</div>
              <div className="flex justify-center gap-0.5 h-1.5 mt-0.5">
                {past && <><span className="w-1 h-1 rounded-full bg-teal" /><span className="w-1 h-1 rounded-full bg-teal" /></>}
                {isToday && plan.map((p) => <span key={p.id} className={`w-1 h-1 rounded-full ${s.planDone.includes(p.id) ? 'bg-white' : 'bg-white/40'}`} />)}
                {!past && !isToday && <span className="w-1 h-1 rounded-full bg-s3" />}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div><div className="label">Сегодня</div><div className="font-semibold mt-1">{s.planDone.length} из {plan.length} выполнено</div></div>
            <span className="chip bg-teal/10 text-teal-soft">~{plan.reduce((a, p) => a + p.minutes, 0)} мин</span>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />
            {plan.map((p) => {
              const done = s.planDone.includes(p.id)
              return (
                <div key={p.id} className="relative pb-4 last:pb-0">
                  <button onClick={() => s.togglePlan(p.id)} aria-label="Отметить"
                    className={`absolute -left-6 top-3 w-[15px] h-[15px] rounded-full border-2 ${done ? 'bg-teal border-teal' : 'bg-canvas border-s3'}`} />
                  <div className={`rounded-lg border border-line p-4 ${done ? 'opacity-50' : 'hover:border-violet/40'}`}>
                    <div className="flex items-center gap-2 text-xs text-dim font-mono">{p.time} · {p.minutes} мин</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Icon name={p.icon} className={`text-[22px] ${p.tone}`} />
                      <div className={`flex-1 font-semibold text-sm ${done ? 'line-through' : ''}`}>{p.title}</div>
                      {!done && <button onClick={() => nav(p.to)} className="btn-ghost !px-2.5 !py-1.5 text-xs">Начать <Icon name="arrow_forward" className="text-[16px]" /></button>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5 shadow-glow-teal">
          <div className="flex items-center justify-between">
            <div className="label text-teal-soft">Фокус-сессия</div>
            <div className="flex rounded-lg bg-[#0A0E16] border border-line p-0.5">
              {[25, 50].map((m) => (
                <button key={m} onClick={() => { setLen(m); setLeft(m * 60); setRun(false) }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${len === m ? 'bg-s2 text-ink' : 'text-dim'}`}>{m} мин</button>
              ))}
            </div>
          </div>
          <div className="grid place-items-center my-6">
            <Ring value={100 - (left / (len * 60)) * 100} size={200} stroke={10}>
              <div className="text-center">
                <div className="label text-teal-soft">{run ? 'фокус' : 'готов'}</div>
                <div className="font-mono text-5xl font-semibold tracking-tight mt-1">{mm}:{ss}</div>
                <div className="text-xs text-dim mt-1">потом 5 мин перерыв</div>
              </div>
            </Ring>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setRun(false); setLeft(len * 60) }} className="btn-ghost !p-3 rounded-full" aria-label="Сброс"><Icon name="restart_alt" /></button>
            <button onClick={() => setRun((r) => !r)} className="w-16 h-16 rounded-full bg-violet grid place-items-center shadow-glow" aria-label="Старт/пауза">
              <Icon name={run ? 'pause' : 'play_arrow'} fill className="text-[32px]" />
            </button>
            <button onClick={() => setTurbo((t) => !t)} className={`btn-ghost !p-3 rounded-full ${turbo ? '!text-amber-soft' : ''}`} title="Демо: ускорить ×60" aria-label="Ускорить"><Icon name="fast_forward" /></button>
          </div>
          {turbo && <div className="text-center text-[11px] text-amber-soft mt-2">демо-режим: 1 секунда = 1 минута</div>}

          <div className="mt-6">
            <div className="label mb-2">Фон</div>
            <div className="flex flex-wrap gap-1.5">
              {AMBIENT.map((a) => <button key={a} onClick={() => setAmb(a)} className={`chip border ${amb === a ? 'border-teal bg-teal/10 text-teal-soft' : 'border-line text-mute'}`}>{a}</button>)}
            </div>
          </div>
          <div className="mt-5">
            <div className="label mb-2">Парковка мыслей</div>
            <form onSubmit={(e) => { e.preventDefault(); if (thought.trim()) { setParked((p) => [thought.trim(), ...p]); setThought('') } }} className="flex gap-2">
              <input className="input !py-2" value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Записать и вернуться к учёбе…" />
              <button className="btn-secondary !px-3"><Icon name="arrow_upward" className="text-[18px]" /></button>
            </form>
            {parked.length > 0 && <ul className="mt-2 space-y-1 text-sm text-mute">{parked.map((p, i) => <li key={i} className="flex gap-2 pop"><Icon name="bookmark" className="text-[16px] text-dim mt-0.5" />{p}</li>)}</ul>}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-line text-center">
            <div><div className="text-xl font-bold">{s.focusMinutes} мин</div><div className="text-xs text-dim">фокус сегодня</div></div>
            <div><div className="text-xl font-bold text-amber-soft">{s.streak} дн</div><div className="text-xs text-dim">серия</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
