import type { ComponentType } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { labById, nodeById, trackById } from '../data'
import { useStore } from '../store'
import { Icon } from '../components/ui'
import type { LabProps } from '../labs/kit'
import { BitsLab, BytesLab, LogicSeries, MorseLab, NAND_TASKS, SwitchesLab } from '../labs/cs0-a'
import { ADDER_TASKS, CounterLab, CpuLab, FloatLab, LatchLab, RamLab, TwosLab } from '../labs/cs0-b'

/** Лаборатории курсов программы CS: id → интерактивная модель. */
const LABS: Record<string, ComponentType<LabProps>> = {
  'cs0-morse': MorseLab,
  'cs0-bytes': BytesLab,
  'cs0-bits': BitsLab,
  'cs0-switches': SwitchesLab,
  'cs0-nand': (p) => <LogicSeries {...p} tasks={NAND_TASKS} final="Из одного-единственного вентиля NAND ты собрал NOT, AND, OR и XOR. Поэтому NAND называют универсальным: из него можно построить весь компьютер — именно это ты сделаешь в CS1." />,
  'cs0-adder': (p) => <LogicSeries {...p} tasks={ADDER_TASKS} final="Цепочка из восьми полных сумматоров складывает байты, из 64 — числа современного процессора. Перенос бежит от младшего разряда к старшему." />,
  'cs0-twos': TwosLab,
  'cs0-latch': LatchLab,
  'cs0-counter': CounterLab,
  'cs0-ram': RamLab,
  'cs0-cpu': CpuLab,
  'cs0-float': FloatLab,
}
export const CS_LAB_IDS = Object.keys(LABS)

export default function CsLab() {
  const { id = '' } = useParams()
  const s = useStore()
  const lab = labById(id)
  const Comp = LABS[id]
  if (!lab || !Comp) return <Navigate to="/labs" replace />
  const node = nodeById(lab.nodeId)
  const track = trackById(lab.trackId)
  const done = s.labsDone.includes(id)
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-dim mb-3 flex-wrap">
        <Link to={`/track/${lab.trackId}`} className="hover:text-ink flex items-center gap-1"><Icon name="arrow_back" className="text-[16px]" />{track?.title}</Link>
        <span>/</span><Link to={`/lesson/${lab.nodeId}`} className="hover:text-ink">{node?.title}</Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-5">
        <div className="flex-1">
          <div className="label text-amber-soft flex items-center gap-1.5"><Icon name={lab.icon} className="text-[16px]" />Лаборатория · {lab.primitive} · ~{lab.minutes} мин</div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-1">{lab.title}</h1>
          <p className="text-mute mt-1 max-w-3xl">{lab.desc}</p>
        </div>
        {done && <span className="chip bg-teal/15 text-teal-soft self-start md:self-end"><Icon name="check_circle" fill className="text-[16px]" />Пройдено</span>}
      </div>
      <Comp onDone={(mistakes) => {
        if (!s.labsDone.includes(id)) s.completeLab(id, lab.nodeId, Math.max(60, 150 - mistakes * 10), mistakes)
        s.notify(`Лаборатория «${lab.title}» пройдена`)
      }} />
      <div className="flex flex-wrap gap-2 mt-6">
        <Link to={`/track/${lab.trackId}`} className="btn-secondary"><Icon name="hub" className="text-[18px]" />К дереву курса</Link>
      </div>
    </div>
  )
}
