import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { AnswerBox, Feedback, Steps } from '../labs/kit'
import { VM_CASES } from '../code/projects'
import { Vm } from './vm'
import { CallStack, Registers, Segments, StackView } from './VmView'

const PROGRAMS = ['SimpleAdd', 'StackTest', 'BasicLoop', 'FibonacciElement'] as const
const TASKS = [
  { prog: 'SimpleAdd', q: 'Выполни SimpleAdd по шагам. Какое число окажется на вершине стека после add?', a: '15', why: 'add снимает 7 и 8 и кладёт 15 — стек стал на одну ячейку короче.' },
  { prog: 'StackTest', q: 'В StackTest первые три команды: push 17, push 17, eq. Какое число кладёт eq, если значения равны?', a: '-1', why: 'В ВМ Hack «истина» — это −1 (все биты единицы), «ложь» — 0.' },
  { prog: 'BasicLoop', q: 'BasicLoop складывает числа от argument 0 до 1. При argument 0 = 3 какое число окажется на стеке в конце?', a: '6', why: '3 + 2 + 1 = 6. if-goto снимает значение со стека и прыгает, пока оно не 0.' },
  { prog: 'FibonacciElement', q: 'Запусти Fibonacci. Какое значение вернёт Main.fibonacci(7)? Найди его в temp 0, когда Sys.init уйдёт в бесконечный цикл.', a: '13', why: 'Каждый вызов создаёт кадр: адрес возврата и 4 сохранённых регистра. Рекурсия видна как растущая лестница кадров.' },
]

