import type { SciTool } from '../../../shared/sci-tools.js'
import { ProviderError, type ModelProvider } from './types.js'

/**
 * Адаптер для внешней научной модели по HTTP: Wolfram, SymPy-сервис,
 * химический или биологический предиктор, собственная модель.
 *
 * Контракт простой: POST {url} с JSON-телом = входом инструмента,
 * ответ — JSON. Модель становится инструментом наставника: Claude сам
 * решает, когда к ней обратиться, и объясняет результат ученику.
 *
 * Пример конфигурации — server/models.example.json.
 */
export interface HttpModelConfig {
  id: string
  label: string
  domain: string
  url: string
  /** Имя переменной окружения с токеном (сам токен в конфиг не пишем) */
  tokenEnv?: string
  description: string
  inputSchema: SciTool['inputSchema']
  timeoutMs?: number
}

export class HttpModelProvider implements ModelProvider {
  kind = 'scientific' as const
  capabilities = ['tool'] as 'tool'[]
  id: string
  label: string

  constructor(private cfg: HttpModelConfig, private fetchImpl: typeof fetch = fetch) {
    this.id = cfg.id
    this.label = cfg.label
  }

  ready() {
    return Boolean(this.cfg.url) && (!this.cfg.tokenEnv || Boolean(process.env[this.cfg.tokenEnv]))
  }

  asTool(): SciTool {
    return {
      name: this.cfg.id.replace(/[^A-Za-z0-9_-]/g, '_'),
      description: this.cfg.description,
      inputSchema: this.cfg.inputSchema,
      domain: this.cfg.domain,
      execute: async (input) => {
        if (!this.ready()) throw new ProviderError('not_configured', `${this.cfg.label} не настроена`)
        const headers: Record<string, string> = { 'content-type': 'application/json' }
        if (this.cfg.tokenEnv) headers.authorization = `Bearer ${process.env[this.cfg.tokenEnv]}`
        const res = await this.fetchImpl(this.cfg.url, {
          method: 'POST', headers, body: JSON.stringify(input),
          signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000),
        })
        if (!res.ok) throw new Error(`${this.cfg.label}: HTTP ${res.status}`)
        return res.json()
      },
    }
  }
}
