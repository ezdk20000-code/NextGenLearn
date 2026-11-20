import { useState, type ReactNode } from 'react'

// Цвета графиков: проверены валидатором палитры на тёмной поверхности #111827
// (полоса светлоты, различимость при дальтонизме, контраст). Порядок фиксирован.
export const SERIES = ['#6366F1', '#0D9488', '#D97706', '#E11D48'] as const
const AXIS = '#94A3B8'
const GRID = '#1E293B'

export function Tooltip({ x, y, children }: { x: number | string; y: number | string; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-s3 bg-[rgba(17,24,39,0.95)] px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
      style={{ left: x, top: typeof y === 'number' ? y - 8 : `calc(${y} - 8px)` }}>{children}</div>
  )
}

/** Столбики одной серии с подсказкой при наведении. */
export function BarChart({ data, color = SERIES[0], height = 160, width = 600, unit = '', highlight }: { data: { label: string; value: number }[]; color?: string; height?: number; width?: number; unit?: string; highlight?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = width, H = height, pad = { l: 34, r: 6, t: 10, b: 22 }
  const max = Math.max(1, ...data.map((d) => d.value))
  // «Круглый» шаг шкалы: 1, 2, 5 × 10^k — чтобы все отметки были целыми
  const raw = max / 2
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw)!
  const nice = Math.max(2, step * 2)
  const bw = (W - pad.l - pad.r) / data.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const every = Math.ceil(data.length / 10)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={data.map((d) => `${d.label}: ${Math.round(d.value)}`).join(', ')}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(nice * f) + 4} textAnchor="end" fontSize="10" fill={AXIS} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(nice * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = Math.max(0, H - pad.b - y(d.value))
          const x = pad.l + i * bw + 1
          const w = Math.max(1, bw - 2)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && <path d={`M${x},${H - pad.b} V${H - pad.b - h + Math.min(4, h)} Q${x},${H - pad.b - h} ${x + Math.min(4, w / 2)},${H - pad.b - h} H${x + w - Math.min(4, w / 2)} Q${x + w},${H - pad.b - h} ${x + w},${H - pad.b - h + Math.min(4, h)} V${H - pad.b} Z`}
                fill={color} opacity={hover === null || hover === i ? (highlight === undefined || highlight === i ? 1 : 0.75) : 0.45} />}
              {i % every === 0 && <text x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={AXIS}>{d.label}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tooltip x={`${((pad.l + hover * bw + bw / 2) / W) * 100}%`} y={0}>
          <span className="text-mute">{data[hover].label}: </span><b>{Math.round(data[hover].value * 10) / 10}{unit}</b>
        </Tooltip>
      )}
    </div>
  )
}
