// Компилятор языка Jack: лексер, синтаксический анализ с выводом XML (проект 10)
// и генерация ВМ-кода (проект 11). Грамматика — по спецификации языка Jack (гл. 9–11).

export class JackError extends Error {}

export type TokType = 'keyword' | 'symbol' | 'integerConstant' | 'stringConstant' | 'identifier'
export interface Tok { type: TokType; value: string; line: number }

const KEYWORDS = new Set(['class', 'constructor', 'function', 'method', 'field', 'static', 'var', 'int', 'char', 'boolean', 'void', 'true', 'false', 'null', 'this', 'let', 'do', 'if', 'else', 'while', 'return'])
const SYMBOLS = '{}()[].,;+-*/&|<>=~'

export function tokenize(src: string, file = 'Main'): Tok[] {
  const out: Tok[] = []
  let i = 0, line = 1
  const err = (m: string) => { throw new JackError(`${file}.jack, строка ${line}: ${m}`) }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') { line++; i++; continue }
    if (/\s/.test(c)) { i++; continue }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) err('незакрытый комментарий'); line += (src.slice(i, e).match(/\n/g) ?? []).length; i = e + 2; continue }
    if (SYMBOLS.includes(c)) { out.push({ type: 'symbol', value: c, line }); i++; continue }
    if (c === '"') { const e = src.indexOf('"', i + 1); const nl = src.indexOf('\n', i + 1); if (e < 0 || (nl >= 0 && nl < e)) err('незакрытая строка'); out.push({ type: 'stringConstant', value: src.slice(i + 1, e), line }); i = e + 1; continue }
    let m = /^\d+/.exec(src.slice(i))
    if (m) { const n = Number(m[0]); if (n > 32767) err(`число ${n} больше 32767`); out.push({ type: 'integerConstant', value: m[0], line }); i += m[0].length; continue }
    m = /^[A-Za-z_]\w*/.exec(src.slice(i))
    if (m) { out.push({ type: KEYWORDS.has(m[0]) ? 'keyword' : 'identifier', value: m[0], line }); i += m[0].length; continue }
    err(`непонятный символ «${c}»`)
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const tokensXml = (toks: Tok[]) => ['<tokens>', ...toks.map((t) => `<${t.type}> ${esc(t.value)} </${t.type}>`), '</tokens>'].join('\n') + '\n'

// ─── AST ───
export type Term =
  | { k: 'int'; v: number } | { k: 'str'; v: string } | { k: 'kw'; v: string }
  | { k: 'var'; name: string; line: number } | { k: 'idx'; name: string; e: Expr; line: number }
  | { k: 'call'; call: Call } | { k: 'paren'; e: Expr } | { k: 'unary'; op: string; t: Term }
export interface Expr { first: Term; rest: { op: string; t: Term }[] }
export interface Call { target?: string; name: string; args: Expr[]; line: number }
export type Stmt =
  | { k: 'let'; name: string; idx?: Expr; e: Expr; line: number }
  | { k: 'if'; c: Expr; t: Stmt[]; f?: Stmt[] }
  | { k: 'while'; c: Expr; b: Stmt[] }
  | { k: 'do'; call: Call }
  | { k: 'return'; e?: Expr }
export interface Sub { kind: 'constructor' | 'function' | 'method'; ret: string; name: string; params: { type: string; name: string }[]; vars: { type: string; name: string }[]; body: Stmt[] }
export interface ClassNode { name: string; vars: { kind: 'static' | 'field'; type: string; name: string }[]; subs: Sub[] }

