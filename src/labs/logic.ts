// Движок логических схем: схема — это список вентилей, каждый берёт
// сигналы со входов схемы или с выходов вентилей, стоящих раньше.
// Так схема всегда без петель и считается за один проход.

export type GateType = 'NAND' | 'AND' | 'OR' | 'NOT' | 'XOR' | 'NOR'
export interface Gate { id: string; type: GateType; a: string; b: string }
export type Bit = 0 | 1

export const GATE_INFO: Record<GateType, { label: string; arity: 1 | 2; fn: (a: Bit, b: Bit) => Bit; ru: string }> = {
  NAND: { label: 'NAND', arity: 2, fn: (a, b) => (a & b ? 0 : 1), ru: 'И-НЕ' },
  AND: { label: 'AND', arity: 2, fn: (a, b) => (a & b) as Bit, ru: 'И' },
  OR: { label: 'OR', arity: 2, fn: (a, b) => (a | b) as Bit, ru: 'ИЛИ' },
  NOT: { label: 'NOT', arity: 1, fn: (a) => (a ? 0 : 1), ru: 'НЕ' },
  XOR: { label: 'XOR', arity: 2, fn: (a, b) => (a ^ b) as Bit, ru: 'Искл. ИЛИ' },
  NOR: { label: 'NOR', arity: 2, fn: (a, b) => (a | b ? 0 : 1), ru: 'ИЛИ-НЕ' },
}

/** Значения всех сигналов при заданных входах. */
export function evaluate(inputs: Record<string, Bit>, gates: Gate[]): Record<string, Bit> {
  const v: Record<string, Bit> = { ...inputs, '0': 0, '1': 1 }
  for (const g of gates) {
    const info = GATE_INFO[g.type]
    v[g.id] = info.fn(v[g.a] ?? 0, info.arity === 1 ? 0 : v[g.b] ?? 0)
  }
  return v
}

/** Все комбинации входов: [0,0], [0,1], [1,0], [1,1] … (первый вход — старший бит). */
export function combos(names: string[]): Record<string, Bit>[] {
  const out: Record<string, Bit>[] = []
  for (let i = 0; i < 2 ** names.length; i++) {
    const row: Record<string, Bit> = {}
    names.forEach((n, k) => { row[n] = ((i >> (names.length - 1 - k)) & 1) as Bit })
    out.push(row)
  }
  return out
}

/** Сигналы, доступные вентилю с номером idx: входы схемы и предыдущие вентили. */
export const sourcesFor = (inputs: string[], gates: Gate[], idx: number) => [...inputs, ...gates.slice(0, idx).map((g) => g.id)]
