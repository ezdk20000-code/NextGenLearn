import type { Evolution } from '../data/cs-program'
import { Icon } from './ui'

/** «Было → стало»: как технология изменилась с момента издания книги. */
export default function EvolutionBlock({ e, compact }: { e: Evolution; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-line bg-[#0A0E16] ${compact ? 'p-3' : 'p-4 md:p-5'}`}>
      <div className="flex items-center gap-1.5 label text-amber-soft"><Icon name="update" className="text-[16px]" />Обновление знаний · {e.topic}</div>
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-3 mt-3 items-stretch">
        <div className="rounded-lg border border-s3 bg-s2/40 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-dim">Раньше · в книге</div>
          <p className="text-sm text-mute mt-1 leading-relaxed">{e.was}</p>
        </div>
        <div className="grid place-items-center text-teal-soft"><Icon name="arrow_forward" className="rotate-90 md:rotate-0" /></div>
        <div className="rounded-lg border border-teal/40 bg-teal/5 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-teal-soft">Теперь</div>
          <p className="text-sm text-ink/90 mt-1 leading-relaxed">{e.now}</p>
        </div>
      </div>
    </div>
  )
}
