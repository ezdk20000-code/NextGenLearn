import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { nodeById, trackById } from '../data'
import { formatInterval, useStore, type Rating } from '../store'
import { newCard, review } from '../lib/fsrs'
import { Icon, PageHeader } from '../components/ui'

const RATINGS: { r: Rating; label: string; cls: string; text: string }[] = [
  { r: 1, label: 'Снова', cls: 'border-rose/50 hover:bg-rose/10', text: 'text-rose-soft' },
  { r: 2, label: 'Трудно', cls: 'border-amber/50 hover:bg-amber/10', text: 'text-amber-soft' },
  { r: 3, label: 'Хорошо', cls: 'border-teal/50 hover:bg-teal/10', text: 'text-teal-soft' },
  { r: 4, label: 'Легко', cls: 'border-violet/50 hover:bg-violet/10', text: 'text-violet-soft' },
]

export default function Review() {
  const s = useStore()
  const [params] = useSearchParams()
  const deck = params.get('track') ?? undefined
  const [queue, setQueue] = useState<string[]>(() => s.dueCards(deck))
  const [idx, setIdx] = useState(0)
  const [flip, setFlip] = useState(false)
  const [stats, setStats] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [shownAt, setShownAt] = useState(Date.now())

  useEffect(() => { setQueue(s.dueCards(deck)); setIdx(0); setFlip(false) }, [deck]) // eslint-disable-line

  const cardId = queue[idx]
  const card = cardId ? s.cardDef(cardId) : undefined
  const finished = idx >= queue.length

  const rate = (r: Rating) => {
    if (!cardId) return
    s.rate(cardId, r)
    setStats((x) => ({ ...x, [r]: x[r] + 1 }))
    if (r === 1) setQueue((q) => [...q, cardId]) // вернётся в конце сессии
    setIdx((i) => i + 1)
    setFlip(false)
    setShownAt(Date.now())
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.code === 'Space' && !finished) { e.preventDefault(); setFlip(true) }
      if (flip && ['1', '2', '3', '4'].includes(e.key)) rate(+e.key as Rating)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const forecast = useMemo(() => {
    const days = Array(7).fill(0)
    const now = Date.now()
    Object.entries(s.cards).forEach(([id, c]) => {
      if (deck && s.trackOfCard(id) !== deck) return
      const d = Math.floor((c.due - now) / 86_400_000)
      if (d < 7) days[Math.max(0, d)]++
    })
    return days
  }, [s.cards, deck]) // eslint-disable-line
  const maxF = Math.max(1, ...forecast)
  const deckCards = Object.keys(s.cards).filter((id) => !deck || s.trackOfCard(id) === deck)
  const deckTitle = deck ? trackById(deck)?.title : 'Все колоды'
  const st = cardId ? s.cards[cardId] : undefined

  return (
    <div>
      <PageHeader eyebrow={`Интервальное повторение · FSRS-6 · ${deckTitle}`} title="Повторение"
        sub="Оценивай честно: алгоритм подстроит интервалы так, чтобы ты помнил нужную долю материала, тратя минимум времени."
        right={<Link to="/cards" className="btn-secondary"><Icon name="stacks" className="text-[18px]" />Колоды</Link>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {!finished && card ? (
            <div className="card p-6 md:p-10 min-h-[380px] flex flex-col shadow-glow-violet">
              <div className="flex items-center justify-between gap-2 text-xs text-dim">
                <span className="chip bg-s2 text-mute truncate">{card.nodeId ? nodeById(card.nodeId)?.title : trackById(card.trackId)?.title}{card.own ? ' · моя' : ''}</span>
                <span className="font-mono shrink-0">{idx + 1} / {queue.length}</span>
              </div>
              <div className="flex-1 grid place-items-center text-center py-8">
                <div>
                  <div className="text-xl md:text-2xl font-bold leading-snug">{card.front}</div>
                  {flip && <div className="mt-6 pt-6 border-t border-line text-lg text-teal-soft pop">{card.back}</div>}
                </div>
              </div>
              {st && st.status !== 'new' && <div className="text-[11px] text-dim font-mono text-center mb-3">S = {st.stability.toFixed(1)} дн · D = {st.difficulty.toFixed(1)} · повторений {st.reps}</div>}
              {!flip ? (
                <button onClick={() => setFlip(true)} className="btn-secondary w-full !py-3">Показать ответ <span className="hidden md:inline text-dim text-xs ml-1">[пробел]</span></button>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pop">
                  {RATINGS.map((x) => {
                    const next = review(s.cards[cardId] ?? newCard(shownAt), x.r, Date.now(), s.fsrsParams).card
                    return (
                      <button key={x.r} onClick={() => rate(x.r)} className={`rounded-lg border py-2.5 transition-colors ${x.cls}`}>
                        <div className={`font-semibold text-sm ${x.text}`}>{x.label}</div>
                        <div className="text-[11px] font-mono text-mute">{formatInterval(next.due - Date.now())}</div>
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
                  <div className="flex justify-center gap-5 mt-4 text-sm">
                    {RATINGS.map((x) => <div key={x.r}><div className={`text-lg font-bold ${x.text}`}>{stats[x.r]}</div><div className="text-dim text-xs">{x.label}</div></div>)}
                  </div>
                )}
                <p className="text-sm text-mute mt-4 max-w-sm mx-auto">Пройди новый урок — его ключевые идеи станут карточками. Или добавь свою карточку в колоду.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-5">
                  <Link to="/cards" className="btn-primary">Колоды и свои карточки</Link>
                  {s.dueCards(deck).length > 0 && <button onClick={() => { setQueue(s.dueCards(deck)); setIdx(0) }} className="btn-secondary">Ещё раз</button>}
                </div>
              </div>
            </div>
          )}
          <div className="text-xs text-dim mt-3 hidden md:block">Клавиши: пробел — показать ответ, 1–4 — оценка.</div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3">Колода · {deckTitle}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-2xl font-bold">{deckCards.length}</div><div className="text-xs text-dim">карточек</div></div>
              <div><div className="text-2xl font-bold text-teal-soft">{s.reviewsToday}</div><div className="text-xs text-dim">ответов сегодня</div></div>
            </div>
          </div>
          <div className="card p-4">
            <div className="label mb-3">Нагрузка на неделю</div>
            <div className="flex items-end gap-1.5 h-24" role="img" aria-label={`Карточек по дням: ${forecast.join(', ')}`}>
              {forecast.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${v} карточек`}>
                  <span className="text-[10px] text-mute font-mono">{v || ''}</span>
                  <div className={`w-full rounded-t ${i === 0 ? 'bg-amber' : 'bg-violet'}`} style={{ height: `${(v / maxF) * 60 + 2}px` }} />
                  <span className="text-[10px] text-dim">{i === 0 ? 'сег' : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][(new Date().getDay() + 6 + i) % 7]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4 text-sm text-mute">
            <div className="flex items-center justify-between mb-2"><div className="label">Как это работает</div><Link to="/settings/fsrs" className="text-xs text-violet-soft hover:underline">Настройки</Link></div>
            Каждая карточка хранит <b className="text-ink">стабильность</b> (сколько дней ты её помнишь) и <b className="text-ink">сложность</b>. Сейчас цель — помнить {Math.round(s.srs.requestRetention * 100)}% материала.
          </div>
        </aside>
      </div>
    </div>
  )
}
