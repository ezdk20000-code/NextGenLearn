import { useRef, type ReactNode } from 'react'

const JS_KW = /\b(const|let|var|function|return|if|else|for|while|do|of|in|new|class|export|import|from|break|continue|switch|case|default|throw|try|catch|true|false|null|undefined|this|typeof)\b/
const JACK_KW = /\b(class|constructor|function|method|field|static|var|int|char|boolean|void|true|false|null|this|let|do|if|else|while|return)\b/

/** Подсветка: комментарии, строки, числа, ключевые слова. */
export function highlightCode(line: string, lang: 'js' | 'jack' | 'vm'): ReactNode {
  const kw = lang === 'js' ? JS_KW : lang === 'jack' ? JACK_KW : /\b(push|pop|add|sub|neg|eq|gt|lt|and|or|not|label|goto|if-goto|function|call|return)\b/
  const re = new RegExp(`(\\/\\/.*$|\\/\\*.*?\\*\\/)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`[^\`]*\`)|(\\b\\d+\\b)|${kw.source}|(\\b[A-Z][A-Za-z0-9_]*\\b)`, 'g')
  const parts: ReactNode[] = []
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index))
    const cls = m[1] ? 'text-dim italic' : m[2] ? 'text-amber-soft' : m[3] ? 'text-amber-soft' : m[4] ? 'text-violet-soft' : 'text-teal-soft'
    parts.push(<span key={k++} className={cls}>{m[0]}</span>)
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  parts.push(line.slice(last))
  return parts
}

export default function CodeEditor({ value, onChange, lang, current, minH = 420, label }: { value: string; onChange: (v: string) => void; lang: 'js' | 'jack' | 'vm'; current?: number | null; minH?: number; label: string }) {
  const pre = useRef<HTMLDivElement>(null)
  const lines = value.split('\n')
  return (
    <div className="flex rounded-lg border border-line bg-[#0A0E16] font-mono text-[13px] leading-6 overflow-hidden">
      <div className="py-3 px-2 text-right text-dim select-none border-r border-line min-w-[2.75rem]">{lines.map((_, i) => <div key={i} className={current === i ? 'text-amber-soft font-bold' : ''}>{String(i + 1).padStart(2, '0')}</div>)}</div>
      <div className="relative flex-1 min-w-0">
        <div ref={pre} aria-hidden className="absolute inset-0 py-3 whitespace-pre overflow-hidden pointer-events-none">
          {lines.map((l, i) => <div key={i} className={`px-3 min-h-[1.5rem] ${current === i ? 'bg-amber/10 border-l-2 border-amber' : ''}`}>{highlightCode(l, lang)}</div>)}
        </div>
        <textarea value={value} spellCheck={false} wrap="off" aria-label={label}
          onScroll={(e) => { if (pre.current) { pre.current.scrollTop = e.currentTarget.scrollTop; pre.current.scrollLeft = e.currentTarget.scrollLeft } }}
          onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; onChange(value.slice(0, s) + '  ' + value.slice(t.selectionEnd)); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2 }) } }}
          onChange={(e) => onChange(e.target.value)}
          className="relative w-full py-3 px-3 bg-transparent text-transparent outline-none resize-y whitespace-pre overflow-auto" style={{ caretColor: '#E2E8F0', minHeight: minH }} />
      </div>
    </div>
  )
}
