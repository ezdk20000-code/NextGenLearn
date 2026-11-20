import { buildApp } from './app.js'
import { memoryStore } from './profiles.js'
import { createRegistry, DEFAULT_MODEL } from './registry.js'

const registry = createRegistry()
const app = buildApp({ registry, profiles: memoryStore() })
const port = Number(process.env.PORT ?? 8787)

app.listen({ port, host: '0.0.0.0' }).then(() => {
  const claude = registry.providers.get('claude')!
  console.log(`NGL AI server: http://localhost:${port}`)
  console.log(`Claude: ${claude.ready() ? `готов (${DEFAULT_MODEL})` : 'нет ключа — задайте ANTHROPIC_API_KEY'}`)
  const sci = [...registry.providers.values()].filter((p) => p.kind === 'scientific')
  if (sci.length) console.log(`Научные модели: ${sci.map((p) => `${p.label}${p.ready() ? '' : ' (не настроена)'}`).join(', ')}`)
})
