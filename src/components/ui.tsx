import type { ReactNode } from 'react'

export function Icon({ name, fill, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return <span className={`icon ${fill ? 'fill' : ''} ${className}`} aria-hidden>{name}</span>
}

export function Ring({ value, size = 64, stroke = 6, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = `rg-${size}-${stroke}`
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1E293B" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Bar({ value, color = 'violet' }: { value: number; color?: 'violet' | 'teal' | 'amber' }) {
  const bg = color === 'teal' ? 'bg-teal' : color === 'amber' ? 'bg-amber' : 'bg-gradient-to-r from-violet to-teal'
  return (
    <div className="h-1.5 rounded-full bg-s2 overflow-hidden">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${value}%`, transition: 'width .5s ease' }} />
    </div>
  )
}

/** Мини-markdown: **жирный**, *курсив*, `код`. */
export function Md({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i} className="text-ink font-semibold">{p.slice(2, -2)}</strong>
        if (p.startsWith('*')) return <em key={i} className="text-violet-soft not-italic">{p.slice(1, -1)}</em>
        if (p.startsWith('`')) return <code key={i} className="font-mono text-[0.9em] text-teal-soft bg-s2 px-1.5 py-0.5 rounded">{p.slice(1, -1)}</code>
        return p
      })}
    </span>
  )
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="label text-teal-soft mb-2">{eyebrow}</div>}
        <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="text-mute mt-2 max-w-2xl text-sm md:text-base">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, hint, icon, tone = 'violet' }: { label: string; value: ReactNode; hint?: string; icon: string; tone?: 'violet' | 'teal' | 'amber' }) {
  const c = tone === 'teal' ? 'text-teal-soft' : tone === 'amber' ? 'text-amber-soft' : 'text-violet-soft'
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <Icon name={icon} className={`text-[20px] ${c}`} />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="text-xs text-dim mt-1">{hint}</div>}
    </div>
  )
}
