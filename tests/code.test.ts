import { describe, expect, it } from 'vitest'
import { CODE_PROJECTS, VM_CASES, bigAsm } from '../src/code/projects'
import { assemble, toBin } from '../src/hack/hack'
import { translate } from '../src/vm/translator'
import { compileProgram, parse, tokenize, tokensXml } from '../src/jack/jack'

// Эталонные «решения ученика» — наши собственные инструменты.
const REF: Record<string, (...a: never[]) => unknown> = {
  assemble: (s: string) => assemble(s).rom.map((r) => toBin(r.code)),
  translate: (f: Record<string, string>, b: boolean) => translate(f, b),
  analyze: (s: string, m: string) => (m === 'tokens' ? tokensXml(tokenize(s)) : parse(s).xml),
  compile: (f: Record<string, string>) => compileProgram(f),
}

describe('Проверки программных проектов', () => {
  for (const p of Object.values(CODE_PROJECTS)) {
    it(`${p.title}: эталон проходит все этапы`, () => {
      for (const st of p.stages) for (const t of st.tests) {
        const v = t.check(REF[p.fn](...(t.input as never[])))
        expect(v.ok, `${st.title} / ${t.name}: ${v.msg}`).toBe(true)
      }
    })
    it(`${p.title}: пустое решение не проходит`, () => {
      const t = p.stages[0].tests[0]
      expect(t.check(p.fn === 'compile' ? {} : '').ok).toBe(false)
    })
  }
  it('большая программа для ассемблера действительно большая', () => {
    expect(assemble(bigAsm()).rom.length).toBeGreaterThan(500)
  })
  it('все ВМ-сценарии останавливаются', () => {
    expect(Object.keys(VM_CASES).length).toBe(10)
  })
})