/** «Стековая машина вживую»: пошаговое выполнение ВМ-кода со стеком и кадрами. */
export default function VmLab({ onDone }: { onDone: (mistakes: number) => void }) {
  const [prog, setProg] = useState<(typeof PROGRAMS)[number]>('SimpleAdd')
  const make = (p: string) => {
    const c = VM_CASES[p]
    const vm = new Vm(c.files, {})
    if (c.init) Object.entries(c.init).forEach(([a, v]) => { vm.ram[Number(a)] = v })
    if (c.boot) vm.boot()
    return vm
  }
  const vmRef = useRef<Vm>(make('SimpleAdd'))
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const vm = vmRef.current
  const reset = (p = prog) => { vmRef.current = make(p); setRunning(false); setTick((t) => t + 1) }
  useEffect(() => { reset(prog) }, [prog]) // eslint-disable-line
  useEffect(() => {
    if (!running) return
    let raf = 0, last = 0
    const per = [1, 1, 5, 50, 2000][speed]
    const delay = [600, 200, 50, 16, 0][speed]
    const loop = (t: number) => {
      if (t - last >= delay) {
        last = t
        const v = vmRef.current
        for (let i = 0; i < per; i++) {
          const pc = v.pc; v.step()
          const line = v.lines[pc]
          if (v.halted || (line?.cmd.op === 'goto' && v.pc < pc && v.lines[v.pc].cmd.op === 'label' && v.pc === pc - 1)) { setRunning(false); break }
        }
        setTick((x) => x + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, speed])

  const lines = useMemo(() => Object.entries(VM_CASES[prog].files).flatMap(([f, t]) => t.split('\n').filter((l) => l.trim()).map((l) => ({ f, l }))), [prog])
  const cur = vm.lines[vm.pc]
  const curIdx = cur ? vm.lines.indexOf(cur) : -1
  const task = TASKS[ti]

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg bg-s2/60 p-0.5 text-sm">
          {PROGRAMS.map((p) => <button key={p} onClick={() => setProg(p)} className={`px-3 py-1.5 rounded-md ${p === prog ? 'bg-violet/25 text-violet-soft' : 'text-mute hover:text-ink'}`}>{p === 'FibonacciElement' ? 'Fibonacci' : p}</button>)}
        </div>
        <button onClick={() => { vm.step(); setTick((t) => t + 1) }} disabled={running || vm.halted} className="btn-secondary !py-1.5"><Icon name="skip_next" className="text-[18px]" />Шаг</button>
        <button onClick={() => setRunning(true)} disabled={running || vm.halted} className="btn-primary !py-1.5"><Icon name="play_arrow" fill className="text-[18px]" />Выполнить</button>
        <button onClick={() => setRunning(false)} disabled={!running} className="btn-ghost !py-1.5"><Icon name="pause" className="text-[18px]" />Стоп</button>
        <button onClick={() => reset()} className="btn-ghost !py-1.5"><Icon name="restart_alt" className="text-[18px]" />Сброс</button>
        <label className="flex items-center gap-2 text-xs text-dim">Скорость<input type="range" min={0} max={4} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="accent-violet w-24" /></label>
        <span className="ml-auto chip bg-s2 text-mute font-mono">шагов: {vm.steps}</span>
        {cur && <span className="chip border border-amber/40 bg-amber/10 text-amber-soft font-mono">{cur.text}</span>}
        {vm.halted && <span className="chip bg-teal/15 text-teal-soft">программа завершилась</span>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px_320px]">
        <section className="card p-4 min-w-0">
          <div className="font-bold mb-2 flex items-center gap-1.5"><Icon name="code" className="text-[18px] text-violet-soft" />ВМ-код</div>
          <ol className="font-mono text-[13px] leading-6 max-h-[560px] overflow-y-auto rounded-lg bg-[#0A0E16] border border-line py-2">
            {lines.map((x, i) => {
              const isFn = x.l.startsWith('function') || x.l.startsWith('label')
              return <li key={i} className={`px-3 flex gap-3 ${i === curIdx ? 'bg-amber/10 border-l-2 border-amber text-amber-soft font-bold' : ''}`}><span className="text-dim w-6 text-right select-none">{i + 1}</span><span className={isFn ? 'text-violet-soft' : x.l.startsWith('call') || x.l.startsWith('return') ? 'text-rose-soft' : ''}>{isFn ? x.l : `  ${x.l}`}</span></li>
            })}
          </ol>
        </section>
        <section className="card p-4">
          <div className="flex items-center justify-between mb-2"><span className="font-bold flex items-center gap-1.5"><Icon name="stacks" className="text-[18px] text-teal-soft" />Стек в RAM</span><span className="chip bg-teal/15 text-teal-soft font-mono">SP = {vm.ram[0]}</span></div>
          <StackView vm={vm} tick={tick} />
          <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-dim"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-teal" />только что положено</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet" />кадр вызова</span></div>
        </section>
        <section className="space-y-4">
          <div className="card p-4"><div className="font-bold mb-2">Базовые регистры</div><Registers vm={vm} /></div>
          <div className="card p-4"><div className="font-bold mb-2">Сегменты памяти</div><Segments vm={vm} /></div>
          <div className="card p-4"><div className="font-bold mb-2">Стек вызовов · глубина {vm.calls.length}</div><CallStack vm={vm} /></div>
        </section>
      </div>

      {ti < TASKS.length ? (
        <div className="space-y-3">
          <Steps i={ti} total={TASKS.length} title={task.q}>{prog !== task.prog && <button onClick={() => setProg(task.prog as (typeof PROGRAMS)[number])} className="text-violet-soft hover:underline">Открыть {task.prog === 'FibonacciElement' ? 'Fibonacci' : task.prog}</button>}</Steps>
          <AnswerBox onSubmit={(v) => {
            const ok = v.replace(/\s/g, '').replace('−', '-') === task.a
            setFb({ ok, msg: ok ? task.why : 'Прогони программу по шагам и посмотри на стек.' })
            if (!ok) { setMistakes((m) => m + 1); return }
            if (ti + 1 === TASKS.length) onDone(mistakes)
            setTimeout(() => { setTi(ti + 1); setFb(null) }, 1500)
          }} />
          <Feedback fb={fb} />
        </div>
      ) : <div className="rounded-lg border border-teal/40 bg-teal/10 p-4 text-sm"><b className="text-teal-soft">Лаборатория пройдена.</b> Теперь ты видел своими глазами, как стек, сегменты и кадры вызовов работают внутри ВМ — именно это будет делать твой транслятор.</div>}
    </div>
  )
}
