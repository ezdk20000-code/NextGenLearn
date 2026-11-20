// PlanFlow — учебный планировщик. Задача всегда про обучение:
// урок, лаборатория, повторение или своё учебное дело (прочитать, практика, конспект).

import type { Track } from '../data'

export type TaskStatus = 'todo' | 'doing' | 'check' | 'done'
export type Priority = 'crit' | 'high' | 'med' | 'low'
export type TaskKind = 'lesson' | 'lab' | 'review' | 'reading' | 'practice' | 'notes'

export interface Check { id: string; t: string; done: boolean }
export interface TaskComment { at: number; author: 'me' | 'mentor'; text: string; parked?: boolean }

export interface Task {
  id: string
  key: string // NET-3
  title: string
  desc: string
  kind: TaskKind
  trackId: string | null
  nodeId?: string
  labId?: string
  status: TaskStatus
  priority: Priority
  estimate: number // минут
  due: number | null
  slot: { date: string; start: string } | null // запланированный блок в календаре
  subtasks: Check[]
  criteria: Check[] // критерии усвоения
  comments: TaskComment[]
  focusMin: number
  createdAt: number
  doneAt?: number
}

export interface Sprint { n: number; start: number; days: number; goal: string }

export const STATUSES: { id: TaskStatus; label: string; hint: string; tone: string; dot: string }[] = [
  { id: 'todo', label: 'К выполнению', hint: 'запланировано', tone: 'text-mute bg-s3/30', dot: 'bg-dim' },
  { id: 'doing', label: 'В работе', hint: 'учусь сейчас', tone: 'text-violet-soft bg-violet/15', dot: 'bg-violet animate-pulse' },
  { id: 'check', label: 'Самопроверка', hint: 'отметь критерии усвоения', tone: 'text-amber-soft bg-amber/15', dot: 'bg-amber' },
  { id: 'done', label: 'Готово', hint: 'усвоено', tone: 'text-teal-soft bg-teal/15', dot: 'bg-teal' },
]
export const statusOf = (id: TaskStatus) => STATUSES.find((s) => s.id === id)!

export const PRIORITIES: { id: Priority; label: string; tone: string }[] = [
  { id: 'crit', label: 'Критично', tone: 'text-[#FB7185] bg-[#F43F5E]/15 border-[#F43F5E]/40' },
  { id: 'high', label: 'Высокий', tone: 'text-[#FDBA74] bg-[#FB923C]/12 border-[#FB923C]/35' },
  { id: 'med', label: 'Средний', tone: 'text-[#A5B4FC] bg-[#818CF8]/12 border-[#818CF8]/35' },
  { id: 'low', label: 'Низкий', tone: 'text-mute bg-s3/30 border-s3' },
]
export const priorityOf = (id: Priority) => PRIORITIES.find((p) => p.id === id)!
export const PRIORITY_ORDER: Record<Priority, number> = { crit: 0, high: 1, med: 2, low: 3 }

export const KINDS: Record<TaskKind, { label: string; icon: string }> = {
  lesson: { label: 'Урок', icon: 'menu_book' },
  lab: { label: 'Лаборатория', icon: 'science' },
  review: { label: 'Повторение', icon: 'style' },
  reading: { label: 'Чтение', icon: 'auto_stories' },
  practice: { label: 'Практика', icon: 'construction' },
  notes: { label: 'Конспект', icon: 'edit_note' },
}

export const TRACK_PREFIX: Record<string, string> = { networks: 'NET', negotiation: 'NEG' }
export const prefixOf = (trackId: string | null) => (trackId ? TRACK_PREFIX[trackId] ?? trackId.slice(0, 3).toUpperCase() : 'GEN')

