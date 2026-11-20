import Anthropic from '@anthropic-ai/sdk'
import type { SciTool } from '../../../shared/sci-tools.js'
import { ProviderError, type ChatRequest, type ChatResult, type JsonRequest, type ModelProvider } from './types.js'

const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const MAX_TOOL_ROUNDS = 6

/**
 * Claude через Anthropic SDK. Модель по умолчанию — claude-opus-5-5.
 * Отказ по политике безопасности автоматически переадресуется на запасную
 * модель (fallbacks: "default"); если отказали все — возвращаем refused.
 */
export class ClaudeProvider implements ModelProvider {
  kind = 'llm' as const
  capabilities = ['chat', 'json'] as ('chat' | 'json')[]
  private client: Anthropic | null = null

  constructor(
    public id: string,
    public label: string,
    private opts: { model: string; apiKey?: string },
  ) {}

  ready() {
    return Boolean(this.opts.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  }

  private api() {
    if (!this.ready()) throw new ProviderError('not_configured', 'Claude не настроен: задайте ANTHROPIC_API_KEY на сервере')
    this.client ??= this.opts.apiKey ? new Anthropic({ apiKey: this.opts.apiKey }) : new Anthropic()
    return this.client
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const client = this.api()
    const tools: Anthropic.Beta.BetaTool[] = (req.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
      strict: true,
    }))
    const byName = new Map<string, SciTool>((req.tools ?? []).map((t) => [t.name, t]))
    const messages: Anthropic.Beta.BetaMessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }))
    let text = ''

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const stream = client.beta.messages.stream({
          model: this.opts.model,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          output_config: { effort: req.effort ?? 'medium' },
          messages,
          ...(tools.length ? { tools } : {}),
        }, { signal: req.signal })

        stream.on('text', (delta) => { text += delta; req.onText?.(delta) })
        const msg = await stream.finalMessage()

        if (msg.stop_reason === 'refusal') return { text, refused: true, truncated: false, model: msg.model }
        if (msg.stop_reason !== 'tool_use') {
          return { text, refused: false, truncated: msg.stop_reason === 'max_tokens', model: msg.model }
        }

        // Выполняем научные инструменты и возвращаем все результаты одним сообщением
        messages.push({ role: 'assistant', content: msg.content })
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
        for (const block of msg.content) {
          if (block.type !== 'tool_use') continue
          req.onTool?.(block.name)
          const tool = byName.get(block.name)
          try {
            if (!tool) throw new Error(`Неизвестный инструмент ${block.name}`)
            const out = await tool.execute(block.input as Record<string, unknown>)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
          } catch (e) {
            results.push({ type: 'tool_result', tool_use_id: block.id, content: e instanceof Error ? e.message : String(e), is_error: true })
          }
        }
        messages.push({ role: 'user', content: results })
        if (text && !text.endsWith('\n')) { text += '\n\n'; req.onText?.('\n\n') }
      }
      return { text, refused: false, truncated: true, model: this.opts.model }
    } catch (e) {
      throw mapError(e)
    }
  }

  async json(req: JsonRequest): Promise<unknown> {
    const client = this.api()
    try {
      const msg = await client.beta.messages.create({
        model: this.opts.model,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        output_config: { effort: req.effort ?? 'low', format: { type: 'json_schema', schema: req.schema } },
        messages: [{ role: 'user', content: req.prompt }],
      }, { signal: req.signal })
      if (msg.stop_reason === 'refusal') throw new ProviderError('refused', 'Модель отказалась отвечать на этот запрос')
      const block = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      if (!block) throw new ProviderError('upstream', 'Пустой ответ модели')
      return JSON.parse(block.text)
    } catch (e) {
      throw mapError(e)
    }
  }
}

function mapError(e: unknown): Error {
  if (e instanceof ProviderError) return e
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('rate_limited', 'Слишком много запросов к Claude — попробуйте через минуту')
  if (e instanceof Anthropic.AuthenticationError) return new ProviderError('not_configured', 'Неверный ключ Anthropic API')
  if (e instanceof Anthropic.BadRequestError) return new ProviderError('bad_request', e.message)
  if (e instanceof Anthropic.APIError) return new ProviderError('upstream', `Claude API: ${e.status ?? ''} ${e.message}`)
  return e instanceof Error ? e : new Error(String(e))
}
