import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CATEGORIES, TRACKS, labById, nodeById, trackById, type Format, type Level, type Track } from '../data'
import { useStore } from '../store'
import { Icon, Ring } from '../components/ui'
import TrackCover from '../components/TrackCover'
import { CsProgramSection } from './Program'
import { CS_PROGRAM } from '../data/cs-program'

const LEVELS: Level[] = ['Фундамент', 'Продвинутый', 'Мастерство']
const FORMATS: Format[] = ['Симуляции', 'ИИ-спарринг', 'Кейсы', 'Флеш-спринты']
const DURATIONS = [
  { id: 'short', label: 'Интенсив (до 4 нед)', test: (w: number) => w <= 4 },
  { id: 'mid', label: '6–8 недель', test: (w: number) => w > 4 && w <= 8 },
  { id: 'long', label: 'Глубокое погружение', test: (w: number) => w > 8 },
]

export default function Catalog() {
  const s = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('Все')
  const [level, setLevel] = useState<Level | null>(null)
  const [format, setFormat] = useState<Format | null>(null)
  const [dur, setDur] = useState<string | null>(null)

  const list = useMemo(() => TRACKS.filter((t) => {
    const text = `${t.title} ${t.subtitle} ${t.description} ${t.tags.join(' ')} ${t.category}`.toLowerCase()
    return (!q || text.includes(q.toLowerCase()))
      && (cat === 'Все' || t.category === cat)
      && (!level || t.level === level)
      && (!format || t.formats.includes(format))
      && (!dur || DURATIONS.find((d) => d.id === dur)!.test(t.weeks))
  }), [q, cat, level, format, dur])

  const enrolled = s.enrolled.map((id) => trackById(id)!).filter(Boolean)
  const totalDone = s.lessonsDone.length
  const avg = enrolled.length ? Math.round(enrolled.reduce((a, t) => a + s.progressOf(t.id), 0) / enrolled.length) : 0
  const filtersOn = q || cat !== 'Все' || level || format || dur

  return (
    <div className="space-y-8">
      {/* Шапка */}
      <section className="card p-5 md:p-7 relative overflow-hidden">
        <div className="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-violet/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row gap-6 lg:items-start">
          <div className="flex-1 min-w-0">
            <div className="label text-teal-soft">Каталог · {TRACKS.length + CS_PROGRAM.courses.length} программ</div>
            <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">Треки и программы мастерства</h1>
            <p className="text-mute mt-2 max-w-2xl">Выбери направление: у каждого трека есть граф понятий, уроки с проверками, лаборатории и карточки для повторения.</p>
          </div>
          <div className="flex items-center gap-4 rounded-lg border border-line bg-[#0A0E16] px-4 py-3 shrink-0">
            <Ring value={avg} size={56} stroke={5}><span className="text-sm font-bold">{avg}%</span></Ring>
            <div>
              <div className="label">Твой путь</div>
              <div className="font-semibold text-sm mt-0.5">{enrolled.length} {enrolled.length === 1 ? 'активный трек' : 'активных трека'}</div>
              <div className="text-xs text-dim">{totalDone} понятий освоено</div>
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-2 rounded-lg bg-[#0F172A] border border-line px-3 focus-within:border-violet">
          <Icon name="search" className="text-dim text-[20px]" />
          <input id="catalog-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по темам, навыкам, тегам…" className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-dim" />
          {filtersOn && <button onClick={() => { setQ(''); setCat('Все'); setLevel(null); setFormat(null); setDur(null) }} className="text-xs text-dim hover:text-ink font-mono">сбросить</button>}
        </div>
        <div className="relative flex gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
          {['Все', 'Computer Science', ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip !text-xs !px-3 !py-1.5 shrink-0 border ${cat === c ? 'bg-violet text-white border-violet' : 'border-line text-mute hover:text-ink'}`}>{c}</button>
          ))}
        </div>
      </section>

      {/* Продолжить */}
      {enrolled.length > 0 && !filtersOn && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="play_circle" className="text-teal-soft" />Продолжить текущие треки <span className="chip bg-s2 text-mute">{enrolled.length}</span></h2>
            <Link to="/history" className="btn-ghost !px-2 !py-1.5 text-xs">История <Icon name="arrow_forward" className="text-[16px]" /></Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {enrolled.map((t) => <ContinueCard key={t.id} track={t} />)}
          </div>
        </section>
      )}

      {(cat === 'Все' || cat === 'Computer Science') && !level && !format && !dur && <CsProgramSection q={q} />}

      {/* Фильтры и сетка */}
      {cat !== 'Computer Science' && <section>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="auto_awesome" className="text-violet-soft" />{filtersOn ? 'Результаты' : 'Все программы'}</h2>
          <span className="text-xs text-dim">Найдено: {list.length}</span>
        </div>
        <div className="card p-4 mb-4 grid gap-4 md:grid-cols-3">
          <FilterGroup label="Сложность" options={LEVELS} value={level} onChange={setLevel} />
          <FilterGroup label="Формат практики" options={FORMATS} value={format} onChange={setFormat} />
          <FilterGroup label="Длительность" options={DURATIONS.map((d) => d.label)} value={dur ? DURATIONS.find((d) => d.id === dur)!.label : null}
            onChange={(v) => setDur(v ? DURATIONS.find((d) => d.label === v)!.id : null)} />
        </div>
        {list.length === 0 ? (
          <div className="card p-8 text-center text-mute">
            Ничего не нашлось. Попробуй другой запрос или <button onClick={() => nav('/new', { state: { topic: q } })} className="text-violet-soft hover:underline">собери свою программу</button>.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => <TrackCard key={t.id} track={t} />)}
          </div>
        )}
      </section>}

      <section className="card p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="w-12 h-12 rounded-lg bg-violet/15 grid place-items-center shrink-0"><Icon name="construction" className="text-violet-soft text-[26px]" /></div>
        <div className="flex-1">
          <div className="font-bold">Нет нужной темы?</div>
          <p className="text-sm text-mute mt-0.5">Опиши, чему хочешь научиться, — NGL соберёт индивидуальную программу: граф понятий, уроки, практику и карточки.</p>
        </div>
        <Link to="/new" className="btn-primary shrink-0"><Icon name="auto_awesome" className="text-[18px]" />Собрать свою программу</Link>
      </section>
    </div>
  )
}

function FilterGroup<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div>
      <div className="label mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(value === o ? null : o)}
            className={`chip !text-xs !px-2.5 !py-1 border ${value === o ? 'border-teal bg-teal/10 text-teal-soft' : 'border-line text-mute hover:text-ink'}`}>{o}</button>
        ))}
      </div>
    </div>
  )
}

function ContinueCard({ track }: { track: Track }) {
  const s = useStore()
  const pct = s.progressOf(track.id)
  const next = s.nextNodeOf(track.id)
  const nextNode = next ? nodeById(next) : undefined
  const lab = track.labs.find((l) => !s.labsDone.includes(l.id) && s.status(l.nodeId) !== 'locked')
  const xpDone = track.nodes.filter((n) => s.lessonsDone.includes(n.id)).reduce((a, n) => a + n.xp, 0)
  const xpTotal = track.nodes.reduce((a, n) => a + n.xp, 0)
  return (
    <div className={`card p-5 flex flex-col ${s.activeTrack === track.id ? 'border-violet/40 shadow-glow-violet' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px]"><span className="chip bg-s2 text-mute">{track.category}</span>{s.activeTrack === track.id && <span className="text-violet-soft font-semibold">активный</span>}</div>
          <div className="font-bold text-lg leading-snug mt-2">{track.title}</div>
        </div>
        <div className="text-right"><div className="text-2xl font-bold text-teal-soft">{pct}%</div><div className="text-[11px] text-dim">завершено</div></div>
      </div>
      <div className="h-1.5 rounded-full bg-s2 overflow-hidden mt-3"><div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${pct}%` }} /></div>
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div><div className="label">Следующий урок</div><div className="mt-1 truncate">{nextNode?.title ?? 'Трек пройден'}</div></div>
        <div><div className="label text-amber-soft">Практика</div><div className="mt-1 truncate">{lab ? labById(lab.id)?.title : 'Все лаборатории пройдены'}</div></div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-5">
        <span className="text-xs text-dim font-mono"><Icon name="bolt" className="text-[14px] text-violet-soft align-middle" /> {xpDone} / {xpTotal} XP</span>
        <div className="flex gap-2">
          <Link to={`/track/${track.id}`} className="btn-ghost !py-2 text-xs">Древо</Link>
          {nextNode && <Link to={`/lesson/${nextNode.id}`} onClick={() => s.setActiveTrack(track.id)} className="btn-primary !py-2 text-xs">Продолжить <Icon name="play_arrow" fill className="text-[16px]" /></Link>}
        </div>
      </div>
    </div>
  )
}

function TrackCard({ track }: { track: Track }) {
  const s = useStore()
  const nav = useNavigate()
  const isIn = s.enrolled.includes(track.id)
  const facts = [
    { icon: 'calendar_month', t: `${track.weeks} нед · ~${track.hours} ч` },
    { icon: 'hub', t: track.playable ? `${track.nodes.length} понятий` : `${track.syllabus?.length ?? 0} модуля` },
    { icon: 'science', t: track.playable ? `${track.labs.length} ${track.labs.length === 1 ? 'лаборатория' : 'лаборатории'}` : track.formats[0] },
    { icon: 'style', t: track.playable ? `${track.cards.length} карточек` : track.formats.slice(1).join(', ') || 'Флеш-спринты' },
  ]
  return (
    <article className="card overflow-hidden flex flex-col card-hover">
      <Link to={`/catalog/${track.id}`}><TrackCover track={track} /></Link>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-1.5">{track.tags.map((x) => <span key={x} className="text-[10px] font-bold uppercase tracking-wider text-dim">{x}</span>)}</div>
        <Link to={`/catalog/${track.id}`} className="text-lg font-bold leading-snug mt-2 hover:text-violet-soft">{track.title}</Link>
        <p className="text-sm text-mute mt-1.5 line-clamp-3">{track.description}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4 text-xs text-mute">
          {facts.map((f) => <div key={f.icon} className="flex items-center gap-1.5 min-w-0"><Icon name={f.icon} className="text-[16px] text-dim shrink-0" /><span className="truncate">{f.t}</span></div>)}
        </div>
        <div className="mt-auto pt-5">
          {isIn ? (
            <Link to={`/track/${track.id}`} className="btn-secondary w-full"><Icon name="check_circle" fill className="text-teal-soft text-[18px]" />Ты учишься · {s.progressOf(track.id)}%</Link>
          ) : track.playable ? (
            <button onClick={() => { s.enroll(track.id); s.notify(`Ты записан на трек «${track.title}»`); nav(`/track/${track.id}`) }} className="btn-primary w-full">Записаться на трек <Icon name="arrow_forward" className="text-[18px]" /></button>
          ) : (
            <Link to={`/catalog/${track.id}`} className="btn-secondary w-full">Смотреть программу <Icon name="visibility" className="text-[18px]" /></Link>
          )}
        </div>
      </div>
    </article>
  )
}
