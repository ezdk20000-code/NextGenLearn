import { useStore } from '../store'
import { nodeById, trackById } from '../data'

export interface PlanRow { id: string; time: string; title: string; icon: string; tone: string; minutes: number; to: string }

/** План дня: повторение → новый урок → практика → фокус-блок, в пределах дневного времени. */
export function usePlan(): PlanRow[] {
  const s = useStore()
  const rows: PlanRow[] = []
  const budget = s.prefs.dailyMinutes
  const due = s.dueCards().length
  const reviewMin = Math.max(3, Math.round(due * 0.4))
  rows.push({ id: 'review', time: '08:30', title: due ? `Повторить ${due} карточек` : 'Повторение (всё сделано)', icon: 'style', tone: 'text-amber-soft', minutes: reviewMin, to: '/review' })
  let used = reviewMin
  const next = s.nextNode ? nodeById(s.nextNode) : undefined
  if (next && used + next.minutes <= budget + 5) {
    rows.push({ id: 'lesson-' + next.id, time: '12:00', title: `Урок: ${next.title}`, icon: 'menu_book', tone: 'text-violet-soft', minutes: next.minutes, to: `/lesson/${next.id}` })
    used += next.minutes
  }
  const track = trackById(s.activeTrack)
  const lab = track?.labs.find((l) => !s.labsDone.includes(l.id) && s.status(l.nodeId) !== 'locked')
  if (lab && used + lab.minutes <= budget + 5) {
    rows.push({ id: 'lab-' + lab.id, time: '18:30', title: `Лаборатория: ${lab.title}`, icon: 'science', tone: 'text-teal-soft', minutes: lab.minutes, to: `/lab/${lab.id}` })
    used += lab.minutes
  }
  const rest = Math.max(10, Math.min(50, budget - used))
  rows.push({ id: 'focus', time: '21:00', title: 'Deep Study: конспект своими словами', icon: 'center_focus_strong', tone: 'text-teal-soft', minutes: rest >= 25 ? 25 : rest, to: '/deep' })
  return rows
}
