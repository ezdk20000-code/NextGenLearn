import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { lessonById, nodeById, trackById } from '../data'
import { useStore } from '../store'
import { Icon, Md, Ring } from '../components/ui'
import { useMentorTopic } from '../ai/AiContext'
import AiCardsButton from '../components/AiCardsButton'

const AMBIENT = ['Тишина', 'Дождь', 'Белый шум', 'Кофейня', 'Lo-Fi']

export default function DeepStudy() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const track = trackById(s.activeTrack)!
  const open = track.nodes.filter((n) => s.status(n.id) !== 'locked')
  const nodeId = params.get('node') && nodeById(params.get('node')!) ? params.get('node')! : (s.nextNode ?? open[0]?.id)
  const node = nodeById(nodeId)!
  const lesson = lessonById(nodeId)

  const [len, setLen] = useState(50)
  const [left, setLeft] = useState(50 * 60)
  const [run, setRun] = useState(false)
  const [turbo, setTurbo] = useState(false)
  const [amb, setAmb] = useState(s.prefs.autoAmbient ? AMBIENT[1] : AMBIENT[0])
  const [note, setNote] = useState(s.notes[nodeId] ?? '')
  const [flip, setFlip] = useState(false)
  const [cardIdx, setCardIdx] = useState(0)
  const [cf, setCf] = useState('')
  const [cb, setCb] = useState('')

  useEffect(() => { setNote(s.notes[nodeId] ?? ''); setFlip(false); setCardIdx(0) }, [nodeId]) // eslint-disable-line
  useEffect(() => {
    if (!run) return
    const t = window.setInterval(() => setLeft((x) => Math.max(0, x - (turbo ? 60 : 1))), 1000)
    return () => window.clearInterval(t)
  }, [run, turbo])
  useEffect(() => {
    if (left === 0 && run) {
      setRun(false); s.addFocus(len); s.saveNote(nodeId, note)
      s.notify(`Deep Study ${len} мин завершён · +20 XP`); setLeft(len * 60)
    }
  }, [left, run]) // eslint-disable-line

  // Материал: ключевые объяснения урока и словарик
  const material = useMemo(() => {
    if (!lesson) return { texts: [node.short], terms: [] as { term: string; def: string }[] }
    return {
      texts: lesson.blocks.filter((b) => b.type === 'text' || b.type === 'analogy').map((b) => (b.type === 'text' || b.type === 'analogy' ? b.md : '')).slice(0, 3),
      terms: lesson.blocks.flatMap((b) => (b.type === 'terms' ? b.items : [])),
    }
  }, [lesson, node])
  const nodeCards = s.allCards.filter((c) => c.nodeId === nodeId)
  useMentorTopic({ title: node.title, summary: node.short, material: material.texts.join('\n') })
  const recall = nodeCards[cardIdx % Math.max(1, nodeCards.length)]
  const words = note.split(/\s+/).filter(Boolean).length
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="label text-teal-soft flex items-center gap-2">{run && <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />}Deep Study · {track.title}</div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">{node.title}</h1>
        </div>
        <select id="deep-node" aria-label="Понятие" value={nodeId} onChange={(e) => setParams({ node: e.target.value })} className="input !w-auto !py-2">
          {open.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_1fr_360px]">
        {/* Таймер */}
        <div className="card p-5 self-start">
          <div className="flex items-center justify-between">
            <div className="label">Фокус-блок</div>
            <div className="flex rounded-lg bg-[#0A0E16] border border-line p-0.5">
              {[25, 50].map((m) => <button key={m} onClick={() => { setLen(m); setLeft(m * 60); setRun(false) }} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${len === m ? 'bg-s2 text-ink' : 'text-dim'}`}>{m} мин</button>)}
            </div>
          </div>
          <div className="grid place-items-center my-5">
            <Ring value={100 - (left / (len * 60)) * 100} size={180} stroke={9}>
              <div className="text-center"><div className="font-mono text-4xl font-semibold">{mm}:{ss}</div><div className="text-xs text-dim mt-1">{run ? 'глубокое погружение' : 'готов начать'}</div></div>
            </Ring>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setRun(false); setLeft(len * 60) }} className="btn-ghost !p-3 rounded-full" aria-label="Сброс"><Icon name="restart_alt" /></button>
            <button onClick={() => setRun((r) => !r)} className="w-14 h-14 rounded-full bg-violet grid place-items-center shadow-glow" aria-label="Старт/пауза"><Icon name={run ? 'pause' : 'play_arrow'} fill className="text-[28px]" /></button>
            <button onClick={() => setTurbo((t) => !t)} className={`btn-ghost !p-3 rounded-full ${turbo ? '!text-amber-soft' : ''}`} title="Демо: ускорить ×60" aria-label="Ускорить"><Icon name="fast_forward" /></button>
          </div>
          {turbo && <div className="text-center text-[11px] text-amber-soft mt-2">демо-режим: 1 секунда = 1 минута</div>}
          <div className="label mt-5 mb-2">Фон</div>
          <div className="flex flex-wrap gap-1.5">{AMBIENT.map((a) => <button key={a} onClick={() => setAmb(a)} className={`chip border ${amb === a ? 'border-teal bg-teal/10 text-teal-soft' : 'border-line text-mute'}`}>{a}</button>)}</div>
          <p className="text-[11px] text-dim mt-2">Звук фона появится в рабочей версии.</p>
        </div>

        {/* Материал и самопроверка */}
        <div className="space-y-4 min-w-0">
          <div className="card overflow-hidden">
            <div className="relative h-36 md:h-44">
              <img src="covers/deep-study.webp" alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-s1 via-s1/30 to-transparent" />
            </div>
            <div className="p-5 -mt-8 relative">
            <div className="flex items-center justify-between">
              <div className="label">Учебный материал</div>
              <Link to={`/lesson/${nodeId}`} className="text-xs text-violet-soft hover:underline">Открыть урок</Link>
            </div>
            <div className="space-y-3 mt-3">
              {material.texts.map((t, i) => <p key={i} className="text-[15px] leading-7 text-ink/90"><Md text={t} /></p>)}
            </div>
            {material.terms.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-2 mt-4">
                {material.terms.map((t) => <div key={t.term} className="rounded-lg bg-s2/60 p-3"><div className="text-sm font-semibold text-violet-soft">{t.term}</div><div className="text-xs text-mute mt-0.5">{t.def}</div></div>)}
              </div>
            )}
            </div>
          </div>

          <div className="card p-5 border-amber/30">
            <div className="flex items-center justify-between">
              <div className="label text-amber-soft">Блиц-самопроверка</div>
              {nodeCards.length > 1 && <button onClick={() => { setCardIdx((i) => i + 1); setFlip(false) }} className="text-xs text-dim hover:text-ink">Другой вопрос</button>}
            </div>
            {recall ? (
              <>
                <div className="font-semibold mt-3">{recall.front}</div>
                {flip ? <div className="mt-3 rounded-lg bg-teal/10 p-3 text-sm text-teal-soft pop">{recall.back}</div>
                  : <button onClick={() => setFlip(true)} className="btn-secondary mt-3 !py-2">Показать ответ</button>}
              </>
            ) : <p className="text-sm text-mute mt-2">У этого понятия пока нет карточек — создай первую справа.</p>}
          </div>
        </div>

        {/* Конспект */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between"><div className="label">Умный конспект</div><span className="text-[11px] text-dim font-mono">{words} слов</span></div>
            <textarea id="deep-note" className="input mt-3 min-h-[220px] !text-[13px] leading-6 font-mono" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => s.saveNote(nodeId, note)}
              placeholder={'## Главное\n- …\n\n## Своими словами\n…'} />
            <button onClick={() => { s.saveNote(nodeId, note); s.notify('Конспект сохранён в библиотеку') }} className="btn-secondary w-full mt-2 !py-2"><Icon name="save" className="text-[18px]" />Сохранить</button>
            <AiCardsButton nodeId={nodeId} topic={node.title} text={note} />
          </div>
          <form className="card p-5 space-y-2" onSubmit={(e) => { e.preventDefault(); if (!cf.trim() || !cb.trim()) return; s.addUserCard({ front: cf.trim(), back: cb.trim(), trackId: track.id, nodeId }); setCf(''); setCb(''); s.notify('Карточка добавлена в колоду') }}>
            <div className="label text-violet-soft">Мысль → в карточку</div>
            <input id="deep-card-front" className="input !py-2" value={cf} onChange={(e) => setCf(e.target.value)} placeholder="Вопрос" />
            <input id="deep-card-back" className="input !py-2" value={cb} onChange={(e) => setCb(e.target.value)} placeholder="Ответ" />
            <button className="btn-primary w-full !py-2" disabled={!cf.trim() || !cb.trim()}><Icon name="add_card" className="text-[18px]" />Создать карточку</button>
          </form>
        </div>
      </div>
    </div>
  )
}
