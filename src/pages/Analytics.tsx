import { useMemo, useState } from 'react'
import { nodeById, trackById } from '../data'
import { dayKey, useStore } from '../store'
import { currentRetrievability, decayFactor, elapsedDays } from '../lib/fsrs'
import { BarChart, SERIES, Tooltip } from '../components/charts'
import { Icon, PageHeader, Stat } from '../components/ui'

const DAY = 86_400_000
const BUCKETS = [
  { id: 'learning', label: 'Изучаются', hint: 'новые и забытые' },
  { id: 'young', label: 'Молодые', hint: 'S до 21 дня' },
  { id: 'mature', label: 'Зрелые', hint: 'S от 21 дня' },
] as const
type Bucket = (typeof BUCKETS)[number]['id']

export default function Analytics() {
  const s = useStore()
  const now = Date.now()
  const track = trackById(s.activeTrack)!

  const cards = useMemo(() => Object.entries(s.cards).map(([id, c]) => {
    const bucket: Bucket = c.status === 'new' || c.status === 'learning' || c.status === 'relearning' ? 'learning' : c.stability >= 21 ? 'mature' : 'young'
    const t = c.lastReview ? elapsedDays(c.lastReview, now) : 0
    return { id, c, bucket, t, r: c.lastReview ? currentRetrievability(c, now) : 1, def: s.cardDef(id) }
  }), [s.cards]) // eslint-disable-line

  const reviewed = cards.filter((x) => x.c.lastReview)
  const graded = s.reviewLog.filter((l) => l.before === 'review')
  const trueRet = graded.length ? graded.filter((l) => l.grade > 1).length / graded.length : null
  const avgS = reviewed.length ? reviewed.reduce((a, x) => a + x.c.stability, 0) / reviewed.length : 0
  const leeches = cards.filter((x) => x.c.lapses >= 4).length

  const forecast = useMemo(() => {
    const days = Array(30).fill(0)
    cards.forEach(({ c }) => { const d = Math.floor((c.due - now) / DAY); if (d < 30) days[Math.max(0, d)]++ })
    return days.map((v, i) => ({ label: i === 0 ? 'сег' : `${i}д`, value: v }))
  }, [cards]) // eslint-disable-line

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Аналитика памяти · FSRS-6" title="Аналитика" sub="Как устроена твоя память прямо сейчас: что держится крепко, что вот-вот забудется и сколько повторений ждёт впереди." />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Карточек в колодах" value={cards.length} hint={`${reviewed.length} уже повторялись`} icon="style" />
        <Stat label="Фактическое удержание" value={trueRet === null ? '—' : `${Math.round(trueRet * 100)}%`} hint={trueRet === null ? 'появится после повторений в срок' : `${graded.length} ответов · цель ${Math.round(s.srs.requestRetention * 100)}%`} icon="verified" tone="teal" />
        <Stat label="Средняя стабильность" value={`${avgS.toFixed(1)} дн`} hint="сколько в среднем держится память" icon="schedule" tone="teal" />
        <Stat label="Карты-пиявки" value={leeches} hint="забыты 4+ раз — стоит переписать" icon="bug_report" tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="label">Кривая забывания</div>
          <div className="font-semibold mt-1">Где сейчас каждая твоя карточка</div>
          <p className="text-xs text-dim mt-1">По горизонтали — сколько прошло времени относительно стабильности карточки, по вертикали — вероятность вспомнить. Точка правее отметки «1·S» — карточка уже просится на повторение.</p>
          <ForgettingCurve points={reviewed.map((x) => ({ id: x.id, tS: x.t / Math.max(0.1, x.c.stability), r: x.r, bucket: x.bucket, label: x.def?.front ?? x.id }))} target={s.srs.requestRetention} />
        </section>

        <section className="card p-5">
          <div className="label">Матрица «сложность × стабильность»</div>
          <div className="font-semibold mt-1">Якоря, рабочие карточки и зона риска</div>
          <p className="text-xs text-dim mt-1">Справа внизу — трудные и нестабильные карточки: их стоит упростить или разбить на две.</p>
          <DsMatrix points={reviewed.map((x) => ({ id: x.id, d: x.c.difficulty, s: x.c.stability, bucket: x.bucket, label: x.def?.front ?? x.id }))} />
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="label">Состав колоды</div>
            <div className="font-semibold mt-1">По зрелости памяти</div>
          </div>
          <Legend />
        </div>
        <Composition counts={BUCKETS.map((b) => cards.filter((x) => x.bucket === b.id).length)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="card p-5">
          <div className="label">Прогноз нагрузки</div>
          <div className="font-semibold mt-1 mb-3">Карточек к повторению по дням, 30 дней</div>
          <BarChart data={forecast} color={SERIES[0]} unit=" карт." highlight={0} width={800} height={220} />
        </section>
        <section className="card p-5">
          <div className="label">Активность</div>
          <div className="font-semibold mt-1 mb-3">Последние 12 недель</div>
          <Heatmap />
        </section>
      </div>

      <section className="card p-5">
        <div className="label">Освоение трека</div>
        <div className="font-semibold mt-1 mb-4">{track.title}</div>
        <div className="space-y-3">
          {track.nodes.map((n) => {
            const m = s.mastery(n.id)
            const v = s.vitality(n.id)
            return (
              <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-mute">{nodeById(n.id)?.title}</span>
                <div className="h-2 rounded-full bg-s2 overflow-hidden" title={`Мастерство ${m}%`}><div className="h-full rounded-full" style={{ width: `${m}%`, background: SERIES[1] }} /></div>
                <span className="font-mono text-xs w-24 text-right text-dim">{m}%{v !== null ? ` · R ${Math.round(v * 100)}%` : ''}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-mute">
      {BUCKETS.map((b, i) => <span key={b.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} />{b.label} <span className="text-dim">· {b.hint}</span></span>)}
    </div>
  )
}

function Composition({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="mt-4">
      <div className="flex h-8 rounded-lg overflow-hidden gap-[2px] bg-canvas">
        {counts.map((c, i) => c > 0 && (
          <div key={i} className="h-full grid place-items-center text-xs font-semibold text-white" style={{ width: `${(c / total) * 100}%`, background: SERIES[i] }} title={`${BUCKETS[i].label}: ${c}`}>
            {c / total > 0.08 ? c : ''}
          </div>
        ))}
      </div>
      <table className="sr-only"><tbody>{BUCKETS.map((b, i) => <tr key={b.id}><td>{b.label}</td><td>{counts[i]}</td></tr>)}</tbody></table>
    </div>
  )
}

function ForgettingCurve({ points, target }: { points: { id: string; tS: number; r: number; bucket: Bucket; label: string }[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 520, H = 260, p = { l: 40, r: 12, t: 12, b: 30 }
  const maxX = 3
  const x = (v: number) => p.l + (Math.min(v, maxX) / maxX) * (W - p.l - p.r)
  const y = (r: number) => p.t + (1 - r) * (H - p.t - p.b) / 0.6 // ось R от 0.4 до 1
  const { decay, factor } = decayFactor()
  const curve = Array.from({ length: 61 }, (_, i) => { const t = (i / 60) * maxX; return `${i ? 'L' : 'M'}${x(t)},${y(Math.pow(1 + factor * t, decay))}` }).join(' ')
  const yTicks = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Кривая забывания с положением карточек">
        {yTicks.map((r) => (
          <g key={r}>
            <line x1={p.l} x2={W - p.r} y1={y(r)} y2={y(r)} stroke="#1E293B" />
            <text x={p.l - 6} y={y(r) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{Math.round(r * 100)}%</text>
          </g>
        ))}
        {[0, 1, 2, 3].map((t) => <text key={t} x={x(t)} y={H - 10} textAnchor="middle" fontSize="10" fill="#94A3B8">{t === 0 ? '0' : `${t}·S`}</text>)}
        <line x1={p.l} x2={W - p.r} y1={y(target)} y2={y(target)} stroke="#D97706" strokeDasharray="4 4" />
        <text x={W - p.r} y={y(target) - 5} textAnchor="end" fontSize="10" fill="#FFB95F">цель {Math.round(target * 100)}%</text>
        <path d={curve} fill="none" stroke="#C0C1FF" strokeWidth={2} />
        {points.map((pt, i) => {
          const bi = BUCKETS.findIndex((b) => b.id === pt.bucket)
          return (
            <g key={pt.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(pt.tS)} cy={y(Math.max(0.4, pt.r))} r={12} fill="transparent" />
              <circle cx={x(pt.tS)} cy={y(Math.max(0.4, pt.r))} r={hover === i ? 6 : 4.5} fill={SERIES[bi]} stroke="#111827" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={`${(x(points[hover].tS) / W) * 100}%`} y={`${(y(Math.max(0.4, points[hover].r)) / H) * 100}%`}>
          <div className="max-w-[220px] whitespace-normal">{points[hover].label}</div>
          <div className="text-mute mt-0.5">вспомнишь с вероятностью <b className="text-ink">{Math.round(points[hover].r * 100)}%</b></div>
        </Tooltip>
      )}
      {points.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-dim">Точки появятся после первых повторений</div>}
    </div>
  )
}

function DsMatrix({ points }: { points: { id: string; d: number; s: number; bucket: Bucket; label: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 520, H = 260, p = { l: 44, r: 12, t: 12, b: 30 }
  const x = (d: number) => p.l + ((d - 1) / 9) * (W - p.l - p.r)
  const lo = Math.log10(0.1), hi = Math.log10(1000)
  const y = (s: number) => p.t + (1 - (Math.log10(Math.max(0.1, s)) - lo) / (hi - lo)) * (H - p.t - p.b)
  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Карточки по сложности и стабильности">
        <rect x={x(5.5)} y={y(10)} width={x(10) - x(5.5)} height={y(0.1) - y(10)} fill="#E11D48" opacity={0.08} />
        {[0.1, 1, 10, 100, 1000].map((v) => (
          <g key={v}>
            <line x1={p.l} x2={W - p.r} y1={y(v)} y2={y(v)} stroke="#1E293B" />
            <text x={p.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{v < 1 ? v : v >= 1000 ? '1000' : v} д</text>
          </g>
        ))}
        {[1, 3, 5, 7, 10].map((d) => <text key={d} x={x(d)} y={H - 10} textAnchor="middle" fontSize="10" fill="#94A3B8">D {d}</text>)}
        <text x={x(9.9)} y={y(0.15)} textAnchor="end" fontSize="10" fill="#FDA4AF">зона риска</text>
        <text x={x(1.1)} y={y(600)} fontSize="10" fill="#94A3B8">якоря</text>
        {points.map((pt, i) => {
          const bi = BUCKETS.findIndex((b) => b.id === pt.bucket)
          return (
            <g key={pt.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(pt.d)} cy={y(pt.s)} r={12} fill="transparent" />
              <circle cx={x(pt.d)} cy={y(pt.s)} r={hover === i ? 6 : 4.5} fill={SERIES[bi]} stroke="#111827" strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={`${(x(points[hover].d) / W) * 100}%`} y={`${(y(points[hover].s) / H) * 100}%`}>
          <div className="max-w-[220px] whitespace-normal">{points[hover].label}</div>
          <div className="text-mute mt-0.5 font-mono">D {points[hover].d.toFixed(1)} · S {points[hover].s.toFixed(1)} дн</div>
        </Tooltip>
      )}
    </div>
  )
}

function Heatmap() {
  const s = useStore()
  const [hover, setHover] = useState<string | null>(null)
  const counts = new Map<string, number>()
  s.reviewLog.forEach((l) => counts.set(dayKey(l.at), (counts.get(dayKey(l.at)) ?? 0) + 1))
  s.events.forEach((e) => counts.set(dayKey(e.at), (counts.get(dayKey(e.at)) ?? 0) + (e.type === 'focus' ? 2 : 3)))
  const today = new Date()
  const start = new Date(today); start.setDate(today.getDate() - 83 - ((today.getDay() + 6) % 7))
  const days = Array.from({ length: 84 + ((today.getDay() + 6) % 7) + 1 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const max = Math.max(1, ...days.map((d) => counts.get(dayKey(d.getTime())) ?? 0))
  // Последовательная шкала одного оттенка (индиго): от фона к насыщенному
  const shade = (v: number) => (v === 0 ? '#1E293B' : ['#312E81', '#3730A3', '#4F46E5', '#818CF8'][Math.min(3, Math.floor((v / max) * 3.999))])
  const weeks: Date[][] = []
  days.forEach((d, i) => { (weeks[Math.floor(i / 7)] ??= []).push(d) })
  const active = days.filter((d) => (counts.get(dayKey(d.getTime())) ?? 0) > 0).length
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((d) => {
              const k = dayKey(d.getTime()); const v = counts.get(k) ?? 0
              return <div key={k} onMouseEnter={() => setHover(`${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}: ${v} действий`)} onMouseLeave={() => setHover(null)}
                className="w-[18px] h-[18px] rounded-[4px]" style={{ background: shade(v) }} />
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-dim">
        <span>{hover ?? `${active} активных дней · серия ${s.streak}`}</span>
        <span className="flex items-center gap-1">меньше {['#1E293B', '#312E81', '#3730A3', '#4F46E5', '#818CF8'].map((c) => <span key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />)} больше</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-mute mt-3"><Icon name="info" className="text-[14px]" />Считаются ответы на карточки, уроки, лаборатории и фокус-сессии.</div>
    </div>
  )
}
