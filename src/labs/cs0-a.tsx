import { useState } from 'react'
import { Icon } from '../components/ui'
import LogicBuilder, { type LogicTask } from './LogicBuilder'
import { AllDone, AnswerBox, Feedback, Steps, Toggle, norm, type LabProps } from './kit'

// ─────────────────────────── Морзе ───────────────────────────
// Буквы по уровням дерева: точка — влево, тире — вправо.
const TREE = ['', 'ET', 'IANM', 'SURWDKGO', 'HVF·L·PJBXCYZQ··']
const codeOf = (ch: string) => {
  for (let lvl = 1; lvl < TREE.length; lvl++) {
    const i = TREE[lvl].indexOf(ch)
    if (i >= 0) return i.toString(2).padStart(lvl, '0').replace(/0/g, '.').replace(/1/g, '-')
  }
  return ''
}
const letterOf = (code: string) => {
  if (!code || code.length > 4) return ''
  const i = parseInt(code.replace(/\./g, '0').replace(/-/g, '1'), 2)
  const ch = TREE[code.length][i]
  return ch === '·' ? '' : ch
}
const MORSE_TASKS = [
  { kind: 'enc' as const, word: 'SOS', why: 'Сигнал бедствия выбрали за ритм: три коротких, три длинных, три коротких — его не спутать.' },
  { kind: 'enc' as const, word: 'CODE', why: 'Чем чаще буква в английских текстах, тем короче её код: E — одна точка, T — одно тире.' },
  { kind: 'dec' as const, word: 'BIT', why: 'Каждый уровень дерева — ещё один сигнал, поэтому кодов длины n ровно 2ⁿ.' },
]

function MorseTree({ path }: { path: string }) {
  const W = 640
  return (
    <svg viewBox={`0 0 ${W} 250`} className="w-full h-auto min-w-[520px]">
      {TREE.slice(1).map((row, li) => {
        const lvl = li + 1
        return row.split('').map((ch, i) => {
          const x = ((i + 0.5) / row.length) * W
          const y = 30 + li * 55
          const code = i.toString(2).padStart(lvl, '0').replace(/0/g, '.').replace(/1/g, '-')
          const lit = path.startsWith(code)
          const px = lvl === 1 ? W / 2 : ((Math.floor(i / 2) + 0.5) / TREE[lvl - 1].length) * W
          const py = lvl === 1 ? 0 : y - 55
          return (
            <g key={lvl + ch + i}>
              <line x1={px} y1={py + (lvl === 1 ? 0 : 12)} x2={x} y2={y - 12} stroke={lit ? '#4FDBC8' : '#1E293B'} strokeWidth={lit ? 2.5 : 1.5} />
              <circle cx={x} cy={y} r={12} fill={lit ? 'rgba(79,219,200,0.2)' : '#111827'} stroke={lit ? '#4FDBC8' : i % 2 ? '#F59E0B55' : '#6366F155'} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={ch === '·' ? '#334155' : lit ? '#4FDBC8' : '#CBD5E1'}>{ch === '·' ? '' : ch}</text>
            </g>
          )
        })
      })}
      <text x={8} y={244} fontSize="10" fill="#64748B">влево — точка · вправо — тире</text>
    </svg>
  )
}

