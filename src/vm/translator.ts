// Эталонный транслятор ВМ → ассемблер Hack (проекты 7–8).
// Нужен для проверки решений ученика и для генерации больших программ.

import { parseVm, type Line } from './vm'

const SEG: Record<string, string> = { local: 'LCL', argument: 'ARG', this: 'THIS', that: 'THAT' }

export function translate(files: Record<string, string>, bootstrap = true): string {
  const lines: Line[] = parseVm(files)
  const out: string[] = []
  let n = 0
  const pushD = ['@SP', 'A=M', 'M=D', '@SP', 'M=M+1']
  const popD = ['@SP', 'AM=M-1', 'D=M']
  const call = (name: string, nArgs: number) => {
    const ret = `RET.${name}.${n++}`
    out.push(`@${ret}`, 'D=A', ...pushD)
    for (const r of ['LCL', 'ARG', 'THIS', 'THAT']) out.push(`@${r}`, 'D=M', ...pushD)
    out.push('@SP', 'D=M', `@${5 + nArgs}`, 'D=D-A', '@ARG', 'M=D', '@SP', 'D=M', '@LCL', 'M=D', `@${name}`, '0;JMP', `(${ret})`)
  }
  if (bootstrap) { out.push('@256', 'D=A', '@SP', 'M=D'); call('Sys.init', 0) }
  for (const { cmd: c, file } of lines) {
    out.push(`// ${c.op}`)
    switch (c.op) {
      case 'push':
        if (c.seg === 'constant') out.push(`@${c.i}`, 'D=A')
        else if (SEG[c.seg]) out.push(`@${SEG[c.seg]}`, 'D=M', `@${c.i}`, 'A=D+A', 'D=M')
        else out.push(`@${c.seg === 'temp' ? 5 + c.i : c.seg === 'pointer' ? 3 + c.i : `${file}.${c.i}`}`, 'D=M')
        out.push(...pushD); break
      case 'pop':
        if (SEG[c.seg]) out.push(`@${SEG[c.seg]}`, 'D=M', `@${c.i}`, 'D=D+A', '@R13', 'M=D', ...popD, '@R13', 'A=M', 'M=D')
        else out.push(...popD, `@${c.seg === 'temp' ? 5 + c.i : c.seg === 'pointer' ? 3 + c.i : `${file}.${c.i}`}`, 'M=D')
        break
      case 'add': case 'sub': case 'and': case 'or':
        out.push(...popD, '@SP', 'A=M-1', `M=${{ add: 'D+M', sub: 'M-D', and: 'D&M', or: 'D|M' }[c.op]}`); break
      case 'neg': out.push('@SP', 'A=M-1', 'M=-M'); break
      case 'not': out.push('@SP', 'A=M-1', 'M=!M'); break
      case 'eq': case 'gt': case 'lt': {
        const L = `CMP${n++}`
        out.push(...popD, '@SP', 'A=M-1', 'D=M-D', 'M=-1', `@${L}`, `D;J${c.op.toUpperCase()}`, '@SP', 'A=M-1', 'M=0', `(${L})`); break
      }
      case 'label': out.push(`(${c.label})`); break
      case 'goto': out.push(`@${c.label}`, '0;JMP'); break
      case 'if-goto': out.push(...popD, `@${c.label}`, 'D;JNE'); break
      case 'function': out.push(`(${c.name})`); for (let k = 0; k < c.nVars; k++) out.push('@SP', 'A=M', 'M=0', '@SP', 'M=M+1'); break
      case 'call': call(c.name, c.nArgs); break
      case 'return':
        out.push('@LCL', 'D=M', '@R13', 'M=D', '@5', 'A=D-A', 'D=M', '@R14', 'M=D', ...popD, '@ARG', 'A=M', 'M=D', '@ARG', 'D=M+1', '@SP', 'M=D')
        for (const [r, k] of [['THAT', 1], ['THIS', 2], ['ARG', 3], ['LCL', 4]] as const) out.push('@R13', 'D=M', `@${k}`, 'A=D-A', 'D=M', `@${r}`, 'M=D')
        out.push('@R14', 'A=M', '0;JMP'); break
    }
  }
  return out.join('\n') + '\n'
}
