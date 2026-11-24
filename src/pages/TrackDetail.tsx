import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { TIER_NAMES, trackById } from '../data'
import { useStore } from '../store'
import { Icon } from '../components/ui'
import TrackCover from '../components/TrackCover'
import { CS_PROGRAM } from '../data/cs-program'
import { ProgramCourse } from './Program'

export default function TrackDetail() {
  const { id = '' } = useParams()
  if (CS_PROGRAM.courses.some((c) => c.id === id)) return <ProgramCourse />
  return <TrackDetailInner id={id} />
}

function TrackDetailInner({ id }: { id: string }) {
  const s = useStore()
  const nav = useNavigate()
  const t = trackById(id)
  if (!t) return <Navigate to="/catalog" replace />
  const isIn = s.enrolled.includes(t.id)
  const wished = s.wishlist.includes(t.id)

  // Программа: у собранных треков — уровни графа, у остальных — модули силлабуса
  const modules = t.playable
    ? TIER_NAMES.map((name, tier) => ({ title: name, items: t.nodes.filter((n) => n.tier === tier).map((n) => n.title) })).filter((m) => m.items.length)
    : t.syllabus ?? []

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/catalog" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Каталог</Link>
      <div className="card overflow-hidden">
        <TrackCover track={t} className="h-44 md:h-56" big />
        <div className="p-5 md:p-7 -mt-16 relative">
          <div className="label text-teal-soft">{t.category} · {t.weeks} нед · ~{t.hours} ч</div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">{t.title}</h1>
          <p className="text-mute mt-1">{t.subtitle}</p>
          <p className="text-ink/90 mt-4 max-w-3xl leading-7">{t.description}</p>
          <div className="flex flex-wrap gap-2 mt-4">{t.formats.map((f) => <span key={f} className="chip bg-s2 text-mute">{f}</span>)}</div>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            {isIn ? (
              <Link to={`/track/${t.id}`} className="btn-primary"><Icon name="hub" className="text-[18px]" />Открыть древо · {s.progressOf(t.id)}%</Link>
            ) : t.playable ? (
              <button onClick={() => { s.enroll(t.id); s.notify(`Ты записан на трек «${t.title}»`); nav(`/track/${t.id}`) }} className="btn-primary"><Icon name="play_arrow" fill className="text-[18px]" />Записаться и начать</button>
            ) : (
              <button onClick={() => { s.toggleWish(t.id); s.notify(wished ? 'Напоминание снято' : 'Сообщим, когда трек будет готов') }} className={wished ? 'btn-secondary' : 'btn-primary'}>
                <Icon name={wished ? 'notifications_active' : 'notifications'} className="text-[18px]" />{wished ? 'Ждём вместе — сообщим' : 'Сообщить, когда будет готов'}
              </button>
            )}
            {!t.playable && <span className="text-xs text-dim self-center">Программа уже составлена; уроки и лаборатории ещё собираются.</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] mt-4">
        <div className="card p-5 md:p-6">
          <h2 className="font-bold text-lg">Программа</h2>
          <ol className="mt-4 space-y-4">
            {modules.map((m, i) => (
              <li key={m.title} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-violet/15 text-violet-soft grid place-items-center font-mono text-sm font-bold shrink-0">{i + 1}</div>
                <div className="min-w-0">
                  <div className="font-semibold">{m.title}</div>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">{m.items.map((it) => <li key={it} className="chip bg-s2 text-mute !font-medium">{it}</li>)}</ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold">Чему научишься</h2>
            <ul className="mt-3 space-y-2.5">
              {t.outcomes.map((o) => <li key={o} className="flex gap-2 text-sm"><Icon name="check_circle" fill className="text-teal-soft text-[18px] shrink-0" />{o}</li>)}
            </ul>
          </div>
          {t.labs.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold">Лаборатории</h2>
              <ul className="mt-3 space-y-3">
                {t.labs.map((l) => (
                  <li key={l.id} className="flex gap-3">
                    <Icon name={l.icon} className="text-amber-soft text-[22px]" />
                    <div><div className="text-sm font-semibold">{l.title}</div><div className="text-xs text-dim">{l.primitive} · {l.minutes} мин</div></div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
