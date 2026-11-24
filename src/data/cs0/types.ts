import type { LessonBlock } from '../types'

/** Урок курса программы CS в компактной записи; из него строятся узел дерева, урок и карточки. */
export interface CsLesson {
  id: string
  title: string
  /** Подпись узла на карте — коротко */
  node: string
  short: string
  minutes: number
  xp: number
  lab?: string
  exam?: boolean
  covers: string[]
  sources: string[]
  blocks: LessonBlock[]
  cards: [string, string][]
}

export interface CsModule { id: string; label: string; lessons: CsLesson[] }

export interface CsLabSpec { id: string; node: string; icon: string; title: string; desc: string; skills: string[]; minutes: number; primitive: 'Симулятор схем' | 'Эмулятор процессора' | 'Конструктор' | 'Ползунки и визуализация' | 'HDL-песочница' }
