import { readFileSync, existsSync } from 'node:fs'
import { SCI_TOOLS, type SciTool } from '../../shared/sci-tools.js'
import { ClaudeProvider } from './providers/claude.js'
import { HttpModelProvider, type HttpModelConfig } from './providers/http-model.js'
import type { ModelProvider } from './providers/types.js'

/** Задачи наставника. Для каждой можно выбрать свою модель — у каждого ученика. */
export type AiTask = 'mentor' | 'grade' | 'cards'
export const AI_TASKS: AiTask[] = ['mentor', 'grade', 'cards']

export const DEFAULT_MODEL = process.env.NGL_CLAUDE_MODEL ?? 'claude-opus-5-5'

export interface Registry {
  providers: Map<string, ModelProvider>
  /** Встроенные инструменты + научные модели, подключённые по HTTP */
  tools(enabled?: string[]): SciTool[]
}

export function createRegistry(opts: { modelsFile?: string; extra?: ModelProvider[] } = {}): Registry {
  const providers = new Map<string, ModelProvider>()
  const claude = new ClaudeProvider('claude', 'Claude (Anthropic)', { model: DEFAULT_MODEL })
  providers.set(claude.id, claude)

  const file = opts.modelsFile ?? process.env.NGL_MODELS_FILE ?? 'models.json'
  if (existsSync(file)) {
    const cfg = JSON.parse(readFileSync(file, 'utf8')) as { scientific?: HttpModelConfig[] }
    for (const m of cfg.scientific ?? []) providers.set(m.id, new HttpModelProvider(m))
  }
  for (const p of opts.extra ?? []) providers.set(p.id, p)

  return {
    providers,
    tools(enabled) {
      const external = [...providers.values()].filter((p) => p.kind === 'scientific' && p.ready() && p.asTool).map((p) => p.asTool!())
      const all = [...SCI_TOOLS, ...external]
      return enabled ? all.filter((t) => enabled.includes(t.name)) : all
    },
  }
}