/** Синтаксический анализ: строит AST и параллельно XML-дерево разбора. */
export function parse(src: string, file = 'Main'): { ast: ClassNode; xml: string } {
  const toks = tokenize(src, file)
  let p = 0
  const xml: string[] = []
  let depth = 0
  const open = (tag: string) => { xml.push(`${'  '.repeat(depth)}<${tag}>`); depth++ }
  const close = (tag: string) => { depth--; xml.push(`${'  '.repeat(depth)}</${tag}>`) }
  const peek = (o = 0) => toks[p + o]
  const err = (m: string): never => { const t = peek() ?? toks[toks.length - 1]; throw new JackError(`${file}.jack, строка ${t?.line ?? 1}: ${m}${peek() ? `, а встретилось «${peek().value}»` : ''}`) }
  const take = () => { const t = toks[p++]; if (!t) err('файл неожиданно закончился'); xml.push(`${'  '.repeat(depth)}<${t.type}> ${esc(t.value)} </${t.type}>`); return t }
  const is = (v: string, o = 0) => peek(o)?.value === v && peek(o)?.type !== 'stringConstant'
  const want = (v: string) => { if (!is(v)) err(`ожидалось «${v}»`); return take() }
  const ident = () => { if (peek()?.type !== 'identifier') err('ожидалось имя'); return take().value }
  const type = () => { const t = peek(); if (t && (t.type === 'identifier' || ['int', 'char', 'boolean'].includes(t.value))) return take().value; return err('ожидался тип (int, char, boolean или имя класса)') }

  const expr = (): Expr => {
    open('expression')
    const first = term(); const rest: Expr['rest'] = []
    while (peek() && '+-*/&|<>='.includes(peek().value) && peek().type === 'symbol') { const op = take().value; rest.push({ op, t: term() }) }
    close('expression')
    return { first, rest }
  }
  const exprList = (): Expr[] => {
    open('expressionList'); const a: Expr[] = []
    if (!is(')')) { a.push(expr()); while (is(',')) { take(); a.push(expr()) } }
    close('expressionList'); return a
  }
  const callRest = (first: string, line: number): Call => {
    let target: string | undefined, name = first
    if (is('.')) { take(); target = first; name = ident() }
    want('('); const args = exprList(); want(')')
    return { target, name, args, line }
  }
  const term = (): Term => {
    open('term')
    const t = peek(); let r: Term
    if (!t) err('ожидалось выражение')
    if (t.type === 'integerConstant') { take(); r = { k: 'int', v: Number(t.value) } }
    else if (t.type === 'stringConstant') { take(); r = { k: 'str', v: t.value } }
    else if (['true', 'false', 'null', 'this'].includes(t.value) && t.type === 'keyword') { take(); r = { k: 'kw', v: t.value } }
    else if (is('(')) { take(); const e = expr(); want(')'); r = { k: 'paren', e } }
    else if (is('-') || is('~')) { const op = take().value; r = { k: 'unary', op, t: term() } }
    else if (t.type === 'identifier') {
      const name = take().value
      if (is('[')) { take(); const e = expr(); want(']'); r = { k: 'idx', name, e, line: t.line } }
      else if (is('(') || is('.')) r = { k: 'call', call: callRest(name, t.line) }
      else r = { k: 'var', name, line: t.line }
    } else return err('ожидалось выражение')
    close('term')
    return r
  }
  const statements = (): Stmt[] => {
    open('statements'); const out: Stmt[] = []
    for (;;) {
      if (is('let')) {
        open('letStatement'); const line = take().line; const name = ident(); let idx: Expr | undefined
        if (is('[')) { take(); idx = expr(); want(']') }
        want('='); const e = expr(); want(';'); close('letStatement'); out.push({ k: 'let', name, idx, e, line })
      } else if (is('if')) {
        open('ifStatement'); take(); want('('); const c = expr(); want(')'); want('{'); const t = statements(); want('}')
        let f: Stmt[] | undefined
        if (is('else')) { take(); want('{'); f = statements(); want('}') }
        close('ifStatement'); out.push({ k: 'if', c, t, f })
      } else if (is('while')) {
        open('whileStatement'); take(); want('('); const c = expr(); want(')'); want('{'); const b = statements(); want('}'); close('whileStatement'); out.push({ k: 'while', c, b })
      } else if (is('do')) {
        open('doStatement'); take(); const line = peek()?.line ?? 0; const call = callRest(ident(), line); want(';'); close('doStatement'); out.push({ k: 'do', call })
      } else if (is('return')) {
        open('returnStatement'); take(); const e = is(';') ? undefined : expr(); want(';'); close('returnStatement'); out.push({ k: 'return', e })
      } else break
    }
    close('statements'); return out
  }

  open('class'); want('class'); const name = ident(); want('{')
  const vars: ClassNode['vars'] = []
  while (is('static') || is('field')) {
    open('classVarDec'); const kind = take().value as 'static' | 'field'; const t = type()
    vars.push({ kind, type: t, name: ident() }); while (is(',')) { take(); vars.push({ kind, type: t, name: ident() }) }
    want(';'); close('classVarDec')
  }
  const subs: Sub[] = []
  while (is('constructor') || is('function') || is('method')) {
    open('subroutineDec'); const kind = take().value as Sub['kind']
    const ret = is('void') ? take().value : type(); const sname = ident(); want('(')
    open('parameterList'); const params: Sub['params'] = []
    if (!is(')')) { const t = type(); params.push({ type: t, name: ident() }); while (is(',')) { take(); const t2 = type(); params.push({ type: t2, name: ident() }) } }
    close('parameterList'); want(')')
    open('subroutineBody'); want('{'); const sv: Sub['vars'] = []
    while (is('var')) { open('varDec'); take(); const t = type(); sv.push({ type: t, name: ident() }); while (is(',')) { take(); sv.push({ type: t, name: ident() }) } want(';'); close('varDec') }
    const body = statements(); want('}'); close('subroutineBody'); close('subroutineDec')
    subs.push({ kind, ret, name: sname, params, vars: sv, body })
  }
  want('}'); close('class')
  if (p < toks.length) err('лишний код после конца класса')
  return { ast: { name, vars, subs }, xml: xml.join('\n') + '\n' }
}

