import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { nodeById } from '../data/networks'
import { Icon, PageHeader } from '../components/ui'

const LABS = [
  { id: 'encap', node: 'layers', icon: 'deployed_code', title: 'Матрёшка пакета', desc: 'Собери пакет из заголовков и выясни, что меняет роутер по пути.', skills: ['инкапсуляция', 'MAC vs IP', 'TTL'], min: 8, tone: 'from-[#FDA4AF]/20' },
  { id: 'tcp', node: 'tcp', icon: 'handshake', title: 'TCP: рукопожатие и потери', desc: 'Управляй клиентом: установи соединение, переживи потерю пакета, закрой сессию.', skills: ['SYN/ACK/FIN', 'seq и ack', 'повторная передача'], min: 12, tone: 'from-violet/25' },
  { id: 'subnet', node: 'subnets', icon: 'grid_view', title: 'Нарезка подсетей', desc: 'Раздели адресное пространство между отделами компании без потерь.', skills: ['маски', 'CIDR', 'двоичная запись'], min: 10, tone: 'from-teal/20' },
]

export default function Labs() {
  const s = useStore()
  return (
    <div>
      <PageHeader eyebrow="Практика" title="Лаборатории" sub="Знание закрепляется, когда ты что-то делаешь руками. Каждая лаборатория — интерактивная модель, в которой можно ошибаться без последствий." />
      <div className="grid gap-4 md:grid-cols-3">
        {LABS.map((l) => {
          const n = nodeById(l.node)!
          const locked = s.status(l.node) === 'locked'
          const done = s.labsDone.includes(l.id)
          return (
            <div key={l.id} className={`card overflow-hidden flex flex-col ${locked ? 'opacity-60' : 'card-hover'}`}>
              <div className={`h-28 bg-gradient-to-br ${l.tone} to-transparent grid-bg relative grid place-items-center`}>
                <Icon name={l.icon} className="text-[48px] text-ink/80" />
                {done && <span className="absolute top-3 right-3 chip bg-teal/20 text-teal-soft"><Icon name="check" className="text-[14px]" />Пройдено</span>}
                {locked && <span className="absolute top-3 right-3 chip bg-s2 text-dim"><Icon name="lock" className="text-[14px]" />Закрыто</span>}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="label">Узел: {n.title} · {l.min} мин</div>
                <h3 className="text-lg font-bold mt-1">{l.title}</h3>
                <p className="text-sm text-mute mt-1 flex-1">{l.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">{l.skills.map((x) => <span key={x} className="chip bg-s2 text-mute">{x}</span>)}</div>
                {locked ? (
                  <Link to="/track" className="btn-secondary mt-4">Сначала открой «{n.title}»</Link>
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
      <div className="card p-5 mt-4 flex flex-col sm:flex-row gap-4 sm:items-center">
        <Icon name="auto_awesome" className="text-violet-soft text-[28px]" />
        <div className="flex-1">
          <div className="font-semibold">Лаборатории для любой темы</div>
          <p className="text-sm text-mute">Эти три собраны из универсальных «примитивов»: пошаговый симулятор, ползунки с визуализацией, конструктор. ИИ будет комбинировать их под химию, право, языки или трейдинг.</p>
        </div>
      </div>
    </div>
  )
}
