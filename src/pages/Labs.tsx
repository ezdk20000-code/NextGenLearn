import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { nodeById, trackById } from '../data'
import { Icon, PageHeader } from '../components/ui'

const TONE: Record<string, string> = { encap: 'from-[#FDA4AF]/20', tcp: 'from-violet/25', subnet: 'from-teal/20', negotiation: 'from-amber/25' }

export default function Labs() {
  const s = useStore()
  return (
    <div>
      <PageHeader eyebrow="Практика" title="Лаборатории" sub="Знание закрепляется, когда ты что-то делаешь руками. Каждая лаборатория — интерактивная модель, в которой можно ошибаться без последствий." />
      {s.enrolled.map((tid) => {
        const t = trackById(tid)!
        return (
          <section key={tid} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Icon name={t.cover.icon} className="text-violet-soft" />{t.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {t.labs.map((l) => {
                const n = nodeById(l.nodeId)!
                const locked = s.status(l.nodeId) === 'locked'
                const done = s.labsDone.includes(l.id)
                return (
                  <div key={l.id} className={`card overflow-hidden flex flex-col ${locked ? 'opacity-60' : 'card-hover'}`}>
                    <div className={`h-28 bg-gradient-to-br ${TONE[l.id] ?? 'from-violet/20'} to-transparent grid-bg relative grid place-items-center`}>
                      <Icon name={l.icon} className="text-[48px] text-ink/80" />
                      {done && <span className="absolute top-3 right-3 chip bg-teal/20 text-teal-soft"><Icon name="check" className="text-[14px]" />Пройдено</span>}
                      {locked && <span className="absolute top-3 right-3 chip bg-s2 text-dim"><Icon name="lock" className="text-[14px]" />Закрыто</span>}
                      <span className="absolute left-3 bottom-3 chip bg-black/30 text-mute">{l.primitive}</span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="label">Узел: {n.title} · {l.minutes} мин</div>
                      <h3 className="text-lg font-bold mt-1">{l.title}</h3>
                      <p className="text-sm text-mute mt-1 flex-1">{l.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">{l.skills.map((x) => <span key={x} className="chip bg-s2 text-mute">{x}</span>)}</div>
                      {locked ? (
                        <Link to={`/track/${tid}`} className="btn-secondary mt-4">Сначала открой «{n.title}»</Link>
                      ) : (
                        <Link to={`/lab/${l.id}`} className={`${done ? 'btn-secondary' : 'btn-primary'} mt-4`}>
                          <Icon name={done ? 'replay' : 'play_arrow'} fill className="text-[18px]" />{done ? 'Пройти ещё раз' : 'Запустить'}
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      <div className="card p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
        <Icon name="auto_awesome" className="text-violet-soft text-[28px]" />
        <div className="flex-1">
          <div className="font-semibold">Лаборатории для любой темы</div>
          <p className="text-sm text-mute">Все лаборатории собраны из четырёх универсальных движков: пошаговый симулятор, ползунки с визуализацией, конструктор и диалог-сценарий. ИИ комбинирует их под химию, право, языки или трейдинг.</p>
        </div>
        <Link to="/catalog" className="btn-secondary shrink-0">Другие треки</Link>
      </div>
    </div>
  )
}
