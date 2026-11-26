import { useEffect, useRef } from 'react'
import type { Vm } from './vm'
import { osText } from './os'

/** Стек в RAM: ячейки от 256 до SP, кадры вызовов выделены рамкой. */
export function StackView({ vm, tick }: { vm: Vm; tick: number }) {
  void tick
  const sp = vm.ram[0]
  const frames = new Map<number, { fn: string; idx: number }>()
  let lcl = vm.ram[1]
  for (let k = vm.calls.length - 1; k >= 0 && lcl > 261; k--) {
    for (let j = 1; j <= 5; j++) frames.set(lcl - j, { fn: vm.calls[k].fn, idx: j })
    lcl = vm.ram[lcl - 4]
  }
  const NAMES = ['', 'THAT', 'THIS', 'ARG', 'LCL', 'адрес возврата']
  const top = Math.max(sp, 257)
  const from = Math.max(256, top - 16)
  const cells = []
  for (let a = top; a >= from; a--) cells.push(a)
  return (
    <div className="space-y-1 font-mono text-xs">
      {cells.map((a) => {
        const f = frames.get(a)
        const isSp = a === sp
        const fresh = a === sp - 1
        return (
          <div key={a} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isSp ? 'border-dashed border-line text-dim' : fresh ? 'border-teal bg-teal/10' : f ? 'border-violet/40 bg-violet/5' : 'border-line'}`}>
            <span className="text-dim w-16">RAM[{a}]</span>
            <span className={`flex-1 ${fresh ? 'text-teal-soft font-bold' : ''}`}>{isSp ? '(вершина пуста)' : vm.ram[a]}</span>
            {f && <span className="text-[10px] text-violet-soft">{NAMES[f.idx]} · {f.fn}</span>}
            {isSp && <span className="chip !py-0 bg-amber/15 text-amber-soft !text-[10px]">← SP</span>}
          </div>
        )
      })}
      {from > 256 && <div className="text-center text-dim text-[10px]">… ниже ещё {from - 256} ячеек</div>}
    </div>
  )
}

export function Registers({ vm }: { vm: Vm }) {
  const R = [['SP', 0, 'вершина стека'], ['LCL', 1, 'локальные'], ['ARG', 2, 'аргументы'], ['THIS', 3, 'объект'], ['THAT', 4, 'массив']] as const
  return (
    <div className="grid grid-cols-2 gap-2">
      {R.map(([n, a, d]) => (
        <div key={n} className="rounded-lg border border-line p-2">
          <div className="text-[10px] text-dim font-mono">{n} (RAM[{a}])</div>
          <div className={`font-mono text-lg font-bold ${n === 'SP' ? 'text-teal-soft' : n === 'ARG' ? 'text-amber-soft' : ''}`}>{vm.ram[a]}</div>
          <div className="text-[10px] text-dim">{d}</div>
        </div>
      ))}
    </div>
  )
}

export function Segments({ vm }: { vm: Vm }) {
  const seg = (base: number, n: number) => Array.from({ length: n }, (_, i) => vm.ram[base + i])
  const fn = vm.calls[vm.calls.length - 1]
  const line = vm.lines.find((l) => l.cmd.op === 'function' && fn && l.cmd.name === fn.fn)
  const nLocal = line && line.cmd.op === 'function' ? line.cmd.nVars : 0
  const rows: [string, string][] = [
    [`local[0..${Math.max(0, nLocal - 1)}]`, nLocal ? seg(vm.ram[1], Math.min(nLocal, 6)).join(', ') : '—'],
    ['argument[0..3]', seg(vm.ram[2], 4).join(', ')],
    ['temp 0–7', seg(5, 8).join(', ')],
    ['pointer 0/1', `${vm.ram[3]} / ${vm.ram[4]}`],
  ]
  return <div className="space-y-1.5">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 rounded-md bg-s2/50 px-2 py-1.5 text-xs font-mono"><span className="text-dim">{k}</span><span className="text-right break-all">{v}</span></div>)}</div>
}

export function CallStack({ vm }: { vm: Vm }) {
  return (
    <ol className="space-y-1">
      {[...vm.calls].reverse().map((c, i) => <li key={i} className={`rounded-md px-2 py-1.5 text-xs font-mono flex justify-between ${i === 0 ? 'bg-violet/15 text-violet-soft' : 'bg-s2/50 text-mute'}`}><span>{vm.calls.length - i}. {c.fn}</span>{i === 0 && <span className="text-[10px]">сейчас</span>}</li>)}
      {vm.calls.length === 0 && <li className="text-xs text-dim">— вне функций —</li>}
    </ol>
  )
}

/** Экран Hack из памяти ВМ плюс текстовый вывод Output поверх. */
export function VmScreen({ vm, tick, text = true }: { vm: Vm; tick: number; text?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!; const img = ctx.createImageData(512, 256)
    for (let w = 0; w < 8192; w++) {
      const v = vm.ram[16384 + w]; const row = w >> 5, col0 = (w & 31) << 4
      for (let b = 0; b < 16; b++) { const on = (v >> b) & 1; const p = (row * 512 + col0 + b) * 4; const g = on ? 15 : 236; img.data[p] = g; img.data[p + 1] = g; img.data[p + 2] = g + (on ? 8 : 4); img.data[p + 3] = 255 }
    }
    ctx.putImageData(img, 0, 0)
    if (text) {
      ctx.fillStyle = '#111827'; ctx.font = '10px JetBrains Mono, monospace'; ctx.textBaseline = 'top'
      osText(vm).split('\n').forEach((r, i) => { if (r.trim()) ctx.fillText(r, 0, i * 11) })
    }
  }, [vm, tick, text])
  return <canvas ref={ref} width={512} height={256} className="w-full rounded-md border border-line" style={{ imageRendering: 'pixelated' }} aria-label="Экран 512 на 256" />
}
