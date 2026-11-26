// Запуск кода ученика в отдельном потоке (Web Worker) с ограничением по времени,
// чтобы бесконечный цикл не подвесил страницу.

export interface RunResult { results?: unknown[]; error?: string; logs: string[]; ms: number[] }

const WORKER = `
self.onmessage = (e) => {
  const { code, fn, calls } = e.data
  const logs = []
  const fmt = (x) => typeof x === 'string' ? x : (() => { try { return JSON.stringify(x) } catch { return String(x) } })()
  const console = { log: (...a) => logs.push(a.map(fmt).join(' ')), error: (...a) => logs.push('ошибка: ' + a.map(fmt).join(' ')), warn: (...a) => logs.push(a.map(fmt).join(' ')) }
  try {
    const src = code.replace(/^\\s*export\\s+(default\\s+)?/gm, '')
    const f = new Function('console', src + '\\n;return typeof ' + fn + ' === "function" ? ' + fn + ' : undefined')(console)
    if (!f) throw new Error('не найдена функция ' + fn + ' — не переименовывай её')
    const results = [], ms = []
    for (const args of calls) { const t = performance.now(); results.push(f(...args)); ms.push(performance.now() - t) }
    postMessage({ results, logs, ms })
  } catch (err) {
    postMessage({ error: (err && err.message) || String(err), logs, ms: [] })
  }
}`

let url: string | null = null
export function runUserCode(code: string, fn: string, calls: unknown[][], timeoutMs = 8000): Promise<RunResult> {
  url ??= URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }))
  return new Promise((resolve) => {
    const w = new Worker(url!)
    const timer = setTimeout(() => { w.terminate(); resolve({ error: `время вышло (${timeoutMs / 1000} с): похоже на бесконечный цикл`, logs: [], ms: [] }) }, timeoutMs)
    w.onmessage = (e) => { clearTimeout(timer); w.terminate(); resolve(e.data as RunResult) }
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); resolve({ error: e.message || 'синтаксическая ошибка в коде', logs: [], ms: [] }) }
    w.postMessage({ code, fn, calls })
  })
}
