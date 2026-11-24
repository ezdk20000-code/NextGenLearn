import { buildCourseTrack } from '../course-builder'
import type { CsLabSpec, CsModule } from '../cs0/types'
import { M1 } from './m1'
import { M2 } from './m2'
import { M3 } from './m3'

/** Написанные модули CS1. Остальные модули программы добавляются по мере готовности. */
export const CS1_MODULES: CsModule[] = [M1, M2, M3]

export const CS1_LABS: CsLabSpec[] = [
  { id: 'cs1-p1', node: 'cs1-mux', icon: 'developer_board', title: 'Проект 1: 15 элементарных чипов', desc: 'Опиши на HDL чипы от Not до DMux8Way, используя только Nand и уже собранные чипы. Каждый проходит автотесты.', skills: ['HDL', 'Mux/DMux', 'шины'], minutes: 180, primitive: 'HDL-песочница' },
  { id: 'cs1-p2', node: 'cs1-alu', icon: 'calculate', title: 'Проект 2: сумматоры и АЛУ', desc: 'HalfAdder, FullAdder, Add16, Inc16 и АЛУ Hack с 18 функциями и флагами.', skills: ['сумматоры', 'АЛУ', 'флаги'], minutes: 150, primitive: 'HDL-песочница' },
  { id: 'cs1-p3', node: 'cs1-pc', icon: 'memory_alt', title: 'Проект 3: от бита до RAM16K', desc: 'Bit, Register, RAM8 … RAM16K и счётчик команд PC — вся память компьютера Hack.', skills: ['DFF', 'регистры', 'RAM', 'PC'], minutes: 150, primitive: 'HDL-песочница' },
]

export const CS1_TRACK = buildCourseTrack({
  id: 'cs1-nand2tetris',
  title: 'CS1 · Строим компьютер с нуля',
  subtitle: 'От вентиля NAND до компьютера Hack',
  description: 'Второй шаг программы: по книге Нисана и Шокена собираешь компьютер Hack на языке HDL — от Nand до памяти и процессора, а затем пишешь для него ассемблер, виртуальную машину и компилятор.',
  category: 'CS и сети', level: 'Продвинутый', weeks: 12, hours: 120,
  formats: ['Симуляции', 'Флеш-спринты'], tags: ['HDL', 'Nand2Tetris', 'компьютер Hack'], outcomes: [],
  cover: { from: '#312E81', to: '#0F766E', icon: 'developer_board', image: 'covers/cs-program.webp' },
}, CS1_MODULES, CS1_LABS)
