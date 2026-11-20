import { useState } from 'react'
import { Link } from 'react-router-dom'
import { nodeById, trackById } from '../data'
import { useStore } from '../store'
import { currentRetrievability } from '../lib/fsrs'
import { thumbStyle } from '../components/TrackCover'
import { Icon, PageHeader, Stat } from '../components/ui'

export default function Cards() {
  const s = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [deck, setDeck] = useState(s.activeTrack)
  const [node, setNode] = useState('')
  const now = Date.now()

  const due = s.dueCards()
  const dueNew = due.filter((id) => s.cards[id]?.status === 'new').length
  const dueHard = due.filter((id) => (s.cards[id]?.difficulty ?? 0) >= 7).length
  const reviewed = Object.values(s.cards).filter((c) => c.lastReview)
  const avgR = reviewed.length ? reviewed.reduce((a, c) => a + currentRetrievability(c, now), 0) / reviewed.length : 0

  const decks = s.enrolled.map((tid) => {
    const t = trackById(tid)!
    const ids = Object.keys(s.cards).filter((id) => s.trackOfCard(id) === tid)
    const rev = ids.map((id) => s.cards[id]).filter((c) => c.lastReview)
    const mature = rev.filter((c) => c.stability >= 21).length
    const avgS = rev.length ? rev.reduce((a, c) => a + c.stability, 0) / rev.length : 0
    return { t, ids, due: s.dueCards(tid).length, mature, avgS, available: t.cards.length }
  })

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    s.addUserCard({ front: front.trim(), back: back.trim(), trackId: deck, nodeId: node || null })
    setFront(''); setBack('')
    s.notify('Карточка добавлена — она появится в повторении сегодня')
  }

  return (
    <div>
      <PageHeader eyebrow="Память" title="Флеш-карты" sub="Колоды собираются из пройденных уроков. Добавляй свои карточки — FSRS запланирует их так же, как остальные."
        right={<div className="flex gap-2"><Link to="/settings/fsrs" className="btn-secondary"><Icon name="tune" className="text-[18px]" />Настройки FSRS</Link><Link to="/review" className="btn-primary"><Icon name="bolt" fill className="text-[18px]" />Учить все ({due.length})</Link></div>} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="К повторению" value={due.length} hint={`${dueNew} новых · ${due.length - dueNew} повторений`} icon="style" tone="amber" />
        <Stat label="Сложные" value={dueHard} hint="сложность D ≥ 7 из 10" icon="warning" tone="amber" />
        <Stat label="Помнишь сейчас" value={`${Math.round(avgR * 100)}%`} hint="средняя вероятность вспомнить" icon="psychology" tone="teal" />
        <Stat label="Цель удержания" value={`${Math.round(s.srs.requestRetention * 100)}%`} hint="меняется в настройках" icon="target" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {decks.map(({ t, ids, due: d, mature, avgS, available }) => (
            <div key={t.id} className="card overflow-hidden">
              <div className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="w-12 h-12 rounded-lg grid place-items-center shrink-0" style={thumbStyle(t)}/>
                <div className="flex-1 min-w-0">
                  <div className="label">{t.category}</div>
                  <div className="font-bold">{t.title}</div>
                  <div className="text-xs text-dim mt-1">
                    В колоде {ids.length} из {available + s.userCards.filter((c) => c.trackId === t.id).length} · выучено надолго {mature} · средняя S {avgS ? `${avgS.toFixed(1)} дн` : '—'}
                  </div>
                  <div className="h-1.5 rounded-full bg-s2 overflow-hidden mt-2"><div className="h-full bg-teal" style={{ width: `${ids.length ? (mature / ids.length) * 100 : 0}%` }} /></div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setOpen(open === t.id ? null : t.id)} className="btn-ghost !py-2 text-xs">{open === t.id ? 'Скрыть' : 'Карточки'}</button>
                  <Link to={`/review?track=${t.id}`} className={`btn !py-2 text-xs ${d ? 'bg-teal text-[#00201c]' : 'bg-s2 text-mute'}`}>Учить ({d})</Link>
                </div>
              </div>
              {open === t.id && (
                <ul className="border-t border-line divide-y divide-line">
                  {ids.length === 0 && <li className="p-4 text-sm text-dim">Колода пуста — пройди первый урок трека.</li>}
                  {ids.map((id) => {
                    const def = s.cardDef(id)!
                    const c = s.cards[id]
                    return (
                      <li key={id} className="p-4 flex gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{def.front}</div>
                          <div className="text-mute mt-0.5">{def.back}</div>
                          <div className="text-[11px] text-dim font-mono mt-1">
                            {c.status === 'new' ? 'новая' : `S ${c.stability.toFixed(1)} дн · D ${c.difficulty.toFixed(1)} · R ${Math.round(currentRetrievability(c, now) * 100)}%`}
                            {def.nodeId && ` · ${nodeById(def.nodeId)?.title}`}
                          </div>
                        </div>
                        {def.own && <button onClick={() => s.deleteUserCard(id)} className="text-dim hover:text-rose-soft" aria-label="Удалить карточку"><Icon name="delete" className="text-[18px]" /></button>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={add} className="card p-5 self-start space-y-3">
          <div className="label text-violet-soft">Своя карточка</div>
          <div>
            <label htmlFor="card-front" className="text-xs text-dim">Вопрос</label>
            <textarea id="card-front" className="input mt-1 min-h-[70px]" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Что делает ARP?" />
          </div>
          <div>
            <label htmlFor="card-back" className="text-xs text-dim">Ответ</label>
            <textarea id="card-back" className="input mt-1 min-h-[70px]" value={back} onChange={(e) => setBack(e.target.value)} placeholder="Находит MAC-адрес по IP-адресу в локальной сети." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="card-deck" className="text-xs text-dim">Колода</label>
              <select id="card-deck" className="input mt-1 !py-2" value={deck} onChange={(e) => { setDeck(e.target.value); setNode('') }}>
                {s.enrolled.map((tid) => <option key={tid} value={tid}>{trackById(tid)!.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="card-node" className="text-xs text-dim">Понятие</label>
              <select id="card-node" className="input mt-1 !py-2" value={node} onChange={(e) => setNode(e.target.value)}>
                <option value="">Без привязки</option>
                {trackById(deck)?.nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary w-full" disabled={!front.trim() || !back.trim()}><Icon name="add" className="text-[18px]" />Добавить в колоду</button>
          <p className="text-xs text-dim">Хорошая карточка — один вопрос, один короткий ответ.</p>
        </form>
      </div>
    </div>
  )
}
