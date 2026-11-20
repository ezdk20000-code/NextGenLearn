import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { TIER_NAMES, nodeById, trackById } from '../data'
import { useStore } from '../store'
import { Bar, Icon, PageHeader, Ring } from '../components/ui'

const COLORS = { done: '#14B8A6', available: '#6366F1', locked: '#334155' }

export default function Track() {
  const s = useStore()
  const { trackId } = useParams()
  const id = trackId || s.activeTrack
  const track = trackById(id)
  const [sel, setSel] = useState<string>('')

  useEffect(() => {
    if (track?.playable && s.enrolled.includes(track.id) && s.activeTrack !== track.id) s.setActiveTrack(track.id)
    setSel(s.nextNodeOf(id) ?? track?.nodes[0]?.id ?? '')
  }, [id]) // eslint-disable-line

  if (!track) return <Navigate to="/catalog" replace />
  if (!track.playable || !s.enrolled.includes(track.id)) return <Navigate to={`/catalog/${track.id}`} replace />

  const node = nodeById(sel) ?? track.nodes[0]
  const st = s.status(node.id)
  const vit = s.vitality(node.id)
  const progress = s.progressOf(track.id)
  const edges = track.nodes.flatMap((n) => n.requires.map((r) => ({ from: nodeById(r)!, to: n })))

  return (
    <div>
      <PageHeader eyebrow={`Трек · ${track.category}`} title={track.title} sub="Каждый узел — одно понятие. Узел открывается, когда освоены все понятия под ним. Нажми на узел, чтобы увидеть детали."
        right={
          <div className="flex items-center gap-3 card px-4 py-3">
            <Ring value={progress} size={48} stroke={5}><span className="text-xs font-bold">{progress}%</span></Ring>
            <div className="text-xs text-mute leading-relaxed">
              <div><span className="inline-block w-2 h-2 rounded-full bg-teal mr-1.5" />освоено</div>
              <div><span className="inline-block w-2 h-2 rounded-full bg-violet mr-1.5" />доступно</div>
              <div><span className="inline-block w-2 h-2 rounded-full bg-s3 mr-1.5" />закрыто</div>
            </div>
          </div>
        } />

      {s.enrolled.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {s.enrolled.map((tid) => {
            const t = trackById(tid)!
            return (
              <Link key={tid} to={`/track/${tid}`} className={`chip !text-xs !px-3 !py-1.5 border shrink-0 ${tid === id ? 'border-violet bg-violet/10 text-violet-soft' : 'border-line text-mute hover:text-ink'}`}>
                <Icon name={t.cover.icon} className="text-[15px]" />{t.title}
              </Link>
            )
          })}
          <Link to="/catalog" className="chip !text-xs !px-3 !py-1.5 border border-dashed border-s3 text-dim hover:text-ink shrink-0"><Icon name="add" className="text-[15px]" />Ещё трек</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card grid-bg overflow-x-auto">
          <div className="md:hidden text-[11px] text-dim px-4 pt-3 flex items-center gap-1"><Icon name="swipe" className="text-[14px]" />Листай граф в стороны</div>
          <svg viewBox="0 0 1000 660" className="w-full min-w-[760px] h-auto select-none">
            <defs>
              <linearGradient id="edge" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#14B8A6" /><stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="6" /></filter>
            </defs>
            {TIER_NAMES.map((t, i) => (
              <text key={t} x={18} y={600 - i * 125} fill="#64748B" fontSize="12" fontWeight="700" letterSpacing="1.5">{t.toUpperCase()}</text>
            ))}
            {edges.map(({ from, to }) => {
              const lit = s.status(from.id) === 'done'
              const active = lit && s.status(to.id) !== 'locked'
              const my = (from.y + to.y) / 2
              return (
                <path key={from.id + to.id} d={`M${from.x},${from.y} C${from.x},${my} ${to.x},${my} ${to.x},${to.y}`}
                  fill="none" stroke={active ? 'url(#edge)' : '#1E293B'} strokeWidth={active ? 2.5 : 2}
                  className={active && s.status(to.id) === 'available' ? 'flow-line' : ''} />
              )
            })}
            {track.nodes.map((n) => {
              const ns = s.status(n.id)
              const isSel = n.id === node.id
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => setSel(n.id)} className="cursor-pointer">
                  {ns === 'available' && <circle r={30} fill="#6366F1" opacity={0.35} filter="url(#glow)" />}
                  {isSel && <circle r={34} fill="none" stroke="#C0C1FF" strokeWidth={1.5} strokeDasharray="4 4" />}
                  <circle r={24} fill={ns === 'done' ? 'rgba(20,184,166,0.15)' : ns === 'available' ? 'rgba(99,102,241,0.2)' : '#111827'} stroke={COLORS[ns]} strokeWidth={2} />
                  <text textAnchor="middle" dy="7" fontSize="20" fill={ns === 'locked' ? '#475569' : ns === 'done' ? '#4FDBC8' : '#C0C1FF'}
                    style={{ fontFamily: 'Material Symbols Rounded' }}>
                    {ns === 'done' ? 'check' : ns === 'locked' ? 'lock' : n.lab ? 'science' : 'play_arrow'}
                  </text>
                  <text textAnchor="middle" y={44} fontSize="14" fontWeight="600" fill={ns === 'locked' ? '#64748B' : '#F8FAFC'}
                    stroke="#0B0F17" strokeWidth={5} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>{n.title}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Панель узла */}
        <div className="card p-5 lg:sticky lg:top-24 self-start pop" key={node.id}>
          <div className="flex items-center gap-2">
            <span className="chip bg-s2 text-mute">{TIER_NAMES[node.tier]}</span>
            <span className={`chip ${st === 'done' ? 'bg-teal/15 text-teal-soft' : st === 'available' ? 'bg-violet/15 text-violet-soft' : 'bg-s2 text-dim'}`}>
              {st === 'done' ? 'Освоено' : st === 'available' ? 'Доступно' : 'Закрыто'}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-3">{node.title}</h2>
          <p className="text-sm text-mute mt-2">{node.short}</p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-dim">Мастерство</span><span className="font-mono text-teal-soft">{s.mastery(node.id)}%</span></div>
              <Bar value={s.mastery(node.id)} color="teal" />
            </div>
            {vit !== null && (
              <div title="Средняя вероятность вспомнить карточки этого узла прямо сейчас (FSRS)">
                <div className="flex justify-between text-xs mb-1.5"><span className="text-dim">Свежесть в памяти</span><span className="font-mono text-amber-soft">{Math.round(vit * 100)}%</span></div>
                <Bar value={vit * 100} color="amber" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
            <div className="rounded-lg bg-s2/60 p-2.5"><div className="text-dim">Время</div><div className="font-semibold mt-0.5">{node.minutes} мин</div></div>
            <div className="rounded-lg bg-s2/60 p-2.5"><div className="text-dim">Награда</div><div className="font-semibold mt-0.5">+{node.xp} XP</div></div>
          </div>

          {node.requires.length > 0 && (
            <div className="mt-4">
              <div className="label mb-2">Нужно знать</div>
              <div className="space-y-1.5">
                {node.requires.map((r) => (
                  <button key={r} onClick={() => setSel(r)} className="w-full flex items-center gap-2 text-sm text-left hover:text-violet-soft">
                    <Icon name={s.status(r) === 'done' ? 'check_circle' : 'radio_button_unchecked'} fill={s.status(r) === 'done'}
                      className={`text-[18px] ${s.status(r) === 'done' ? 'text-teal-soft' : 'text-dim'}`} />
                    {nodeById(r)!.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2">
            {st === 'locked' ? (
              <div className="rounded-lg border border-line p-3 text-sm text-mute flex gap-2"><Icon name="lock" className="text-[18px]" />Сначала освой понятия выше.</div>
            ) : (
              <Link to={`/lesson/${node.id}`} className="btn-primary w-full">
                <Icon name={st === 'done' ? 'replay' : 'play_arrow'} fill className="text-[20px]" />
                {st === 'done' ? 'Повторить урок' : 'Начать урок'}
                {!track.lessons[node.id] && <span className="chip bg-white/15 !py-0 ml-1">черновик</span>}
              </Link>
            )}
            {node.lab && st !== 'locked' && (
              <Link to={`/lab/${node.lab}`} className="btn-secondary w-full">
                <Icon name="science" className="text-[20px]" /> Лаборатория
                {s.labsDone.includes(node.lab) && <Icon name="check_circle" fill className="text-teal-soft text-[18px]" />}
              </Link>
            )}
            {st !== 'locked' && (
              <Link to={`/deep?node=${node.id}`} className="btn-ghost w-full"><Icon name="center_focus_strong" className="text-[20px]" />Deep Study по узлу</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