const DAY = 86_400_000
let seq = 0
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`
export const check = (t: string, done = false): Check => ({ id: uid(), t, done })

export function dateKey(t: number) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const at = (dayOffset: number, hh: number, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hh, mm, 0, 0); return d.getTime() }

function base(p: Partial<Task> & Pick<Task, 'key' | 'title' | 'kind'>): Task {
  return {
    id: uid(), desc: '', trackId: null, status: 'todo', priority: 'med', estimate: 25, due: null, slot: null,
    subtasks: [], criteria: [], comments: [], focusMin: 0, createdAt: Date.now() - 5 * DAY, ...p,
  }
}

/** Демо-задачи учебного спринта по сетям. */
export function seedTasks(): { tasks: Task[]; sprint: Sprint; nextKey: Record<string, number> } {
  const today = dateKey(Date.now())
  const tomorrow = dateKey(Date.now() + DAY)
  const tasks: Task[] = [
    base({ key: 'NET-1', title: 'Урок: Что такое сеть', kind: 'lesson', trackId: 'networks', nodeId: 'what-is-network', status: 'done', priority: 'high', estimate: 10, doneAt: at(-4, 19), desc: 'Устройства, каналы связи и зачем им протоколы.' }),
    base({ key: 'NET-2', title: 'Урок: Биты, кадры, пакеты', kind: 'lesson', trackId: 'networks', nodeId: 'packets', status: 'done', priority: 'high', estimate: 12, doneAt: at(-2, 20), desc: 'Почему данные режут на кусочки и подписывают каждый.' }),
    base({
      key: 'NET-3', title: 'Урок: Модель TCP/IP', kind: 'lesson', trackId: 'networks', nodeId: 'layers', status: 'doing', priority: 'crit', estimate: 30,
      due: at(0, 18), slot: { date: today, start: '12:00' }, focusMin: 15,
      desc: 'Четыре слоя и инкапсуляция — фундамент всего трека. Без него не откроются IP-адреса, MAC и TCP.',
      subtasks: [check('Прочитать объяснение и аналогию с конвейером', true), check('Разобрать интерактивную схему слоёв', true), check('Пройти проверочные вопросы'), check('Объяснить инкапсуляцию своими словами')],
      criteria: [check('Назову 4 слоя модели сверху вниз'), check('Объясню, что такое инкапсуляция, без слова «инкапсуляция»'), check('Скажу, на каком слое работает роутер и почему')],
      comments: [{ at: at(0, 9, 15), author: 'mentor', text: 'Обрати внимание на роль роутера: он снимает канальный «конверт» и надевает новый. Это пригодится в лаборатории «Матрёшка пакета».' }],
    }),
    base({
      key: 'NET-4', title: 'Лаборатория: Матрёшка пакета', kind: 'lab', trackId: 'networks', labId: 'encap', nodeId: 'layers', priority: 'high', estimate: 15,
      due: at(1, 20), slot: { date: tomorrow, start: '18:30' },
      desc: 'Собрать пакет из заголовков и выяснить, что меняет роутер по пути.',
      subtasks: [check('Собрать кадр в правильном порядке'), check('Определить, какие поля меняет роутер')],
      criteria: [check('Объясню разницу между MAC и IP одной фразой')],
    }),
    base({ key: 'NET-5', title: 'Повторить карточки дня', kind: 'review', trackId: 'networks', priority: 'high', estimate: 5, due: at(0, 23, 59), slot: { date: today, start: '08:30' }, desc: 'FSRS отобрал карточки, которые ты вот-вот забудешь.' }),
    base({
      key: 'NET-6', title: 'Прочитать: «Как пакет находит дорогу» (статья)', kind: 'reading', trackId: 'networks', status: 'check', priority: 'low', estimate: 20, focusMin: 20,
      desc: 'Популярная статья о маршрутизации. Задача — понять идею, а не запомнить детали.',
      subtasks: [check('Прочитать статью', true), check('Выписать 3 новых термина', true)],
      criteria: [check('Могу объяснить, что такое таблица маршрутизации', true), check('Понимаю, почему пакеты одного файла могут идти разными путями')],
    }),
    base({
      key: 'NET-7', title: 'Практика: нарисовать схему своей домашней сети', kind: 'practice', trackId: 'networks', priority: 'med', estimate: 25, due: at(3, 21),
      desc: 'Роутер, устройства, их IP-адреса. Посмотреть адреса можно в настройках Wi-Fi на телефоне и ноутбуке.',
      subtasks: [check('Найти IP-адрес роутера'), check('Выписать IP своих устройств'), check('Нарисовать схему от руки или в любом редакторе')],
      criteria: [check('Понимаю, какие адреса у меня частные, а какой публичный')],
    }),
    base({
      key: 'NET-8', title: 'Конспект: сети за одну страницу', kind: 'notes', trackId: 'networks', priority: 'low', estimate: 20, slot: { date: today, start: '21:00' },
      desc: 'Сжать всё пройденное в одну страницу своими словами. Это лучшая проверка понимания.',
      subtasks: [check('Набросать структуру'), check('Написать текст'), check('Сравнить с уроками и поправить ошибки')],
      criteria: [check('Друг-школьник поймёт мой конспект')],
    }),
  ]
  return {
    tasks,
    sprint: { n: 2, start: at(-3, 0), days: 7, goal: 'Освоить слои TCP/IP и пройти первую лабораторию' },
    nextKey: { NET: 9, NEG: 1, GEN: 1 },
  }
}

/** Задачи из трека: ближайшие уроки и лаборатория (без дублей). */
export function tasksFromTrack(track: Track, existing: Task[], nextNum: number, isOpen: (nodeId: string) => boolean, done: (nodeId: string) => boolean): Task[] {
  const prefix = prefixOf(track.id)
  const out: Task[] = []
  let n = nextNum
  const has = (pred: (t: Task) => boolean) => existing.some(pred) || out.some(pred)
  for (const node of track.nodes) {
    if (out.filter((t) => t.kind === 'lesson').length >= 2) break
    if (!isOpen(node.id) || done(node.id) || has((t) => t.kind === 'lesson' && t.nodeId === node.id)) continue
    out.push(base({
      key: `${prefix}-${n++}`, title: `Урок: ${node.title}`, kind: 'lesson', trackId: track.id, nodeId: node.id, priority: out.length ? 'med' : 'high',
      estimate: node.minutes, desc: node.short, createdAt: Date.now(), due: Date.now() + (out.length + 1) * DAY,
      subtasks: [check('Прочитать объяснение'), check('Пройти проверки'), check('Объяснить своими словами')],
      criteria: [check(`Могу объяснить «${node.title}» за минуту`)],
    }))
  }
  const lab = track.labs.find((l) => !has((t) => t.labId === l.id))
  if (lab) out.push(base({
    key: `${prefix}-${n++}`, title: `Лаборатория: ${lab.title}`, kind: 'lab', trackId: track.id, labId: lab.id, nodeId: lab.nodeId, priority: 'med',
    estimate: lab.minutes, desc: lab.desc, createdAt: Date.now(), due: Date.now() + 3 * DAY,
    criteria: [check('Прошёл лабораторию и понимаю каждый свой ход')],
  }))
  return out
}
