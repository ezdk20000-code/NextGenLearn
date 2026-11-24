import type { CardDef, GraphNode, LabDef, Lesson, Tier, Track } from '../types'
import type { CsLabSpec, CsModule } from './types'
import { M1 } from './m1'
import { M2 } from './m2'
import { M3 } from './m3'
import { M4 } from './m4'
import { M5 } from './m5'
import { M6 } from './m6'
import { M7 } from './m7'

export const CS0_MODULES: CsModule[] = [M1, M2, M3, M4, M5, M6, M7].filter((m) => m.lessons.length)

const LABS: CsLabSpec[] = [
  { id: 'cs0-morse', node: 'cs0-codes', icon: 'graphic_eq', title: 'Шифровальщик Морзе', desc: 'Закодируй и раскодируй слова, идя по двоичному дереву азбуки Морзе.', skills: ['двоичное дерево', '2ⁿ комбинаций'], minutes: 10, primitive: 'Конструктор' },
  { id: 'cs0-bytes', node: 'cs0-text', icon: 'translate', title: 'Байты текста', desc: 'Набери любой текст и посмотри его байты в ASCII, CP1251 и UTF-8 — и откуда берутся «кракозябры».', skills: ['ASCII', 'UTF-8', 'кодовые страницы'], minutes: 12, primitive: 'Ползунки и визуализация' },
  { id: 'cs0-bits', node: 'cs0-binary', icon: 'toggle_on', title: 'Битовая панель', desc: 'Набирай числа переключателями и читай их в двоичной, восьмеричной, десятичной и шестнадцатеричной записи.', skills: ['двоичная', 'hex', 'перевод'], minutes: 10, primitive: 'Конструктор' },
  { id: 'cs0-switches', node: 'cs0-circuits', icon: 'lightbulb', title: 'Цепь с выключателями', desc: 'Собери логические И и ИЛИ из последовательных и параллельных выключателей.', skills: ['И', 'ИЛИ', 'цепь'], minutes: 8, primitive: 'Симулятор схем' },
  { id: 'cs0-nand', node: 'cs0-nand-gate', icon: 'memory', title: 'Всё из NAND', desc: 'Построй NOT, AND, OR и XOR, имея только вентили И-НЕ.', skills: ['NAND', 'де Морган', 'универсальность'], minutes: 20, primitive: 'Симулятор схем' },
  { id: 'cs0-adder', node: 'cs0-adder-lesson', icon: 'add_circle', title: 'Сумматор своими руками', desc: 'Собери полусумматор, а затем полный сумматор из вентилей.', skills: ['полусумматор', 'полный сумматор', 'перенос'], minutes: 20, primitive: 'Симулятор схем' },
  { id: 'cs0-twos', node: 'cs0-negative', icon: 'exposure', title: 'Отрицательные числа', desc: 'Набирай числа в дополнительном коде и поймай переполнение.', skills: ['дополнительный код', 'переполнение'], minutes: 12, primitive: 'Конструктор' },
  { id: 'cs0-latch', node: 'cs0-latch-lesson', icon: 'lock_clock', title: 'Триггер запоминает', desc: 'Защёлка на двух ИЛИ-НЕ и D-триггер с тактом: увидишь, как схема «помнит» бит.', skills: ['обратная связь', 'RS', 'D-триггер'], minutes: 12, primitive: 'Симулятор схем' },
  { id: 'cs0-counter', node: 'cs0-clock', icon: 'timer', title: 'Счётчик и такты', desc: '4-битный счётчик по тактовому сигналу и его временная диаграмма.', skills: ['такт', 'делитель частоты', 'счётчик'], minutes: 10, primitive: 'Симулятор схем' },
  { id: 'cs0-ram', node: 'cs0-ram-lesson', icon: 'grid_view', title: 'Память на 8 ячеек', desc: 'Адресуемая память: дешифратор выбирает ячейку, ты пишешь и читаешь байты.', skills: ['адрес', 'дешифратор', 'чтение/запись'], minutes: 12, primitive: 'Симулятор схем' },
  { id: 'cs0-cpu', node: 'cs0-jumps', icon: 'terminal', title: 'Игрушечный процессор', desc: 'Напиши программы в машинных командах и выполни их по шагам: выборка — исполнение.', skills: ['счётчик команд', 'переходы', 'циклы'], minutes: 30, primitive: 'Эмулятор процессора' },
  { id: 'cs0-float', node: 'cs0-float-lesson', icon: 'functions', title: 'Устройство float', desc: 'Разбери число float32 на знак, порядок и мантиссу и пойми, почему 0,1 + 0,2 ≠ 0,3.', skills: ['IEEE 754', 'точность'], minutes: 12, primitive: 'Ползунки и визуализация' },
]

// Карта: модули — ряды снизу вверх, «змейкой», чтобы цепочка уроков читалась без пересечений.
const ROW = 108
const HEIGHT = 70 + ROW * (CS0_MODULES.length - 1) + 90
const XS = [190, 410, 630, 850]

const nodes: GraphNode[] = []
const lessons: Record<string, Lesson> = {}
const cards: CardDef[] = []
let prev: string | null = null
CS0_MODULES.forEach((m, mi) => {
  const y = HEIGHT - 70 - mi * ROW
  m.lessons.forEach((l, li) => {
    const x = mi % 2 === 0 ? XS[li] : XS[XS.length - 1 - li]
    const lab = LABS.find((b) => b.node === l.id)
    nodes.push({ id: l.id, title: l.node, short: l.short, tier: Math.min(mi, 4) as Tier, x, y, requires: prev ? [prev] : [], minutes: l.minutes, xp: l.xp, lab: lab?.id, group: m.label, exam: l.exam })
    const cardIds = l.cards.map((_, k) => `${l.id}-c${k + 1}`)
    l.cards.forEach(([front, back], k) => cards.push({ id: cardIds[k], nodeId: l.id, trackId: 'cs0-code', front, back }))
    lessons[l.id] = { nodeId: l.id, title: l.title, blocks: l.blocks, cardIds, covers: l.covers, sources: l.sources }
    prev = l.id
  })
})

const labs: LabDef[] = LABS.filter((b) => lessons[b.node]).map((b) => ({ id: b.id, nodeId: b.node, icon: b.icon, title: b.title, desc: b.desc, skills: b.skills, minutes: b.minutes, primitive: b.primitive }))

export const CS0_TRACK: Track = {
  id: 'cs0-code',
  title: 'CS0 · Как компьютер считает',
  subtitle: 'От лампочки и выключателя до процессора',
  description: 'Первый шаг программы Computer Science: коды и биты, системы счисления, логика, сумматор, память и процессор — с лабораториями, где ты собираешь схемы и пишешь машинные программы.',
  category: 'CS и сети',
  level: 'Фундамент',
  weeks: 4,
  hours: 30,
  formats: ['Симуляции', 'Флеш-спринты'],
  tags: ['биты', 'логика', 'процессор'],
  outcomes: [],
  cover: { from: '#312E81', to: '#0F766E', icon: 'memory', image: 'covers/cs-program.webp' },
  playable: true,
  hidden: true,
  nodes,
  lessons,
  cards,
  labs,
  map: { height: HEIGHT, rows: CS0_MODULES.map((m, mi) => ({ label: m.label, y: HEIGHT - 70 - mi * ROW })) },
}
