// Научные инструменты: точные вычисления, которые ИИ-наставник вызывает,
// вместо того чтобы считать «в уме». Чистые функции без зависимостей —
// одинаково работают в браузере (через page-tools) и на сервере (через tool use).
//
// Внешняя научная модель (Wolfram, SymPy-сервис, своя модель) подключается
// так же: описание + JSON-схема + execute(), который ходит в её HTTP API.

export interface SciTool {
  name: string
  /** Что делает, что возвращает, когда вызывать — это всё, что видит модель. */
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean }
  /** Для какого предмета инструмент (показывается в настройках). */
  domain: string
  execute(input: Record<string, unknown>): unknown | Promise<unknown>
}

// ---------------------------------------------------------------------------
// IPv4: подсети
// ---------------------------------------------------------------------------

function parseIp(s: string): number {
  const parts = s.trim().split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) throw new Error(`Некорректный IPv4-адрес: ${s}`)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}
const ipStr = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')

export function subnetInfo(cidr: string) {
  const [ip, p] = cidr.split('/')
  const prefix = Number(p)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`Некорректная длина префикса в «${cidr}»`)
  const addr = parseIp(ip)
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = (addr & mask) >>> 0
  const size = 2 ** (32 - prefix)
  const broadcast = (network + size - 1) >>> 0
  const usable = prefix >= 31 ? (prefix === 31 ? 2 : 1) : size - 2
  return {
    cidr: `${ipStr(network)}/${prefix}`,
    mask: ipStr(mask),
    network: ipStr(network),
    broadcast: ipStr(broadcast),
    firstHost: prefix >= 31 ? ipStr(network) : ipStr(network + 1),
    lastHost: prefix >= 31 ? ipStr(broadcast) : ipStr(broadcast - 1),
    usableHosts: usable,
    isPrivate: [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16]].some(([n, pl]) => {
      const m = (0xffffffff << (32 - (pl as number))) >>> 0
      return ((addr & m) >>> 0) === parseIp(n as string)
    }),
  }
}

// ---------------------------------------------------------------------------
// Безопасный калькулятор выражений (без eval): + - * / ^ ( ), sqrt, log, ln, pow, abs
// ---------------------------------------------------------------------------

export function evaluate(expr: string): number {
  const src = expr.replace(/\s+/g, '').replace(/,/g, '.')
  let i = 0
  const peek = () => src[i]
  const fail = (m: string): never => { throw new Error(`${m} (позиция ${i} в «${expr}»)`) }
  const FUN: Record<string, (...a: number[]) => number> = {
    sqrt: Math.sqrt, ln: Math.log, log: (x, b = 10) => Math.log(x) / Math.log(b), log2: Math.log2,
    abs: Math.abs, pow: Math.pow, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, min: Math.min, max: Math.max,
  }
  const CONST: Record<string, number> = { pi: Math.PI, e: Math.E }
  function primary(): number {
    if (peek() === '(') { i++; const v = sum(); if (peek() !== ')') fail('Ожидалась «)»'); i++; return v }
    if (peek() === '-') { i++; return -primary() }
    if (peek() === '+') { i++; return primary() }
    const num = /^\d+(\.\d+)?([eE][-+]?\d+)?/.exec(src.slice(i))
    if (num) { i += num[0].length; return Number(num[0]) }
    const id = /^[a-z][a-z0-9]*/i.exec(src.slice(i))
    if (id) {
      const name = id[0].toLowerCase(); i += id[0].length
      if (name in CONST) return CONST[name]
      if (!(name in FUN)) fail(`Неизвестная функция ${name}`)
      if (peek() !== '(') fail('Ожидалась «(» после имени функции')
      i++
      const args = [sum()]
      while (peek() === ';' || peek() === '|') { i++; args.push(sum()) }
      if (peek() !== ')') fail('Ожидалась «)»'); i++
      return FUN[name](...args)
    }
    return fail('Неожиданный символ')
  }
  function power(): number { const b = primary(); if (peek() === '^') { i++; return Math.pow(b, power()) } return b }
  function product(): number {
    let v = power()
    while (peek() === '*' || peek() === '/') { const op = src[i++]; const r = power(); v = op === '*' ? v * r : v / r }
    return v
  }
  function sum(): number {
    let v = product()
    while (peek() === '+' || peek() === '-') { const op = src[i++]; const r = product(); v = op === '+' ? v + r : v - r }
    return v
  }
  const v = sum()
  if (i < src.length) fail('Лишние символы')
  if (!Number.isFinite(v)) throw new Error('Результат не является конечным числом')
  return v
}

// ---------------------------------------------------------------------------
// Кривая забывания FSRS-6: вероятность вспомнить через t дней при стабильности S
// ---------------------------------------------------------------------------

const DECAY = -0.1542
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1
export const recallProbability = (days: number, stability: number) => Math.pow(1 + (FACTOR * days) / stability, DECAY)

// ---------------------------------------------------------------------------
// Реестр
// ---------------------------------------------------------------------------

export const SCI_TOOLS: SciTool[] = [
  {
    name: 'ipv4_subnet',
    domain: 'Компьютерные сети',
    description: 'Точно рассчитывает параметры IPv4-подсети по записи CIDR (например «192.168.1.0/26»): маска, адрес сети, broadcast, первый и последний адрес устройства, число адресов для устройств, частная ли сеть. Используй вместо подсчёта в уме.',
    inputSchema: { type: 'object', properties: { cidr: { type: 'string', description: 'Адрес и префикс, например 10.0.5.17/22' } }, required: ['cidr'], additionalProperties: false },
    execute: (input) => subnetInfo(String(input.cidr ?? '')),
  },
  {
    name: 'calculate',
    domain: 'Математика',
    description: 'Вычисляет арифметическое выражение точно: + - * / ^, скобки, sqrt, ln, log(x;основание), log2, pow(a;b), abs, exp, sin/cos/tan, pi, e. Аргументы функций разделяются «;». Возвращает число. Используй для любых вычислений в ответе.',
    inputSchema: { type: 'object', properties: { expression: { type: 'string', description: 'Например 2^(32-26)-2 или log(1024;2)' } }, required: ['expression'], additionalProperties: false },
    execute: (input) => ({ expression: String(input.expression), result: evaluate(String(input.expression ?? '')) }),
  },
  {
    name: 'memory_forecast',
    domain: 'Наука о памяти',
    description: 'Модель памяти FSRS-6: вероятность вспомнить материал через заданное число дней при известной стабильности памяти (в днях). Возвращает вероятность в процентах. Полезно, чтобы объяснить ученику, когда стоит повторять.',
    inputSchema: { type: 'object', properties: { days: { type: 'number' }, stability: { type: 'number', description: 'Стабильность памяти S, дни (>0)' } }, required: ['days', 'stability'], additionalProperties: false },
    execute: (input) => {
      const days = Number(input.days), s = Number(input.stability)
      if (!(s > 0) || !(days >= 0)) throw new Error('Нужны days ≥ 0 и stability > 0')
      return { days, stability: s, recallPercent: Math.round(recallProbability(days, s) * 1000) / 10 }
    },
  },
]
