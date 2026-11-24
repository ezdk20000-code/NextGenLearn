import { Link } from 'react-router-dom'
import { CS_PROGRAM } from '../data/cs-program'
import { trackById } from '../data'
import { useStore } from '../store'
import { Icon } from '../components/ui'
import { hdlSolved } from '../hdl/HdlLab'
import { BUILDABLE } from '../hdl/chips'
import { CS1_MODULES } from '../data/cs1'

const ICONS = ['account_tree', 'calculate', 'memory_alt', 'terminal', 'developer_board', 'transform', 'layers', 'swap_vert', 'code', 'account_tree', 'build', 'settings_suggest']
const CHAIN = ['Nand', 'Not', 'And', 'Or', 'Xor', 'Mux', 'DMux', 'HalfAdder', 'FullAdder', 'Add16', 'ALU', 'DFF', 'Bit', 'Register', 'RAM16K', 'PC', 'CPU', 'Computer']

/** «Башня абстракций» CS1: 12 проектов снизу вверх, железо и программы. */
export default function Cs1Tower() {
  const s = useStore()
  const course = CS_PROGRAM.courses.find((c) => c.id === 'cs1-nand2tetris')!
  const track = trackById(course.id)!
  const solved = new Set(['Nand', 'DFF', ...hdlSolved()])
  const examOf = (mid: string) => track.nodes.find((n) => n.exam && n.id === `${mid}-exam`)
  const status = (mid: string, i: number) => {
    const ex = examOf(mid)
    if (ex && s.lessonsDone.includes(ex.id)) return 'done'
    if (!ex) return 'soon'
    const prevMid = course.modules[i - 1]?.id
    if (i === 0 || (prevMid && examOf(prevMid) && s.lessonsDone.includes(`${prevMid}-exam`))) return 'now'
    return 'locked'
  }
  const tile = (i: number) => {
    const m = course.modules[i]
    const st = status(m.id, i)
    const chips = BUILDABLE.filter((c) => c.project === i + 1)
    const done = chips.filter((c) => solved.has(c.name)).length
    const mod = CS1_MODULES.find((x) => x.id === m.id)
    const first = mod && s.enrolled.includes(track.id) ? track.nodes.find((n) => mod.lessons.some((l) => l.id === n.id) && !s.lessonsDone.includes(n.id)) : undefined
    return (
      <div key={m.id} className={`rounded-xl border p-4 transition-colors ${st === 'now' ? 'border-violet/60 bg-violet/10 shadow-glow-violet' : st === 'done' ? 'border-teal/40 bg-teal/5' : 'border-line bg-[#0A0E16]'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${st === 'now' ? 'bg-violet/25 text-violet-soft' : st === 'done' ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}><Icon name={ICONS[i]} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] text-dim">ПРОЕКТ {i + 1}{st === 'now' ? ' · в работе' : st === 'done' ? ' · завершён' : ''}</div>
            <div className={`font-bold leading-snug ${st === 'soon' || st === 'locked' ? 'text-mute' : ''}`}>{m.title}</div>
            <div className="text-xs text-dim mt-0.5">{m.labs[m.labs.length - 1].goal}</div>
            {chips.length > 0 && (st === 'now' || st === 'done') && <div className="flex flex-wrap gap-1 mt-2">{chips.map((c) => <span key={c.name} className={`chip !py-0.5 font-mono !text-[10px] ${solved.has(c.name) ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}>{c.name}</span>)}</div>}
          </div>
          <div className="shrink-0 text-right">
            {st === 'done' && <Icon name="check_circle" fill className="text-teal-soft" />}
            {st === 'locked' && <Icon name="lock" className="text-dim" />}
            {st === 'soon' && <span className="chip bg-s2 text-dim !text-[10px]">пишется</span>}
            {st === 'now' && chips.length > 0 && <span className="chip bg-violet/20 text-violet-soft font-mono !text-[10px]">{done}/{chips.length}</span>}
          </div>
        </div>
        {st === 'now' && first && <Link to={`/lesson/${first.id}`} className="btn-primary !py-2 mt-3 w-full sm:w-auto"><Icon name="play_arrow" fill className="text-[18px]" />Продолжить: {first.title}</Link>}
      </div>
    )
  }
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_340px] mt-6">
      <div className="card p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2"><Icon name="stacks" className="text-violet-soft" />Башня абстракций</h2>
          <span className="text-xs text-dim">снизу вверх: от кремния к программам</span>
        </div>
        <div className="label mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet" />Программы · проекты 6–12</div>
        <div className="space-y-2">{[11, 10, 9, 8, 7, 6, 5].map(tile)}</div>
        <div className="my-4 flex items-center gap-3"><div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber/50" /><span className="chip border border-amber/40 bg-amber/10 text-amber-soft"><Icon name="bolt" className="text-[15px]" />Компьютер Hack готов и оживает</span><div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber/50" /></div>
        <div className="label mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal" />Железо · проекты 1–5</div>
        <div className="space-y-2">{[4, 3, 2, 1, 0].map(tile)}</div>
      </div>
      <div className="space-y-4">
        <div className="card p-4">
          <div className="font-bold flex items-center gap-2"><Icon name="developer_board" className="text-teal-soft" />Что ты соберёшь: компьютер Hack</div>
          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
            <div className="rounded-lg border border-violet/40 bg-violet/5 p-2.5 row-span-2"><div className="text-violet-soft font-bold">CPU</div><div className="text-dim mt-1">АЛУ · регистры A и D · PC</div></div>
            <div className="rounded-lg border border-amber/40 bg-amber/5 p-2.5"><div className="text-amber-soft font-bold">ROM32K</div><div className="text-dim">программа</div></div>
            <div className="rounded-lg border border-teal/40 bg-teal/5 p-2.5"><div className="text-teal-soft font-bold">RAM16K</div><div className="text-dim">данные</div></div>
            <div className="rounded-lg border border-line p-2.5"><div className="font-bold">Screen</div><div className="text-dim">512×256</div></div>
            <div className="rounded-lg border border-line p-2.5"><div className="font-bold">Keyboard</div><div className="text-dim">1 слово</div></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-lg bg-s2/60 p-2"><div className="font-bold">16 бит</div><div className="text-[10px] text-dim">слово</div></div>
            <div className="rounded-lg bg-s2/60 p-2"><div className="font-bold">32K</div><div className="text-[10px] text-dim">команд ROM</div></div>
            <div className="rounded-lg bg-s2/60 p-2"><div className="font-bold">1</div><div className="text-[10px] text-dim">базовый чип: Nand</div></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="font-bold flex items-center gap-2"><Icon name="link" className="text-violet-soft" />Цепочка твоих чипов</div>
          <p className="text-xs text-dim mt-1">Каждый следующий чип строится только из уже собранных. Никаких чёрных ящиков, кроме Nand и DFF.</p>
          <div className="flex flex-wrap gap-1.5 mt-3">{CHAIN.map((c, i) => <span key={c} className="flex items-center gap-1.5"><span className={`chip font-mono !text-[11px] ${solved.has(c) ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}>{c}</span>{i < CHAIN.length - 1 && <span className="text-dim text-xs">→</span>}</span>)}</div>
        </div>
        <div className="card p-4 border-amber/30">
          <div className="chip bg-amber/15 text-amber-soft">Финал курса</div>
          <div className="font-bold mt-2">На твоём компьютере запустится твоя игра</div>
          <p className="text-sm text-mute mt-1">Процессор из твоих чипов, ОС из твоих классов, игра на языке Jack, скомпилированная твоим компилятором.</p>
        </div>
      </div>
    </section>
  )
}