export function MorseLab({ onDone }: LabProps) {
  const [ti, setTi] = useState(0)
  const [typed, setTyped] = useState('')
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const t = MORSE_TASKS[ti]
  const parts = typed.split(' ')
  const cur = parts[parts.length - 1]
  const next = (ok: boolean, msg: string) => {
    setFb({ ok, msg })
    if (!ok) { setMistakes((m) => m + 1); return }
    if (ti + 1 === MORSE_TASKS.length) onDone(mistakes)
    setTimeout(() => { setTi((i) => i + 1); setTyped(''); setFb(null) }, 1200)
  }
  if (ti >= MORSE_TASKS.length) return <AllDone text="Ты закодировал и раскодировал слова и увидел, что азбука Морзе — это двоичное дерево." />
  const target = t.word.split('').map(codeOf).join(' ')
  return (
    <div className="space-y-4">
      <Steps i={ti} total={MORSE_TASKS.length} title={t.kind === 'enc' ? `Закодируй слово «${t.word}»` : 'Раскодируй сообщение'}>
        {t.kind === 'enc' ? 'Набирай точки и тире, буквы разделяй пробелом. Дерево подсвечивает путь текущей буквы.' : <>Пришло: <span className="font-mono text-amber-soft text-base">{target}</span>. Пройди по дереву и введи слово латиницей.</>}
      </Steps>
      <div className="card p-3 overflow-x-auto grid-bg"><MorseTree path={t.kind === 'enc' ? cur : ''} /></div>
      {t.kind === 'enc' ? (
        <div className="card p-4 space-y-3">
          <div className="font-mono text-2xl tracking-widest min-h-[2.5rem] break-all">{typed || <span className="text-dim text-base">…</span>}</div>
          <div className="text-sm text-mute">Сейчас: {parts.map((p) => letterOf(p) || (p ? '?' : '')).join('')}</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTyped(typed + '.')} className="btn-secondary !text-xl !px-5">·</button>
            <button onClick={() => setTyped(typed + '-')} className="btn-secondary !text-xl !px-5">–</button>
            <button onClick={() => setTyped(typed.endsWith(' ') || !typed ? typed : typed + ' ')} className="btn-secondary">пробел</button>
            <button onClick={() => setTyped(typed.slice(0, -1))} className="btn-ghost"><Icon name="backspace" /></button>
            <button onClick={() => next(typed.trim() === target, typed.trim() === target ? t.why : 'Сверь каждую букву с деревом: точка — шаг влево, тире — вправо.')} className="btn-primary ml-auto">Отправить</button>
          </div>
        </div>
      ) : (
        <div className="card p-4"><AnswerBox placeholder="Слово латиницей" onSubmit={(v) => next(v.toUpperCase() === t.word, v.toUpperCase() === t.word ? t.why : 'Начни с первой группы: -... — шаг вправо, потом три шага влево.')} /></div>
      )}
      <Feedback fb={fb} />
    </div>
  )
}

// ─────────────────────────── Байты текста ───────────────────────────
const cp1251 = (ch: string): number | null => {
  const c = ch.codePointAt(0)!
  if (c < 128) return c
  if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0
  if (c === 0x401) return 0xa8
  if (c === 0x451) return 0xb8
  return null
}
const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0')
const BYTE_TASKS = [
  { q: 'Сколько байт занимает слово «Привет» в UTF-8?', a: '12', why: 'Каждая кириллическая буква в UTF-8 — 2 байта. В CP1251 то же слово занимает 6 байт, но эта кодировка знает только кириллицу и латиницу.' },
  { q: 'Сколько байт занимает эмодзи 🙂 в UTF-8?', a: '4', why: 'Его номер U+1F642 больше 65 535, а такие символы UTF-8 записывает четырьмя байтами.' },
  { q: 'Какой десятичный код у латинской буквы «A» в ASCII? Набери её в поле и посмотри.', a: '65', why: 'A = 65 = 0x41. Строчная «a» = 97: она отличается ровно одним битом (32), поэтому сменить регистр в ASCII очень просто.' },
]
export function BytesLab({ onDone }: LabProps) {
  const [text, setText] = useState('Привет, Hi 🙂')
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const chars = Array.from(text)
  const utf8 = new TextEncoder().encode(text)
  const cpOk = chars.every((c) => cp1251(c) !== null)
  let mojibake = ''
  try { mojibake = new TextDecoder('windows-1251').decode(utf8) } catch { mojibake = '(браузер не умеет CP1251)' }
  const t = BYTE_TASKS[ti]
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label" htmlFor="bytes-in">Текст</label>
        <input id="bytes-in" className="input mt-2 text-lg" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
          <div className="rounded-lg bg-s2/60 p-2"><div className="text-xl font-bold">{chars.length}</div><div className="text-[11px] text-dim">символов</div></div>
          <div className="rounded-lg bg-s2/60 p-2"><div className="text-xl font-bold text-teal-soft">{utf8.length}</div><div className="text-[11px] text-dim">байт в UTF-8</div></div>
          <div className="rounded-lg bg-s2/60 p-2"><div className="text-xl font-bold text-amber-soft">{cpOk ? chars.length : '—'}</div><div className="text-[11px] text-dim">байт в CP1251{cpOk ? '' : ' (не всё влезает)'}</div></div>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm font-mono min-w-[480px]">
            <thead><tr className="text-dim text-xs text-left"><th className="py-1">символ</th><th>номер Unicode</th><th>UTF-8</th><th>CP1251</th><th>ASCII?</th></tr></thead>
            <tbody>{chars.slice(0, 40).map((c, i) => {
              const b = Array.from(new TextEncoder().encode(c))
              const w = cp1251(c)
              return <tr key={i} className="border-t border-line"><td className="py-1 text-base">{c === ' ' ? '␠' : c}</td><td className="text-violet-soft">U+{c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}</td><td className="text-teal-soft">{b.map(hex).join(' ')}</td><td className="text-amber-soft">{w === null ? '—' : hex(w)}</td><td>{c.codePointAt(0)! < 128 ? `да · ${c.codePointAt(0)}` : 'нет'}</td></tr>
            })}</tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm">
          <div className="label text-rose-soft">Байты UTF-8, прочитанные как CP1251</div>
          <div className="font-mono mt-1 break-all">{mojibake}</div>
          <p className="text-xs text-dim mt-1">Так и рождаются «кракозябры»: байты те же, а таблица для их чтения — чужая.</p>
        </div>
      </div>
      {ti < BYTE_TASKS.length ? (
        <div className="space-y-3">
          <Steps i={ti} total={BYTE_TASKS.length} title={t.q}>Пользуйся таблицей выше: набери нужный текст в поле.</Steps>
          <AnswerBox onSubmit={(v) => {
            const ok = norm(v) === t.a
            setFb({ ok, msg: ok ? t.why : 'Набери этот текст в поле и посмотри на счётчики.' })
            if (!ok) { setMistakes((m) => m + 1); return }
            if (ti + 1 === BYTE_TASKS.length) onDone(mistakes)
            setTimeout(() => { setTi((i) => i + 1); setFb(null) }, 1400)
          }} />
          <Feedback fb={fb} />
        </div>
      ) : <AllDone text="Ты увидел, что текст — это числа, а кодировка — таблица, по которой числа превращаются в буквы." />}
    </div>
  )
}

