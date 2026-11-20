import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CARDS, nodeById } from '../data/networks'
import { formatInterval, useStore, type Rating } from '../store'
import { newCard, review } from '../lib/fsrs'
import { Icon, PageHeader } from '../components/ui'

const RATINGS: { r: Rating; label: string; cls: string; key: string }[] = [
  { r: 1, label: 'Снова', cls: 'border-rose/50 text-rose-soft hover:bg-rose/10', key: '1' },
  { r: 2, label: 'Трудно', cls: 'border-amber/50 text-amber-soft hover:bg-amber/10', key: '2' },
  { r: 3, label: 'Хорошо', cls: 'border-teal/50 text-teal-soft hover:bg-teal/10', key: '3' },
  { r: 4, label: 'Легко', cls: 'border-violet/50 text-violet-soft hover:bg-violet/10', key: '4' },
]

export default function Review() {
  const s = useStore()
  const [queue, setQueue] = useState<string[]>(() => s.dueCards())
  const [idx, setIdx] = useState(0)
  const [flip, setFlip] = useState(false)
  const [stats, setStats] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 })

  const cardId = queue[idx]
  const card = CARDS.find((c) => c.id === cardId)
  const finished = idx >= queue.length

  const rate = (r: Rating) => {
    if (!cardId) return
    s.rate(cardId, r)
    setStats((x) => ({ ...x, [r]: x[r] + 1 }))
    if (r === 1) setQueue((q) => [...q, cardId]) // вернётся в конце сессии
    setIdx((i) => i + 1)
    setFlip(false)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.code === 'Space' && !finished) { e.preventDefault(); setFlip(true) }
      if (flip && ['1', '2', '3', '4'].includes(e.key)) rate(+e.key as Rating)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // прогноз нагрузки на 7 дней
  const forecast = useMemo(() => {
    const days = Array(7).fill(0)
    const now = Date.now()
    Object.values(s.cards).forEach((c) => {
      const d = Math.floor((c.due - now) / 86_400_000)
      if (d >= 0 && d < 7) days[d]++
      else if (d < 0) days[0]++
    })
    return days
  }, [s.cards])
  const maxF = Math.max(1, ...forecast)
  const deckSize = Object.keys(s.cards).length

  return (
    <div>
      <PageHeader eyebrow="Интервальное повторение · FSRS" title="Повторение"
        sub="Оценивай честно: алгоритм подстроит интервалы так, чтобы ты помнил 90% материала, тратя минимум времени." />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {!finished && card ? (
            <div className="card p-6 md:p-10 min-h-[380px] flex flex-col shadow-glow-violet">
              <div className="flex items-center justify-between text-xs text-dim">
                <span className="chip bg-s2 text-mute">{nodeById(card.nodeId)?.title}</span>
                <span className="font-mono">{idx + 1} / {queue.length}</span>
              </div>
              <div className="flex-1 grid place-items-center text-center py-8">
                <div>
                  <div className="text-xl md:text-2xl font-bold leading-snug">{card.front}</div>
                  {flip && <div className="mt-6 pt-6 border-t border-line text-lg text-teal-soft pop">{card.back}</div>}
                </div>
              </div>
              {!flip ? (
                <button onClick={() => setFlip(true)} className="btn-secondary w-full !py-3">Показать ответ <span className="hidden md:inline text-dim text-xs ml-1">[пробел]</span></button>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pop">
                  {RATINGS.map((x) => {
                    const next = review(s.cards[cardId] ?? newCard(Date.now()), x.r, Date.now()).card
                    return (
                      <button key={x.r} onClick={() => rate(x.r)} className={`rounded-lg border py-2.5 transition-colors ${x.cls}`}>
                        <div className="font-semibold text-sm">{x.label}</div>
                        <div className="text-[11px] font-mono opacity-80">{formatInterval(next.due - Date.now())}</div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center min-h-[380px] grid place-items-center">
              <div>
                <div className="w-16 h-16 rounded-full bg-teal/15 grid place-items-center mx-auto"><Icon name="task_alt" className="text-teal-soft text-[36px]" /></div>
                <h2 className="text-xl font-bold mt-4">{queue.length ? 'Сессия завершена!' : 'На сегодня всё повторено'}</h2>
                {queue.length > 0 && (
                  <div className="flex justify-center gap-4 mt-4 text-sm">
                    {RATINGS.map((x) => <div key={x.r}><div className={`text-lg font-bold ${x.cls.split(' ').find((c) => c.startsWith('text-'))}`}>{stats[x.r]}</div><div className="text-dim text-xs">{x.label}</div></div>)}
                  </div>
                )}
                <p className="text-sm text-mute mt-4 max-w-sm mx-auto">Пройди новый урок — его ключевые идеи автоматически станут карточками.</p>
                <div className="flex gap-2 justify-center mt-5">
                  <Link to="/track" className="btn-primary">К древу знаний</Link>
                  {s.dueCards().length > 0 && <button onClick={() => { setQueue(s.dueCards()); setIdx(0) }} className="btn-secondary">Ещё раз</button>}
                </div>
              </div>
            </div>
          )}
          <div className="text-xs text-dim mt-3 hidden md:block">Клавиши: пробел — показать ответ, 1–4 — оценка.</div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3">Колода</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-2xl font-bold">{deckSize}</div><div className="text-xs text-dim">карточек</div></div>
              <div><div className="text-2xl font-bold text-teal-soft">{s.reviewsToday}</div><div className="text-xs text-dim">повторено сегодня</div></div>
            </div>
          </div>
          <div className="card p-4">
            <div className="label mb-3">Нагрузка на неделю</div>
            <div className="flex items-end gap-1.5 h-24">
              {forecast.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-dim font-mono">{v || ''}</span>
                  <div className={`w-full rounded-t ${i === 0 ? 'bg-amber' : 'bg-violet/60'}`} style={{ height: `${(v / maxF) * 64 + 2}px` }} />
                  <span className="text-[10px] text-dim">{i === 0 ? 'сег' : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][(new Date().getDay() + 6 + i) % 7]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4 text-sm text-mute">
            <div className="label mb-2">Как это работает</div>
            Алгоритм FSRS-6. Каждая карточка хранит <b className="text-ink">стабильность</b> (сколько дней ты её помнишь) и <b className="text-ink">сложность</b>. Чем легче вспомнил — тем дальше следующий показ.
          </div>
        </aside>
      </div>
    </div>
  )
}
