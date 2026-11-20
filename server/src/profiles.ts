import type { MentorStyle } from '../../shared/tutor.js'
import type { AiTask } from './registry.js'

/**
 * Личная ИИ-интеграция ученика: какой моделью решать какую задачу,
 * какие научные инструменты разрешены, стиль наставника и его память
 * об ученике. Хранится по ученику (в рабочей версии — таблицы ai_profiles
 * и ai_memory в PostgreSQL, см. db/schema.sql).
 */
export interface AiProfile {
  userId: string
  style: MentorStyle
  routing: Record<AiTask, string> // задача -> id поставщика
  effort: Record<AiTask, 'low' | 'medium' | 'high'>
  tools: string[] | null // null = все доступные
  memory: string[]
}

export function defaultProfile(userId: string): AiProfile {
  return {
    userId,
    style: 'socratic',
    routing: { mentor: 'claude', grade: 'claude', cards: 'claude' },
    effort: { mentor: 'medium', grade: 'low', cards: 'low' },
    tools: null,
    memory: [],
  }
}

export interface ProfileStore {
  get(userId: string): Promise<AiProfile>
  update(userId: string, patch: Partial<Omit<AiProfile, 'userId'>>): Promise<AiProfile>
  remember(userId: string, fact: string): Promise<void>
}

/** Хранилище в памяти процесса — для разработки и тестов. */
export function memoryStore(): ProfileStore {
  const map = new Map<string, AiProfile>()
  const get = async (id: string) => map.get(id) ?? defaultProfile(id)
  return {
    get,
    async update(id, patch) {
      const next = { ...(await get(id)), ...patch, userId: id }
      map.set(id, next)
      return next
    },
    async remember(id, fact) {
      const p = await get(id)
      const f = fact.trim()
      if (!f || p.memory.includes(f)) return
      map.set(id, { ...p, memory: [...p.memory, f].slice(-30) })
    },
  }
}
