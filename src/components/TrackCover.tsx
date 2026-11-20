import type { Track } from '../data'
import { Icon } from './ui'

/** Фон для маленьких значков трека: картинка обложки поверх градиента. */
export const thumbStyle = (t: Track) => ({
  background: `${t.cover.image ? `center / cover no-repeat url(${t.cover.image}), ` : ''}linear-gradient(135deg, ${t.cover.from}, ${t.cover.to})`,
})

/** Обложка трека: картинка из макетов или (если её нет) градиент темы с иконкой. */
export default function TrackCover({ track, className = 'h-36', big }: { track: Track; className?: string; big?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${track.cover.from}, ${track.cover.to})` }}>
      {track.cover.image ? (
        <img src={track.cover.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <>
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div className="absolute -right-6 -bottom-8 opacity-25">
            <Icon name={track.cover.icon} className={big ? 'text-[220px]' : 'text-[150px]'} />
          </div>
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />
      <div className="absolute left-4 top-4 flex gap-1.5">
        <span className="chip bg-black/40 backdrop-blur text-white/90 border border-white/15">{track.level}</span>
        {track.isNew && <span className="chip bg-amber/90 text-[#2a1700]">Новый</span>}
        {!track.playable && <span className="chip bg-black/40 backdrop-blur text-white/70 border border-white/15">Программа готовится</span>}
      </div>
    </div>
  )
}