// ─────────────────────────── Битовая панель ───────────────────────────
const BIT_TASKS = [
  { title: 'Набери число 42', test: (v: number) => v === 42, why: '42 = 32 + 8 + 2 → 00101010.' },
  { title: 'Набери число, которое в шестнадцатеричной записи выглядит как A5', test: (v: number) => v === 0xa5, why: 'Каждая 16-ричная цифра — ровно 4 бита: A = 1010, 5 = 0101. Поэтому программисты так любят hex.' },
  { title: 'Набери самое большое число, которое помещается в 8 бит', test: (v: number) => v === 255, why: 'Все единицы: 2⁸ − 1 = 255 = 0xFF.' },
  { title: 'Набери восьмеричное число 17', test: (v: number) => v === 15, why: '17₈ = 1·8 + 7 = 15. Одна восьмеричная цифра — ровно 3 бита: 001 111.' },
]
export function BitsLab({ onDone }: LabProps) {
  const [bits, setBits] = useState<number[]>(Array(8).fill(0))
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const v = bits.reduce((a, b) => a * 2 + b, 0)
  const t = BIT_TASKS[ti]
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-1.5 sm:gap-2 justify-center flex-wrap">
          {bits.map((b, i) => <Toggle key={i} on={!!b} label={b} sub={2 ** (7 - i)} onClick={() => setBits(bits.map((x, k) => (k === i ? 1 - x : x)))} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
          {[['двоичная', v.toString(2).padStart(8, '0')], ['восьмеричная', v.toString(8)], ['десятичная', String(v)], ['шестнадцатеричная', v.toString(16).toUpperCase()]].map(([l, x]) => (
            <div key={l} className="rounded-lg bg-s2/60 p-2"><div className="font-mono text-lg font-bold">{x}</div><div className="text-[11px] text-dim">{l}</div></div>
          ))}
        </div>
        <p className="text-xs text-dim mt-3 text-center">Значение = сумма весов включённых разрядов: {bits.map((b, i) => (b ? 2 ** (7 - i) : null)).filter((x) => x !== null).join(' + ') || '0'}</p>
      </div>
      {ti < BIT_TASKS.length ? (
        <div className="space-y-3">
          <Steps i={ti} total={BIT_TASKS.length} title={t.title} />
          <button className="btn-primary" onClick={() => {
            const ok = t.test(v)
            setFb({ ok, msg: ok ? t.why : `Сейчас на панели ${v}. Подумай, какие веса нужно сложить.` })
            if (!ok) { setMistakes((m) => m + 1); return }
            if (ti + 1 === BIT_TASKS.length) onDone(mistakes)
            setTimeout(() => { setTi((i) => i + 1); setFb(null) }, 1400)
          }}><Icon name="fact_check" className="text-[18px]" />Проверить</button>
          <Feedback fb={fb} />
        </div>
      ) : <AllDone text="Одно и то же число — четыре записи. Меняется только основание системы." />}
    </div>
  )
}

// ─────────────────────────── Выключатели ───────────────────────────
const SW_TASKS = [
  { title: 'Лампа должна гореть, только когда включены оба выключателя', want: (a: number, b: number) => a & b, mode: 'series' as const, why: 'Последовательное соединение — это логическое И: ток проходит, только если замкнуты оба.' },
  { title: 'Лампа должна гореть, когда включён хотя бы один выключатель', want: (a: number, b: number) => a | b, mode: 'parallel' as const, why: 'Параллельное соединение — это логическое ИЛИ: у тока два пути, хватит любого.' },
]
export function SwitchesLab({ onDone }: LabProps) {
  const [mode, setMode] = useState<'series' | 'parallel'>('parallel')
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [seen, setSeen] = useState<Record<string, number>>({})
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const lamp = mode === 'series' ? a & b : a | b
  const key = `${a}${b}`
  if (seen[key] !== lamp) setSeen({ ...seen, [key]: lamp })
  const t = SW_TASKS[ti]
  const wire = (on: boolean) => (on ? '#4FDBC8' : '#334155')
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-2 mb-3">
          {(['series', 'parallel'] as const).map((m) => <button key={m} onClick={() => { setMode(m); setSeen({}); setFb(null) }} className={`chip border !px-3 !py-1.5 ${mode === m ? 'border-violet bg-violet/15 text-violet-soft' : 'border-line text-mute'}`}>{m === 'series' ? 'Последовательно' : 'Параллельно'}</button>)}
        </div>
        <svg viewBox="0 0 420 180" className="w-full max-w-xl h-auto mx-auto">
          <rect x="16" y="70" width="30" height="40" rx="4" fill="#111827" stroke="#F59E0B" /><text x="31" y="95" textAnchor="middle" fontSize="12" fill="#F59E0B">+ −</text>
          {mode === 'series' ? (
            <>
              <path d="M46,80 H120" stroke={wire(!!a)} strokeWidth="3" /><path d="M180,80 H240" stroke={wire(!!(a & b))} strokeWidth="3" /><path d="M300,80 H340" stroke={wire(!!lamp)} strokeWidth="3" />
              <g onClick={() => setA(1 - a)} className="cursor-pointer"><circle cx="120" cy="80" r="4" fill="#CBD5E1" /><line x1="120" y1="80" x2="178" y2={a ? 80 : 55} stroke="#CBD5E1" strokeWidth="3" /><text x="150" y="110" textAnchor="middle" fontSize="13" fill="#94A3B8">A</text></g>
              <g onClick={() => setB(1 - b)} className="cursor-pointer"><circle cx="240" cy="80" r="4" fill="#CBD5E1" /><line x1="240" y1="80" x2="298" y2={b ? 80 : 55} stroke="#CBD5E1" strokeWidth="3" /><text x="270" y="110" textAnchor="middle" fontSize="13" fill="#94A3B8">B</text></g>
            </>
          ) : (
            <>
              <path d="M46,80 H90 V50 H130 M90,80 V120 H130" fill="none" stroke={wire(true)} strokeWidth="3" />
              <path d="M190,50 H230 V80 M190,120 H230 V80 M230,80 H340" fill="none" stroke={wire(!!lamp)} strokeWidth="3" />
              <g onClick={() => setA(1 - a)} className="cursor-pointer"><circle cx="130" cy="50" r="4" fill="#CBD5E1" /><line x1="130" y1="50" x2="188" y2={a ? 50 : 25} stroke="#CBD5E1" strokeWidth="3" /><text x="160" y="72" textAnchor="middle" fontSize="13" fill="#94A3B8">A</text></g>
              <g onClick={() => setB(1 - b)} className="cursor-pointer"><circle cx="130" cy="120" r="4" fill="#CBD5E1" /><line x1="130" y1="120" x2="188" y2={b ? 120 : 95} stroke="#CBD5E1" strokeWidth="3" /><text x="160" y="145" textAnchor="middle" fontSize="13" fill="#94A3B8">B</text></g>
            </>
          )}
          <circle cx="360" cy="80" r="20" fill={lamp ? '#FCD34D' : '#111827'} stroke="#F59E0B" strokeWidth="2" />
          {lamp ? <circle cx="360" cy="80" r="34" fill="#FCD34D" opacity="0.15" /> : null}
          <path d="M380,80 H400 V165 H31 V110" fill="none" stroke={wire(!!lamp)} strokeWidth="3" />
        </svg>
        <div className="flex justify-center gap-2 mt-2">
          <Toggle on={!!a} label="A" sub={a ? 'вкл' : 'выкл'} onClick={() => setA(1 - a)} />
          <Toggle on={!!b} label="B" sub={b ? 'вкл' : 'выкл'} onClick={() => setB(1 - b)} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4 text-center font-mono text-sm">
          {['00', '01', '10', '11'].map((k) => <div key={k} className={`rounded-lg p-2 ${k === key ? 'bg-violet/15' : 'bg-s2/60'}`}><div className="text-dim text-xs">A={k[0]} B={k[1]}</div><div className={seen[k] === undefined ? 'text-dim' : seen[k] ? 'text-amber-soft' : ''}>{seen[k] === undefined ? '?' : seen[k] ? 'горит' : 'нет'}</div></div>)}
        </div>
      </div>
      {ti < SW_TASKS.length ? (
        <div className="space-y-3">
          <Steps i={ti} total={SW_TASKS.length} title={t.title}>Выбери соединение, проверь все 4 положения выключателей и нажми «Проверить».</Steps>
          <button className="btn-primary" onClick={() => {
            if (Object.keys(seen).length < 4) { setFb({ ok: false, msg: 'Сначала попробуй все четыре комбинации выключателей — таблица внизу должна заполниться.' }); return }
            const ok = mode === t.mode
            setFb({ ok, msg: ok ? t.why : 'Посмотри на таблицу: она не совпадает с условием.' })
            if (!ok) { setMistakes((m) => m + 1); return }
            if (ti + 1 === SW_TASKS.length) onDone(mistakes)
            setTimeout(() => { setTi((i) => i + 1); setFb(null); setSeen({}) }, 1500)
          }}><Icon name="fact_check" className="text-[18px]" />Проверить</button>
          <Feedback fb={fb} />
        </div>
      ) : <AllDone text="Два способа соединить выключатели — это две основные логические операции, И и ИЛИ." />}
    </div>
  )
}

