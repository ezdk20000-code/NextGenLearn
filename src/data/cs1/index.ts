import { buildCourseTrack } from '../course-builder'
import type { CsLabSpec, CsModule } from '../cs0/types'
import { M1 } from './m1'
import { M2 } from './m2'
import { M3 } from './m3'
import { M4 } from './m4'
import { M5 } from './m5'
import { M6, M7, M8 } from './m6-8'
import { M9, M10, M11, M12 } from './m9-12'

/** Написанные модули CS1. Остальные модули программы добавляются по мере готовности. */
export const CS1_MODULES: CsModule[] = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12]

export const CS1_LABS: CsLabSpec[] = [
  { id: 'cs1-p1', node: 'cs1-mux', icon: 'developer_board', title: 'Проект 1: 15 элементарных чипов', desc: 'Опиши на HDL чипы от Not до DMux8Way, используя только Nand и уже собранные чипы. Каждый проходит автотесты.', skills: ['HDL', 'Mux/DMux', 'шины'], minutes: 180, primitive: 'HDL-песочница' },
  { id: 'cs1-p2', node: 'cs1-alu', icon: 'calculate', title: 'Проект 2: сумматоры и АЛУ', desc: 'HalfAdder, FullAdder, Add16, Inc16 и АЛУ Hack с 18 функциями и флагами.', skills: ['сумматоры', 'АЛУ', 'флаги'], minutes: 150, primitive: 'HDL-песочница' },
  { id: 'cs1-p4', node: 'cs1-io', icon: 'terminal', title: 'Проект 4: Mult и Fill', desc: 'Программы на ассемблере Hack в эмуляторе: умножение циклом и заливка экрана по клавиатуре. Пошаговое выполнение, ROM, регистры, декодер, экран.', skills: ['ассемблер Hack', 'циклы', 'ввод-вывод'], minutes: 120, primitive: 'Эмулятор процессора' },
  { id: 'cs1-p5', node: 'cs1-computer', icon: 'developer_board', title: 'Проект 5: CPU и Computer', desc: 'Memory, процессор Hack и весь компьютер на HDL. Тест загружает программы в ROM и проверяет память после выполнения.', skills: ['CPU', 'декодирование', 'компьютер'], minutes: 240, primitive: 'HDL-песочница' },
  { id: 'cs1-p6', node: 'cs1-asm-symbols', icon: 'code', title: 'Проект 6: свой ассемблер', desc: 'Ассемблер Hack на JavaScript: без символов, с метками и переменными, большая программа. Вывод сравнивается с эталоном построчно.', skills: ['разбор', 'таблица символов', 'два прохода'], minutes: 240, primitive: 'Песочница кода' },
  { id: 'cs1-vm', node: 'cs1-vm-idea', icon: 'stacks', title: 'Стековая машина вживую', desc: 'Выполняй ВМ-код по шагам и наблюдай стек, сегменты и кадры вызовов функций.', skills: ['стек', 'сегменты', 'кадры'], minutes: 25, primitive: 'Пошаговый симулятор' },
  { id: 'cs1-p7', node: 'cs1-vm-translator', icon: 'swap_vert', title: 'Проект 7: транслятор ВМ, часть 1', desc: 'push/pop, арифметика и сегменты в ассемблер Hack. Вывод выполняется на эмуляторе и сравнивается с эталонной ВМ.', skills: ['трансляция', 'стек', 'сегменты'], minutes: 240, primitive: 'Песочница кода' },
  { id: 'cs1-p8', node: 'cs1-vm-frames', icon: 'call_split', title: 'Проект 8: транслятор ВМ, часть 2', desc: 'label/goto/if-goto, function/call/return и загрузочный код. Рекурсия и несколько файлов.', skills: ['ветвления', 'кадры', 'bootstrap'], minutes: 300, primitive: 'Песочница кода' },
  { id: 'cs1-p9', node: 'cs1-jack-apps', icon: 'sports_esports', title: 'Проект 9: своя программа на Jack', desc: 'Jack-среда: редактор классов, компиляция и запуск на ВМ с экраном и клавиатурой.', skills: ['Jack', 'объекты', 'игровой цикл'], minutes: 240, primitive: 'Песочница кода' },
  { id: 'cs1-p10', node: 'cs1-parser', icon: 'account_tree', title: 'Проект 10: анализатор Jack', desc: 'Токенизатор и синтаксический анализатор рекурсивным спуском с выводом XML.', skills: ['лексер', 'грамматика', 'рекурсивный спуск'], minutes: 300, primitive: 'Песочница кода' },
  { id: 'cs1-p11', node: 'cs1-codegen-arrays', icon: 'build', title: 'Проект 11: компилятор Jack', desc: 'Генерация ВМ-кода; программы выполняются со встроенной ОС и сравниваются с эталонным компилятором.', skills: ['таблицы символов', 'генерация кода'], minutes: 360, primitive: 'Песочница кода' },
  { id: 'cs1-p12', node: 'cs1-os-sys', icon: 'settings_suggest', title: 'Проект 12: ОС Jack', desc: 'Math, String, Memory и Screen на Jack. Тестовые программы сравнивают твою ОС со встроенной.', skills: ['алгоритмы ОС', 'куча', 'графика'], minutes: 360, primitive: 'Песочница кода' },
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
