// Общие типы контента. Любой трек — это данные этой формы;
// в рабочей версии их будет генерировать ИИ.

export type Tier = 0 | 1 | 2 | 3 | 4
export const TIER_NAMES = ['Корень', 'Основа', 'Ветвь', 'Крона', 'Вершина'] as const

export interface GraphNode {
  id: string
  title: string
  short: string
  tier: Tier
  x: number // позиция на карте, 0..1000
  y: number // 0..660
  requires: string[]
  minutes: number
  xp: number
  lab?: string
}

export type LessonBlock =
  | { type: 'text'; md: string }
  | { type: 'analogy'; title: string; md: string }
  | { type: 'widget'; widget: 'layers' }
  | { type: 'quiz'; q: string; options: string[]; correct: number; explain: string }
  | { type: 'order'; q: string; items: string[]; explain: string }
  | { type: 'feynman'; prompt: string; keywords: string[] }
  | { type: 'terms'; items: { term: string; def: string }[] }

export interface Lesson {
  nodeId: string
  title: string
  blocks: LessonBlock[]
  cardIds: string[]
}

export interface CardDef { id: string; nodeId: string | null; trackId: string; front: string; back: string; own?: boolean }

export interface LabDef {
  id: string
  nodeId: string
  icon: string
  title: string
  desc: string
  skills: string[]
  minutes: number
  primitive: 'Пошаговый симулятор' | 'Ползунки и визуализация' | 'Конструктор' | 'Диалог-сценарий'
}

export type Level = 'Фундамент' | 'Продвинутый' | 'Мастерство'
export type Format = 'Симуляции' | 'ИИ-спарринг' | 'Кейсы' | 'Флеш-спринты'

export interface Track {
  id: string
  title: string
  subtitle: string
  description: string
  category: string
  level: Level
  weeks: number
  hours: number
  formats: Format[]
  tags: string[]
  outcomes: string[]
  cover: { from: string; to: string; icon: string }
  playable: boolean
  isNew?: boolean
  nodes: GraphNode[]
  lessons: Record<string, Lesson>
  cards: CardDef[]
  labs: LabDef[]
  /** Программа для треков, которые ещё не собраны полностью */
  syllabus?: { title: string; items: string[] }[]
}

export const CATEGORIES = ['CS и сети', 'Переговоры', 'Языки', 'Мышление', 'Наука', 'Финансы', 'Право'] as const
