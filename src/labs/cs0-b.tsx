import { useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import type { LogicTask } from './LogicBuilder'
import { AllDone, AnswerBox, Feedback, Steps, Toggle, norm, type LabProps } from './kit'
import { OPS, initState, parse, run, step, type CpuState } from './cpu'

type Fb = null | { ok: boolean; msg: string }

/** Общая логика «задание → проверка → следующее». */
function useTasks(n: number, onDone: (m: number) => void) {
  const [ti, setTi] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<Fb>(null)
  const judge = (ok: boolean, msg: string) => {
    setFb({ ok, msg })
    if (!ok) { setMistakes((m) => m + 1); return }
    if (ti + 1 === n) onDone(mistakes)
    setTimeout(() => { setTi((i) => i + 1); setFb(null) }, 1500)
  }
  return { ti, fb, judge, done: ti >= n }
}

// ─────────────────────────── Сумматор ───────────────────────────
export const ADDER_TASKS: LogicTask[] = [
  { id: 'half', title: 'Полусумматор: складываем два бита', brief: 'S — бит суммы, C — бит переноса. 1 + 1 = 10₂, то есть S = 0, C = 1.', inputs: ['A', 'B'], outputs: [{ name: 'S', target: (v) => (v.A ^ v.B) as 0 | 1 }, { name: 'C', target: (v) => (v.A & v.B) as 0 | 1 }], allowed: ['XOR', 'AND'], maxGates: 2, hint: 'Посмотри на таблицу: столбец S совпадает с XOR, а столбец C — с AND.' },
  { id: 'full', title: 'Полный сумматор: два бита и перенос', brief: 'Сложи A, B и перенос из младшего разряда Cin. Получи S и перенос дальше Cout.', inputs: ['A', 'B', 'Cin'], outputs: [{ name: 'S', target: (v) => (v.A ^ v.B ^ v.Cin) as 0 | 1 }, { name: 'Cout', target: (v) => ((v.A & v.B) | (v.Cin & (v.A ^ v.B))) as 0 | 1 }], allowed: ['XOR', 'AND', 'OR'], maxGates: 5, hint: 'Это два полусумматора: g1 = XOR(A,B), S = XOR(g1,Cin). Перенос возникает, если A И B или если Cin И g1 — соедини их через OR.' },
]

// ─────────────────────────── Дополнительный код ───────────────────────────
const signed = (u: number) => (u >= 128 ? u - 256 : u)
const TWOS_TASKS = [
  { title: 'Набери −1 в 8-битном дополнительном коде', test: (u: number) => u === 255, why: '−1 = 11111111. Прибавь 1 — все разряды обнулятся, а перенос уйдёт за пределы байта: получится 0, как и должно быть.' },
  { title: 'Набери −5', test: (u: number) => u === 251, why: '5 = 00000101. Инвертируем: 11111010, прибавляем 1: 11111011 = 251 без знака = −5 со знаком.' },
  { title: 'Набери самое маленькое число со знаком, которое помещается в байт', test: (u: number) => u === 128, why: '10000000 = −128. Положительных на одно меньше (до +127), потому что ноль занимает место среди «неотрицательных».' },
]
export function TwosLab({ onDone }: LabProps) {
  const [bits, setBits] = useState<number[]>(Array(8).fill(0))
  const [a, setA] = useState(100)
  const [b, setB] = useState(20)
  const [phase2, setPhase2] = useState(false)
  const { ti, fb, judge, done } = useTasks(TWOS_TASKS.length + 1, onDone)
  const u = bits.reduce((x, y) => x * 2 + y, 0)
  const sum = a + b
  const wrapped = signed(((sum % 256) + 256) % 256)
  const overflow = sum > 127 || sum < -128
  const inv = bits.map((x) => 1 - x)
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-1.5 justify-center flex-wrap">{bits.map((x, i) => <Toggle key={i} on={!!x} label={x} sub={i === 0 ? '−128' : 2 ** (7 - i)} onClick={() => setBits(bits.map((y, k) => (k === i ? 1 - y : y)))} />)}</div>
        <div className="grid grid-cols-2 gap-2 mt-4 text-center">
          <div className="rounded-lg bg-s2/60 p-2"><div className="font-mono text-xl font-bold">{u}</div><div className="text-[11px] text-dim">без знака (0…255)</div></div>
          <div className="rounded-lg bg-s2/60 p-2"><div className="font-mono text-xl font-bold text-teal-soft">{signed(u)}</div><div className="text-[11px] text-dim">со знаком (−128…127)</div></div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          <button className="btn-ghost text-xs" onClick={() => setBits(inv)}><Icon name="swap_vert" className="text-[16px]" />Инвертировать все биты</button>
          <button className="btn-ghost text-xs" onClick={() => { const v = (u + 1) % 256; setBits(v.toString(2).padStart(8, '0').split('').map(Number)) }}><Icon name="add" className="text-[16px]" />Прибавить 1</button>
          <button className="btn-ghost text-xs" onClick={() => setBits(Array(8).fill(0))}>Сброс</button>
        </div>
        <p className="text-xs text-dim mt-2 text-center">Старший разряд весит −128. Чтобы сменить знак числа, инвертируй биты и прибавь 1.</p>
      </div>
      {!done && ti < TWOS_TASKS.length && (
        <div className="space-y-3">
          <Steps i={ti} total={TWOS_TASKS.length + 1} title={TWOS_TASKS[ti].title} />
          <button className="btn-primary" onClick={() => judge(TWOS_TASKS[ti].test(u), TWOS_TASKS[ti].test(u) ? TWOS_TASKS[ti].why : `Сейчас со знаком ${signed(u)}. Попробуй «инвертировать и прибавить 1».`)}><Icon name="fact_check" className="text-[18px]" />Проверить</button>
          <Feedback fb={fb} />
        </div>
      )}
      {!done && ti === TWOS_TASKS.length && (
        <div className="space-y-3">
          <Steps i={ti} total={TWOS_TASKS.length + 1} title="Поймай переполнение">Подбери два положительных 8-битных числа со знаком, сумма которых «перевернётся» в отрицательное.</Steps>
          <div className="card p-4 grid sm:grid-cols-2 gap-4">
            {[['A', a, setA], ['B', b, setB]].map(([l, v, set]) => (
              <label key={l as string} className="text-sm"><span className="font-mono">{l as string} = {v as number}</span>
                <input type="range" min={-128} max={127} value={v as number} onChange={(e) => { (set as (n: number) => void)(Number(e.target.value)); setPhase2(true) }} className="w-full accent-violet" /></label>
            ))}
            <div className="sm:col-span-2 font-mono text-sm rounded-lg bg-s2/60 p-3">
              {a} + {b} = <b>{sum}</b> в математике, но в байте получится <b className={overflow ? 'text-rose-soft' : 'text-teal-soft'}>{wrapped}</b>
              {overflow && <span className="chip bg-rose/15 text-rose-soft ml-2">переполнение</span>}
            </div>
          </div>
          <button className="btn-primary" disabled={!phase2} onClick={() => judge(a > 0 && b > 0 && overflow, a > 0 && b > 0 && overflow ? `Сумма ${sum} больше 127, поэтому старший бит стал единицей и число «стало» отрицательным: ${wrapped}. Процессор замечает это по флагу переполнения: у двух положительных слагаемых получился отрицательный результат.` : 'Нужны два положительных числа, сумма которых больше 127.')}><Icon name="fact_check" className="text-[18px]" />Проверить</button>
          <Feedback fb={fb} />
        </div>
      )}
      {done && <AllDone text="Отрицательные числа — это тот же сумматор, просто по-другому читаем старший бит." />}
    </div>
  )
}

