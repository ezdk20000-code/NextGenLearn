import { useStore } from '../store'
import { nodeById } from '../data/networks'

export interface PlanRow { id: string; time: string; title: string; icon: string; tone: string; minutes: number; to: string }

/** План дня строится из состояния: повторение → новый урок → практика → фокус-блок. */
export function usePlan(): PlanRow[] {
  const s = useStore()
  const rows: PlanRow[] = []
  const due = s.dueCards().length
  rows.push({ id: 'review', time: '08:30', title: due ? `Повторить ${due} карточек` : 'Повторение (всё сделано)', icon: 'style', tone: 'text-amber-soft', minutes: Math.max(3, Math.round(due * 0.4)), to: '/review' })
  const next = s.nextNode ? nodeById(s.nextNode) : undefined
  if (next) rows.push({ id: 'lesson-' + next.id, time: '12:00', title: `Урок: ${next.title}`, icon: 'menu_book', tone: 'text-violet-soft', minutes: next.minutes, to: `/lesson/${next.id}` })
  const lab = !s.labsDone.includes('encap') && s.status('layers') === 'done' ? { id: 'encap', t: 'Лаборатория: Матрёшка пакета' }
    : !s.labsDone.includes('tcp') ? { id: 'tcp', t: 'Лаборатория: TCP-рукопожатие' }
    : !s.labsDone.includes('subnet') ? { id: 'subnet', t: 'Лаборатория: Нарезка подсетей' } : null
  if (lab) rows.push({ id: 'lab-' + lab.id, time: '18:30', title: lab.t, icon: 'science', tone: 'text-teal-soft', minutes: 15, to: `/lab/${lab.id}` })
  rows.push({ id: 'focus', time: '21:00', title: 'Фокус-сессия: конспект своими словами', icon: 'timer', tone: 'text-teal-soft', minutes: 25, to: '/plan' })
  return rows
}
