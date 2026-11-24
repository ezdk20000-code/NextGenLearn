import { useState, type ReactNode } from 'react'
import { Icon } from '../components/ui'

export interface LabProps { onDone: (mistakes: number) => void }

/** Шапка шага: «Задание 2 из 4» и полоса прогресса. */
export function Steps({ i, total, title, children }: { i: number; total: number; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-violet/30 bg-violet/5 p-4">
      <div className="flex items-center gap-2">
        <span className="label text-violet-soft">Задание {Math.min(i + 1, total)} из {total}</span>
        <div className="flex gap-1 ml-auto">{Array.from({ length: total }, (_, k) => <span key={k} className={`w-6 h-1.5 rounded-full ${k < i ? 'bg-teal' : k === i ? 'bg-violet' : 'bg-s3'}`} />)}</div>
      </div>
      <div className="font-semibold mt-1.5">{title}</div>
      {children && <div className="text-sm text-mute mt-1">{children}</div>}
    </div>
  )
}

export function Feedback({ fb }: { fb: null | { ok: boolean; msg: ReactNode } }) {
  if (!fb) return null
  return <div className={`rounded-lg p-3 text-sm pop ${fb.ok ? 'bg-teal/10' : 'bg-rose/10'}`}><b className={fb.ok ? 'text-teal-soft' : 'text-rose-soft'}>{fb.ok ? 'Верно.' : 'Пока нет.'}</b> {fb.msg}</div>
}

/** Поле для числового/короткого ответа. */
export function AnswerBox({ onSubmit, placeholder = 'Ответ' }: { onSubmit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState('')
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSubmit(v.trim()); setV('') } }}>
      <input className="input font-mono" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <button className="btn-primary shrink-0">Ответить</button>
    </form>
  )
}

export function Toggle({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: ReactNode; sub?: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-lg border px-2 py-2 min-w-[44px] text-center transition-colors ${on ? 'border-teal bg-teal/15 text-teal-soft' : 'border-line bg-[#0A0E16] text-dim hover:border-s3'}`}>
      <div className="font-mono font-bold text-lg leading-none">{label}</div>
      {sub !== undefined && <div className="font-mono text-[10px] mt-1 opacity-80">{sub}</div>}
    </button>
  )
}

export function AllDone({ text }: { text: string }) {
  return <div className="rounded-lg border border-teal/40 bg-teal/10 p-4 flex gap-3 pop"><Icon name="task_alt" className="text-teal-soft text-[24px]" /><div className="text-sm"><b className="text-teal-soft">Лаборатория пройдена.</b> {text}</div></div>
}

export const norm = (s: string) => s.replace(/\s+/g, '').replace(',', '.').toLowerCase()