// ─────────────────────────── Логические конструкторы ───────────────────────────
export function LogicSeries({ tasks, onDone, final }: LabProps & { tasks: LogicTask[]; final: string }) {
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  if (ti >= tasks.length) return <AllDone text={final} />
  return (
    <div className="space-y-3">
      <div className="flex gap-1">{tasks.map((t, k) => <span key={t.id} className={`chip ${k < ti ? 'bg-teal/15 text-teal-soft' : k === ti ? 'bg-violet/15 text-violet-soft' : 'bg-s2 text-dim'}`}>{k + 1}. {t.title.split(':')[0]}</span>)}</div>
      <LogicBuilder task={tasks[ti]} onSolved={(att) => {
        const m = mistakes + att - 1
        setMistakes(m)
        if (ti + 1 === tasks.length) onDone(m)
        setTimeout(() => setTi((i) => i + 1), 1500)
      }} />
    </div>
  )
}

export const NAND_TASKS: LogicTask[] = [
  { id: 'not', title: 'NOT из NAND: инвертор', brief: 'Сделай выход Y = НЕ A, используя только NAND.', inputs: ['A'], outputs: [{ name: 'Y', target: (v) => (v.A ? 0 : 1) }], allowed: ['NAND'], maxGates: 1, hint: 'Что будет, если подать A на оба входа NAND?' },
  { id: 'and', title: 'AND из NAND', brief: 'Y = A И B. NAND — это «И», за которым стоит «НЕ». Как убрать лишнее НЕ?', inputs: ['A', 'B'], outputs: [{ name: 'Y', target: (v) => (v.A & v.B) as 0 | 1 }], allowed: ['NAND'], maxGates: 2, hint: 'Сначала NAND(A, B), потом инвертируй результат тем же приёмом, что в прошлой задаче.' },
  { id: 'or', title: 'OR из NAND', brief: 'Y = A ИЛИ B. Подсказка — закон де Моргана: A ИЛИ B = НЕ(НЕ A И НЕ B).', inputs: ['A', 'B'], outputs: [{ name: 'Y', target: (v) => (v.A | v.B) as 0 | 1 }], allowed: ['NAND'], maxGates: 3, hint: 'Инвертируй A, инвертируй B, а затем подай оба на NAND.' },
  { id: 'xor', title: 'XOR из NAND', brief: 'Y = 1, когда входы разные. Классическое решение — 4 вентиля NAND.', inputs: ['A', 'B'], outputs: [{ name: 'Y', target: (v) => (v.A ^ v.B) as 0 | 1 }], allowed: ['NAND'], maxGates: 5, hint: 'g1 = NAND(A,B); g2 = NAND(A,g1); g3 = NAND(B,g1); Y = NAND(g2,g3).' },
]