// ─── Генерация ВМ-кода ───
export function compileClass(src: string, file = 'Main'): string {
  const { ast } = parse(src, file)
  if (ast.name !== file) throw new JackError(`${file}.jack: класс должен называться ${file}, а называется ${ast.name}`)
  const out: string[] = []
  const classSym = new Map<string, { kind: 'static' | 'this'; type: string; i: number }>()
  let nStatic = 0, nField = 0
  for (const v of ast.vars) classSym.set(v.name, v.kind === 'static' ? { kind: 'static', type: v.type, i: nStatic++ } : { kind: 'this', type: v.type, i: nField++ })
  let label = 0
  for (const sub of ast.subs) {
    const local = new Map<string, { kind: 'argument' | 'local'; type: string; i: number }>()
    let a = sub.kind === 'method' ? 1 : 0
    sub.params.forEach((x) => local.set(x.name, { kind: 'argument', type: x.type, i: a++ }))
    sub.vars.forEach((x, i) => local.set(x.name, { kind: 'local', type: x.type, i }))
    const look = (n: string, line: number) => { const s = local.get(n) ?? classSym.get(n); if (!s) throw new JackError(`${file}.jack, строка ${line}: переменная ${n} не объявлена`); if (s.kind === 'this' && sub.kind === 'function') throw new JackError(`${file}.jack, строка ${line}: поле ${n} недоступно в function`); return s }
    const find = (n: string) => local.get(n) ?? classSym.get(n)
    out.push(`function ${ast.name}.${sub.name} ${sub.vars.length}`)
    if (sub.kind === 'constructor') out.push(`push constant ${nField}`, 'call Memory.alloc 1', 'pop pointer 0')
    if (sub.kind === 'method') out.push('push argument 0', 'pop pointer 0')
    const OPS: Record<string, string> = { '+': 'add', '-': 'sub', '&': 'and', '|': 'or', '<': 'lt', '>': 'gt', '=': 'eq', '*': 'call Math.multiply 2', '/': 'call Math.divide 2' }
    const call = (c: Call) => {
      let n = c.args.length, fname: string
      if (!c.target) { out.push('push pointer 0'); n++; fname = `${ast.name}.${c.name}` }
      else { const s = find(c.target); if (s) { out.push(`push ${s.kind} ${s.i}`); n++; fname = `${s.type}.${c.name}` } else fname = `${c.target}.${c.name}` }
      c.args.forEach(expr)
      out.push(`call ${fname} ${n}`)
    }
    const term = (t: Term) => {
      switch (t.k) {
        case 'int': out.push(`push constant ${t.v}`); break
        case 'str': out.push(`push constant ${t.v.length}`, 'call String.new 1'); for (const ch of t.v) out.push(`push constant ${ch.charCodeAt(0)}`, 'call String.appendChar 2'); break
        case 'kw': out.push(t.v === 'true' ? 'push constant 0\nnot' : t.v === 'this' ? 'push pointer 0' : 'push constant 0'); break
        case 'var': { const s = look(t.name, t.line); out.push(`push ${s.kind} ${s.i}`); break }
        case 'idx': { const s = look(t.name, t.line); out.push(`push ${s.kind} ${s.i}`); expr(t.e); out.push('add', 'pop pointer 1', 'push that 0'); break }
        case 'call': call(t.call); break
        case 'paren': expr(t.e); break
        case 'unary': term(t.t); out.push(t.op === '-' ? 'neg' : 'not'); break
      }
    }
    function expr(e: Expr) { term(e.first); for (const r of e.rest) { term(r.t); out.push(OPS[r.op]) } }
    const stmts = (ss: Stmt[]) => ss.forEach((s) => {
      switch (s.k) {
        case 'let': {
          const v = look(s.name, s.line)
          if (s.idx) { out.push(`push ${v.kind} ${v.i}`); expr(s.idx); out.push('add'); expr(s.e); out.push('pop temp 0', 'pop pointer 1', 'push temp 0', 'pop that 0') }
          else { expr(s.e); out.push(`pop ${v.kind} ${v.i}`) }
          break
        }
        case 'if': { const L = label++; expr(s.c); out.push('not', `if-goto IF_ELSE${L}`); stmts(s.t); out.push(`goto IF_END${L}`, `label IF_ELSE${L}`); if (s.f) stmts(s.f); out.push(`label IF_END${L}`); break }
        case 'while': { const L = label++; out.push(`label WHILE${L}`); expr(s.c); out.push('not', `if-goto WHILE_END${L}`); stmts(s.b); out.push(`goto WHILE${L}`, `label WHILE_END${L}`); break }
        case 'do': call(s.call); out.push('pop temp 0'); break
        case 'return': if (s.e) expr(s.e); else out.push('push constant 0'); out.push('return'); break
      }
    })
    stmts(sub.body)
  }
  return out.join('\n') + '\n'
}

/** Компилирует набор классов: имя → исходник Jack. */
export function compileProgram(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(files).map(([n, s]) => [n, compileClass(s, n)]))
}