// ─────────────────────────── Защёлка и триггер ───────────────────────────
function settleSR(s: number, r: number, q: number): [number, number] {
  let Q = q, Qn = 1 - q
  for (let i = 0; i < 4; i++) { const nQ = r || Qn ? 0 : 1; const nQn = s || nQ ? 0 : 1; Q = nQ; Qn = nQn }
  return [Q, Qn]
}
const LATCH_STEPS = [
  'Запиши 1: нажми S (установка), затем отпусти его',
  'Убедись, что защёлка помнит: S и R отпущены, а Q всё ещё 1. Теперь сбрось её в 0 кнопкой R и отпусти',
  'D-триггер: поставь D = 1 и подай один тактовый импульс',
  'Поменяй D на 0, но такт не подавай. Q не должен измениться',
]
export function LatchLab({ onDone }: LabProps) {
  const [S, setS] = useState(0)
  const [R, setR] = useState(0)
  const [q, setQ] = useState(0)
  const [D, setD] = useState(0)
  const [dq, setDq] = useState(0)
  const [clockCount, setClockCount] = useState(0)
  const [step_, setStep] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const [Q, Qn] = settleSR(S, R, q)
  const done = step_ >= LATCH_STEPS.length
  const advance = (cond: boolean) => { if (cond && step_ < LATCH_STEPS.length) { const n = step_ + 1; setStep(n); if (n === LATCH_STEPS.length) onDone(0) } }
  const press = (which: 'S' | 'R', v: number) => {
    const ns = which === 'S' ? v : S, nr = which === 'R' ? v : R
    const [nq] = settleSR(ns, nr, q)
    which === 'S' ? setS(v) : setR(v)
    setQ(nq)
    setLog((l) => [`S=${ns} R=${nr} → Q=${nq}`, ...l].slice(0, 6))
    if (step_ === 0 && which === 'S' && v === 0 && nq === 1) advance(true)
    if (step_ === 1 && which === 'R' && v === 0 && nq === 0) advance(true)
  }
  const tick = () => { setDq(D); setClockCount((c) => c + 1); if (step_ === 2 && D === 1) advance(true) }
  const setDval = (v: number) => { setD(v); if (step_ === 3 && v === 0 && dq === 1) advance(true) }
  const Lamp = ({ on, label }: { on: number; label: string }) => <div className="text-center"><div className={`w-12 h-12 rounded-full mx-auto grid place-items-center font-mono font-bold ${on ? 'bg-teal/25 text-teal-soft shadow-glow-teal' : 'bg-s2 text-dim'}`}>{on}</div><div className="text-xs text-dim mt-1">{label}</div></div>
  return (
    <div className="space-y-4">
      {!done ? <Steps i={step_} total={LATCH_STEPS.length} title={LATCH_STEPS[step_]} /> : <AllDone text="Схема с обратной связью помнит бит, а триггер с тактом запоминает его только в нужный момент. Из таких ячеек сделаны регистры." />}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="label mb-3">RS-защёлка на двух ИЛИ-НЕ</div>
          <svg viewBox="0 0 300 150" className="w-full h-auto">
            <path d="M40,40 H110 M40,110 H110" stroke="#64748B" strokeWidth="2" />
            <rect x="110" y="20" width="60" height="40" rx="8" fill="#111827" stroke="#6366F1" /><text x="140" y="45" textAnchor="middle" fontSize="12" fill="#C0C1FF">NOR</text>
            <rect x="110" y="90" width="60" height="40" rx="8" fill="#111827" stroke="#6366F1" /><text x="140" y="115" textAnchor="middle" fontSize="12" fill="#C0C1FF">NOR</text>
            <path d="M170,40 H240 M200,40 V70 L90,80 V100 H110" fill="none" stroke={Q ? '#4FDBC8' : '#334155'} strokeWidth="2.5" />
            <path d="M170,110 H240 M200,110 V80 L90,70 V52 H110" fill="none" stroke={Qn ? '#4FDBC8' : '#334155'} strokeWidth="2.5" strokeDasharray="5 3" />
            <text x="20" y="44" fontSize="13" fill={R ? '#4FDBC8' : '#94A3B8'}>R</text><text x="20" y="114" fontSize="13" fill={S ? '#4FDBC8' : '#94A3B8'}>S</text>
            <text x="250" y="44" fontSize="13" fill="#CBD5E1">Q</text><text x="250" y="114" fontSize="13" fill="#CBD5E1">Q̄</text>
          </svg>
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <Toggle on={!!S} label="S" sub={S ? 'нажата' : 'отпущ.'} onClick={() => press('S', 1 - S)} />
              <Toggle on={!!R} label="R" sub={R ? 'нажата' : 'отпущ.'} onClick={() => press('R', 1 - R)} />
            </div>
            <div className="flex gap-4"><Lamp on={Q} label="Q" /><Lamp on={Qn} label="Q̄" /></div>
          </div>
          {S && R ? <p className="text-xs text-rose-soft mt-2">S = R = 1 — запрещённое состояние: оба выхода 0, а после отпускания результат зависит от того, какая кнопка отпущена позже.</p> : null}
          <div className="font-mono text-[11px] text-dim mt-2">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
        <div className="card p-4">
          <div className="label mb-3">D-триггер с тактовым входом</div>
          <p className="text-sm text-mute">Выход Q копирует вход D только в момент такта. Между тактами D может меняться как угодно — Q держит старое значение.</p>
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-2">
              <Toggle on={!!D} label="D" sub={D} onClick={() => setDval(1 - D)} />
              <button onClick={tick} className="btn-secondary"><Icon name="timer" className="text-[18px]" />Такт ↑</button>
            </div>
            <Lamp on={dq} label="Q" />
          </div>
          <div className="text-xs text-dim mt-3 font-mono">тактов подано: {clockCount}</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Счётчик ───────────────────────────
export function CounterLab({ onDone }: LabProps) {
  const [n, setN] = useState(0)
  const [hist, setHist] = useState<number[]>([0])
  const [wrapped, setWrapped] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [fb, setFb] = useState<Fb>(null)
  const [mistakes, setMistakes] = useState(0)
  const tick = () => { const v = (n + 1) % 16; if (n === 15) setWrapped(true); setN(v); setHist((h) => [...h, v].slice(-24)) }
  const stage = !wrapped ? 0 : !answered ? 1 : 2
  return (
    <div className="space-y-4">
      {stage === 0 && <Steps i={0} total={2} title="Досчитай до 15 и подай ещё один такт">Каждый разряд — триггер, который переключается, когда младший сосед падает из 1 в 0.</Steps>}
      {stage === 1 && <Steps i={1} total={2} title="Посмотри на диаграмму: через сколько тактов старший разряд Q3 впервые становится 1?" />}
      {stage === 2 && <AllDone text="Каждый разряд делит частоту пополам: Q0 меняется каждый такт, Q1 — вдвое реже и так далее. Поэтому счётчик одновременно служит делителем частоты." />}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={tick} className="btn-primary"><Icon name="timer" className="text-[18px]" />Такт</button>
          <div className="flex gap-1.5 ml-auto">{[3, 2, 1, 0].map((b) => <Toggle key={b} on={!!((n >> b) & 1)} label={(n >> b) & 1} sub={`Q${b}`} onClick={() => undefined} />)}</div>
          <div className="font-mono text-2xl font-bold w-12 text-right">{n}</div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${60 + 24 * 24} 150`} className="w-full min-w-[520px] h-auto">
            {['CLK', 'Q0', 'Q1', 'Q2', 'Q3'].map((name, r) => {
              const y = 20 + r * 28
              const pts = name === 'CLK'
                ? hist.flatMap((_, i) => [[60 + i * 24, y + 10], [60 + i * 24, y - 6], [72 + i * 24, y - 6], [72 + i * 24, y + 10], [84 + i * 24, y + 10]])
                : hist.flatMap((v, i) => { const b = (v >> (r - 1)) & 1; const yy = b ? y - 6 : y + 10; return [[60 + i * 24, yy], [84 + i * 24, yy]] })
              return <g key={name}><text x={4} y={y + 6} fontSize="11" fontFamily="JetBrains Mono" fill={name === 'CLK' ? '#F59E0B' : '#4FDBC8'}>{name}</text><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={name === 'CLK' ? '#F59E0B' : '#4FDBC8'} strokeWidth="2" /></g>
            })}
          </svg>
        </div>
      </div>
      {stage === 1 && (
        <div className="space-y-2">
          <AnswerBox placeholder="Число тактов" onSubmit={(v) => { const ok = norm(v) === '8'; setFb({ ok, msg: ok ? 'Q3 весит 8, поэтому он впервые включается на 8-м такте.' : 'Посмотри на значение счётчика, когда Q3 впервые поднимается.' }); if (ok) { setAnswered(true); onDone(mistakes) } else setMistakes((m) => m + 1) }} />
          <Feedback fb={fb} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Память на 8 ячеек ───────────────────────────
const RAM_SECRET = 173
const RAM_TASKS = ['Запиши число 42 в ячейку с адресом 5', 'Запиши число 7 в ячейку 0', 'Прочитай ячейку 6 (её заполнил кто-то до тебя) и введи число, которое там лежит']
export function RamLab({ onDone }: LabProps) {
  const [mem, setMem] = useState<number[]>(() => { const m = Array(8).fill(0); m[6] = RAM_SECRET; return m })
  const [addr, setAddr] = useState<number[]>([0, 0, 0])
  const [data, setData] = useState<number[]>(Array(8).fill(0))
  const [outv, setOut] = useState<number | null>(null)
  const { ti, fb, judge, done } = useTasks(RAM_TASKS.length, onDone)
  const a = addr[0] * 4 + addr[1] * 2 + addr[2]
  const d = data.reduce((x, y) => x * 2 + y, 0)
  const write = () => {
    const m = [...mem]; m[a] = d; setMem(m)
    if (ti === 0) judge(m[5] === 42, m[5] === 42 ? 'Дешифратор выбрал строку 5, и только её регистр получил сигнал «запись».' : 'Проверь адрес и данные: адрес 5 = 101, число 42 = 00101010.')
    if (ti === 1) judge(m[0] === 7, m[0] === 7 ? 'Адрес 000 — ячейка 0.' : 'Адрес 0 — все три переключателя выключены, 7 = 00000111.')
  }
  return (
    <div className="space-y-4">
      {!done ? <Steps i={ti} total={RAM_TASKS.length} title={RAM_TASKS[ti]}>{ti < 2 ? 'Набери адрес (3 бита) и данные (8 бит), затем нажми «Записать».' : 'Набери адрес и нажми «Прочитать».'}</Steps> : <AllDone text="Память — это регистры плюс дешифратор, который по номеру выбирает один из них. В настоящем ОЗУ всё так же, только адресов миллиарды." />}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card p-4 space-y-4">
          <div><div className="label mb-2">Адрес · {a}</div><div className="flex gap-1.5">{addr.map((x, i) => <Toggle key={i} on={!!x} label={x} sub={2 ** (2 - i)} onClick={() => setAddr(addr.map((y, k) => (k === i ? 1 - y : y)))} />)}</div></div>
          <div><div className="label mb-2">Данные · {d}</div><div className="flex gap-1 flex-wrap">{data.map((x, i) => <Toggle key={i} on={!!x} label={x} sub={2 ** (7 - i)} onClick={() => setData(data.map((y, k) => (k === i ? 1 - y : y)))} />)}</div></div>
          <div className="flex gap-2">
            <button onClick={write} className="btn-primary"><Icon name="download" className="text-[18px]" />Записать</button>
            <button onClick={() => setOut(mem[a])} className="btn-secondary"><Icon name="upload" className="text-[18px]" />Прочитать</button>
            {outv !== null && <span className="font-mono self-center">выход: <b className="text-teal-soft">{outv}</b></span>}
          </div>
          {ti === 2 && !done && <AnswerBox placeholder="Что в ячейке 6?" onSubmit={(v) => judge(norm(v) === String(RAM_SECRET), norm(v) === String(RAM_SECRET) ? 'Чтение не меняет содержимое — его можно повторять сколько угодно.' : 'Набери адрес 110 и нажми «Прочитать».')} />}
          <Feedback fb={fb} />
        </div>
        <div className="card p-4">
          <div className="label mb-2">Дешифратор 3 → 8 и ячейки</div>
          <div className="space-y-1 font-mono text-sm">
            {mem.map((v, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-md px-2 py-1 ${i === a ? 'bg-violet/15' : ''}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${i === a ? 'bg-violet shadow-glow-violet' : 'bg-s3'}`} />
                <span className="text-dim w-10">{i.toString(2).padStart(3, '0')}</span>
                <span className="tracking-widest">{ti === 2 && i === 6 && outv === null ? '????????' : v.toString(2).padStart(8, '0')}</span>
                <span className="ml-auto text-dim">{ti === 2 && i === 6 && outv === null ? '?' : v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-dim mt-2">Ровно одна линия дешифратора активна — она открывает доступ к одной ячейке.</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Игрушечный процессор ───────────────────────────
const CPU_TASKS = [
  { title: 'Сложи M[0] и M[1], результат положи в M[2]', tests: [[5, 7], [20, 22]], check: (s: CpuState, m: number[]) => s.mem[2] === (m[0] + m[1]) % 256, start: 'LOAD 0\n', why: 'Три команды: загрузить, прибавить, сохранить. Плюс HALT, чтобы процессор остановился.' },
  { title: 'Умножь M[0] на M[1] повторным сложением, результат — в M[2]', tests: [[3, 4], [6, 5], [7, 0]], check: (s: CpuState, m: number[]) => s.mem[2] === (m[0] * m[1]) % 256, start: '; M[1] — счётчик: уменьшай его на 1 и прибавляй M[0] к M[2]\n', why: 'У процессора 8080 не было команды умножения — программисты делали именно так: цикл со счётчиком и условным переходом.' },
  { title: 'Обратный отсчёт: выведи (OUT) числа от M[0] до 1', tests: [[5], [3]], check: (s: CpuState, m: number[]) => s.out.join(',') === Array.from({ length: m[0] }, (_, i) => m[0] - i).join(','), start: 'LOAD 0\n', why: 'OUT, ADDI −1 и JNZ на начало цикла — так выглядят циклы на уровне машинных команд.' },
]
export function CpuLab({ onDone }: LabProps) {
  const [ti, setTi] = useState(0)
  const [src, setSrc] = useState(CPU_TASKS[0].start)
  const [mistakes, setMistakes] = useState(0)
  const [fb, setFb] = useState<Fb>(null)
  const t = CPU_TASKS[Math.min(ti, CPU_TASKS.length - 1)]
  const { prog, errors } = useMemo(() => parse(src), [src])
  const [st, setSt] = useState<CpuState>(() => initState(CPU_TASKS[0].tests[0]))
  const [phase, setPhase] = useState<'fetch' | 'exec'>('fetch')
  const reset = () => { setSt(initState(t.tests[0])); setPhase('fetch') }
  const stepOnce = () => {
    if (phase === 'fetch') { setPhase('exec'); return }
    setSt((s) => step(s, prog)); setPhase('fetch')
  }
  const check = () => {
    if (errors.length) { setFb({ ok: false, msg: errors[0] }); return }
    for (const m of t.tests) {
      const r = run(prog, m)
      if (r.error) { setFb({ ok: false, msg: r.error }); setMistakes((x) => x + 1); return }
      if (!t.check(r, m)) { setFb({ ok: false, msg: `На данных M = [${m.join(', ')}] получилось M[2] = ${r.mem[2]}, вывод: ${r.out.join(', ') || 'пусто'}. Пройди программу по шагам.` }); setMistakes((x) => x + 1); return }
    }
    setFb({ ok: true, msg: `Программа верна на всех ${t.tests.length} наборах данных. ${t.why}` })
    if (ti + 1 === CPU_TASKS.length) onDone(mistakes)
    setTimeout(() => { const n = ti + 1; setTi(n); setFb(null); if (n < CPU_TASKS.length) { setSrc(CPU_TASKS[n].start); setSt(initState(CPU_TASKS[n].tests[0])); setPhase('fetch') } }, 1800)
  }
  if (ti >= CPU_TASKS.length) return <AllDone text="Ты написал программы в машинных командах и увидел цикл «выборка — исполнение». Любая программа в итоге превращается в такие шаги." />
  const cur = prog[st.pc]
  return (
    <div className="space-y-4">
      <Steps i={ti} total={CPU_TASKS.length} title={t.title}>Данные для пошагового прогона: M = [{t.tests[0].join(', ')}]. Проверка запускает программу ещё и на других данных.</Steps>
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="card p-4 min-w-0">
          <div className="flex items-center gap-2 mb-2"><span className="label">Программа</span><span className="text-xs text-dim">одна команда в строке, номера строк — слева</span></div>
          <div className="flex rounded-lg border border-line bg-[#0A0E16] font-mono text-sm overflow-hidden">
            <div className="py-2 px-2 text-right text-dim select-none border-r border-line">{src.split('\n').map((_, i) => <div key={i} className={`leading-6 ${i === st.pc && !st.halted ? 'text-amber-soft font-bold' : ''}`}>{i}</div>)}</div>
            <textarea value={src} onChange={(e) => { setSrc(e.target.value); setFb(null) }} spellCheck={false} aria-label="Код программы" className="flex-1 bg-transparent py-2 px-3 leading-6 outline-none resize-y min-h-[200px] text-ink" />
          </div>
          {errors.length > 0 && <div className="text-xs text-rose-soft mt-2">{errors[0]}</div>}
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={stepOnce} disabled={st.halted || errors.length > 0} className="btn-secondary"><Icon name="skip_next" className="text-[18px]" />{phase === 'fetch' ? 'Выборка' : 'Исполнение'}</button>
            <button onClick={() => { setSt(run(prog, t.tests[0])); setPhase('fetch') }} disabled={errors.length > 0} className="btn-ghost"><Icon name="fast_forward" className="text-[18px]" />До конца</button>
            <button onClick={reset} className="btn-ghost"><Icon name="restart_alt" className="text-[18px]" />Сброс</button>
            <button onClick={check} className="btn-primary ml-auto"><Icon name="fact_check" className="text-[18px]" />Проверить</button>
          </div>
          <div className="mt-3 rounded-lg bg-s2/60 p-3 text-sm">
            {st.halted ? <span className="text-teal-soft">Процессор остановлен (HALT) за {st.steps} шагов.</span>
              : phase === 'exec' && cur ? <>Выбрана команда <b className="font-mono text-amber-soft">{cur.op}{OPS[cur.op].arg === 'none' ? '' : ' ' + cur.arg}</b> из строки {st.pc}: {OPS[cur.op].desc}</>
                : <>Следующая выборка: строка <b className="font-mono">{st.pc}</b> — процессор прочитает команду по адресу из счётчика команд.</>}
          </div>
          <Feedback fb={fb} />
        </div>
        <div className="space-y-4">
          <div className="card p-4 font-mono text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-s2/60 p-2"><div className="text-[10px] text-dim">PC</div><div className="text-amber-soft text-lg">{st.pc}</div></div>
              <div className="rounded-lg bg-s2/60 p-2"><div className="text-[10px] text-dim">ACC</div><div className="text-teal-soft text-lg">{st.acc}</div></div>
              <div className="rounded-lg bg-s2/60 p-2"><div className="text-[10px] text-dim">Z</div><div className="text-lg">{st.acc === 0 ? 1 : 0}</div></div>
            </div>
            <div className="label mt-3 mb-1">Память данных</div>
            <div className="grid grid-cols-4 gap-1">{st.mem.map((v, i) => <div key={i} className={`rounded px-1.5 py-1 text-center ${v ? 'bg-violet/15' : 'bg-s2/40'}`}><div className="text-[9px] text-dim">M{i}</div>{v}</div>)}</div>
            <div className="label mt-3 mb-1">Вывод</div>
            <div className="min-h-[1.5rem] text-teal-soft">{st.out.join(' ') || '—'}</div>
          </div>
          <div className="card p-4">
            <div className="label mb-2">Команды</div>
            <ul className="space-y-1 text-xs">{Object.entries(OPS).map(([k, v]) => <li key={k}><b className="font-mono text-violet-soft">{k}{v.arg === 'none' ? '' : v.arg === 'addr' ? ' a' : v.arg === 'num' ? ' n' : ' строка'}</b> <span className="text-mute">— {v.desc}</span></li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── float32 ───────────────────────────
const f32bits = (x: number) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x); return dv.getUint32(0) }
const FLOAT_TASKS = [
  { title: 'Введи 1 в поле выше. Чему равен «сырой» порядок (8 бит экспоненты) в десятичном виде?', a: '127', why: 'Порядок хранится со смещением 127: 1 = 1,0 × 2⁰, значит записано 0 + 127.' },
  { title: 'Какой бит знака у числа −2,5?', a: '1', why: 'Знак — отдельный бит: 0 — плюс, 1 — минус. Остальное у 2,5 и −2,5 одинаковое.' },
  { title: 'Введи 0.1. Какое число на самом деле хранится в float32? Введи первые 10 знаков после запятой', a: '0.1000000015', why: '0,1 в двоичной системе — бесконечная дробь (как 1/3 в десятичной), поэтому хранится ближайшее представимое число. Из-за этого 0,1 + 0,2 ≠ 0,3.' },
]
export function FloatLab({ onDone }: LabProps) {
  const [x, setX] = useState('0.1')
  const { ti, fb, judge, done } = useTasks(FLOAT_TASKS.length, onDone)
  const num = Number(x.replace(',', '.'))
  const valid = x.trim() !== '' && Number.isFinite(num)
  const b = valid ? f32bits(num) : 0
  const sign = b >>> 31, exp = (b >>> 23) & 255, man = b & 0x7fffff
  const bits = b.toString(2).padStart(32, '0')
  const stored = Math.fround(num)
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label" htmlFor="f-in">Число</label>
        <input id="f-in" className="input mt-2 font-mono text-lg" value={x} onChange={(e) => setX(e.target.value)} />
        {valid && (
          <>
            <div className="flex flex-wrap gap-0.5 mt-4 font-mono text-sm">
              {bits.split('').map((c, i) => <span key={i} className={`w-5 h-7 grid place-items-center rounded ${i === 0 ? 'bg-rose/20 text-rose-soft' : i < 9 ? 'bg-amber/15 text-amber-soft' : 'bg-violet/15 text-violet-soft'}`}>{c}</span>)}
            </div>
            <div className="grid sm:grid-cols-3 gap-2 mt-3 text-sm">
              <div className="rounded-lg bg-rose/5 border border-rose/20 p-2"><div className="text-[11px] text-dim">знак · 1 бит</div><div className="font-mono">{sign} → {sign ? 'минус' : 'плюс'}</div></div>
              <div className="rounded-lg bg-amber/5 border border-amber/20 p-2"><div className="text-[11px] text-dim">порядок · 8 бит</div><div className="font-mono">{exp} − 127 = {exp === 0 ? '(особый случай)' : exp - 127}</div></div>
              <div className="rounded-lg bg-violet/5 border border-violet/20 p-2"><div className="text-[11px] text-dim">мантисса · 23 бита</div><div className="font-mono">1,{man.toString(2).padStart(23, '0').replace(/0+$/, '') || '0'}₂</div></div>
            </div>
            <div className="mt-3 text-sm font-mono rounded-lg bg-s2/60 p-3">хранится на самом деле: <b className="text-teal-soft break-all">{stored.toPrecision(20).replace(/0+$/, '')}</b></div>
          </>
        )}
        <div className="mt-3 text-sm font-mono rounded-lg border border-line p-3">0.1 + 0.2 в обычных числах JavaScript (float64) = <b className="text-rose-soft">{String(0.1 + 0.2)}</b></div>
      </div>
      {!done ? (
        <div className="space-y-3">
          <Steps i={ti} total={FLOAT_TASKS.length} title={FLOAT_TASKS[ti].title} />
          <AnswerBox onSubmit={(v) => { const ok = norm(v).startsWith(FLOAT_TASKS[ti].a) && (ti !== 2 || norm(v).length >= 12); judge(ok, ok ? FLOAT_TASKS[ti].why : 'Посмотри на разбор числа над заданием.') }} />
          <Feedback fb={fb} />
        </div>
      ) : <AllDone text="Число с плавающей точкой — это двоичная «научная запись»: знак, порядок и мантисса. Точность конечна, поэтому деньги считают в целых копейках." />}
    </div>
  )
}
