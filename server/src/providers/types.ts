import type { SciTool } from '../../../shared/sci-tools.js'
import type { ChatTurn } from '../../../shared/tutor.js'

/** Что умеет поставщик. Научные модели обычно только 'tool'. */
export type Capability = 'chat' | 'json' | 'tool'
export type Effort = 'low' | 'medium' | 'high'

export interface ChatRequest {
  system: string
  messages: ChatTurn[]
  effort?: Effort
  tools?: SciTool[]
  signal?: AbortSignal
  onText?: (delta: string) => void
  /** Сообщение о вызове инструмента — для индикатора «считаю подсеть…» */
  onTool?: (name: string) => void
}

export interface ChatResult { text: string; refused: boolean; truncated: boolean; model: string }

export interface JsonRequest {
  prompt: string
  /** JSON Schema ответа */
  schema: Record<string, unknown>
  effort?: Effort
  signal?: AbortSignal
}

/**
 * Поставщик модели. Claude — основной; сюда же подключаются другие LLM
 * и научные модели (через HTTP-адаптер), не меняя остальной код.
 */
export interface ModelProvider {
  id: string
  label: string
  kind: 'llm' | 'scientific'
  capabilities: Capability[]
  /** Готов ли к работе (есть ключ, доступен адрес) */
  ready(): boolean
  chat?(req: ChatRequest): Promise<ChatResult>
  json?(req: JsonRequest): Promise<unknown>
  /** Научная модель, выставленная наставнику как инструмент */
  asTool?(): SciTool
}

export class ProviderError extends Error {
  constructor(public code: 'not_configured' | 'refused' | 'rate_limited' | 'upstream' | 'bad_request', message: string) { super(message) }
}
