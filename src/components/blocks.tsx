import { useMemo, useState } from 'react'
import { LAYERS } from '../data/networks'
import { Icon, Md } from './ui'
import { aiErrorText, useAi } from '../ai/AiContext'
import { offlineChannel } from '../ai/channels'
import { useStore } from '../store'

// Каждый блок сообщает onDone(), когда пользователь выполнил его — урок
// открывает следующий блок. Это «примитивы», из которых собираются уроки.

export function AnalogyBlock({ title, md }: { title: string; md: string }) {
  return (
    <div className="rounded-lg border border-amber/25 bg-amber/5 p-4 md:p-5 flex gap-3">
      <Icon name="lightbulb" className="text-amber-soft text-[22px] shrink-0" />
      <div>
        <div className="font-semibold text-amber-soft text-sm">{title}</div>
        <p className="text-[15px] leading-7 text-ink/90 mt-1"><Md text={md} /></p>
      </div>
    </div>
  )
}

export function LayersBlock() {
  const [sel, setSel] = useState(0)
  const L = LAYERS[sel]
  return (
    <div className="rounded-lg border border-line bg-[#0A0E16] p-4 md:p-5">
      <div className="label mb-3 flex items-center gap-2"><Icon name="touch_app" className="text-[16px]" />Интерактивная схема · нажимай на слои</div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {LAYERS.map((l, i) => (
            <button key={l.name} onClick={() => setSel(i)}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${i === sel ? 'bg-s2' : 'border-line hover:bg-s1'}`}
              style={{ borderColor: i === sel ? l.color : undefined }}>
              <span className="font-mono text-xs w-5 text-dim">{4 - i}</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="flex-1 font-semibold text-sm">{l.name} <span className="text-dim font-normal">· {l.en}</span></span>
              <span className="text-[11px] text-dim">{l.examples}</span>
            </button>
          ))}
          <div className="rounded-lg bg-s1 p-3 text-sm pop" key={sel}>
            <div className="text-mute">{L.job}</div>
            <div className="text-xs text-dim mt-2">Единица данных: <span style={{ color: L.color }} className="font-semibold">{L.pdu}</span></div>
          </div>
        </div>
        <div>
          <div className="text-xs text-dim mb-2">Как выглядит {L.pdu.toLowerCase()} на этом слое:</div>
          <div className="font-mono text-[11px] md:text-xs">
            {(() => {
              // строим вложенные «конверты» снизу вверх до выбранного слоя
              let inner = <div className="rounded-md border border-dashed border-violet-soft/60 p-2 text-violet-soft">данные: «покажи страницу»</div>
              for (let i = 0; i <= sel; i++) {
                const l = LAYERS[i]
                inner = (
                  <div className="rounded-md border p-2 pop" style={{ borderColor: l.color, background: `${l.color}10` }}>
                    <div className="mb-1.5 truncate" style={{ color: l.color }}>[{l.header}]</div>
                    {inner}
                  </div>
                )
              }
              return inner
            })()}
          </div>
          <p className="text-xs text-dim mt-3">Каждый слой добавляет свой заголовок снаружи. Выбери «Канальный» — увидишь полный кадр, который реально уходит в провод.</p>
        </div>
      </div>
    </div>
  )
}

export function QuizBlock({ q, options, correct, explain, onDone }: { q: string; options: string[]; correct: number; explain: string; onDone: (ok: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const answered = pick === correct
  return (
    <div className="rounded-lg border border-violet/30 bg-violet/5 p-4 md:p-5">
      <div className="label text-violet-soft mb-2 flex items-center gap-1.5"><Icon name="quiz" className="text-[16px]" />Проверь себя</div>
      <div className="font-semibold"><Md text={q} /></div>
      <div className="grid gap-2 mt-3">
        {options.map((o, i) => {
          const isPick = pick === i
          const cls = isPick ? (i === correct ? 'border-teal bg-teal/10' : 'border-rose bg-rose/10') : 'border-line hover:border-s3'
          return (
            <button key={o} disabled={answered} onClick={() => {
              setPick(i); setTries((t) => t + 1)
              if (i === correct) onDone(tries === 0)
            }} className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors flex items-center gap-3 ${cls}`}>
              <span className="w-6 h-6 rounded-md bg-s2 grid place-items-center font-mono text-xs shrink-0">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{o}</span>
              {isPick && <Icon name={i === correct ? 'check_circle' : 'cancel'} fill className={i === correct ? 'text-teal-soft' : 'text-rose-soft'} />}
            </button>
          )
        })}
      </div>
      {pick !== null && (
        <div className={`mt-3 rounded-lg p-3 text-sm pop ${answered ? 'bg-teal/10 text-ink' : 'bg-rose/10'}`}>
          {answered ? <><b className="text-teal-soft">Верно{tries === 1 ? ' с первой попытки!' : '.'}</b> <Md text={explain} /></> : 'Не совсем. Перечитай объяснение выше и попробуй ещё раз.'}
        </div>
      )}
    </div>
  )
}

export function OrderBlock({ q, items, explain, onDone }: { q: string; items: string[]; explain: string; onDone: () => void }) {
  const shuffled = useMemo(() => {
    const a = [...items]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    if (a.every((x, i) => x === items[i])) a.reverse()
    return a
  }, [items])
  const [seq, setSeq] = useState<string[]>([])
  const [wrong, setWrong] = useState(false)
  const done = seq.length === items.length && !wrong

  const click = (it: string) => {
    if (done || seq.includes(it)) return
    if (items[seq.length] !== it) { setWrong(true); window.setTimeout(() => setWrong(false), 700); return }
    const next = [...seq, it]
    setSeq(next)
    if (next.length === items.length) onDone()
  }

  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 md:p-5">
      <div className="label text-teal-soft mb-2 flex items-center gap-1.5"><Icon name="format_list_numbered" className="text-[16px]" />Расставь по порядку</div>
      <div className="font-semibold">{q}</div>
      <div className="flex flex-wrap gap-2 mt-3">
        {shuffled.map((it) => {
          const idx = seq.indexOf(it)
          return (
            <button key={it} onClick={() => click(it)} disabled={idx >= 0}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${idx >= 0 ? 'border-teal bg-teal/15 text-teal-soft' : wrong ? 'border-rose/60' : 'border-s3 hover:border-teal'}`}>
              {idx >= 0 && <span className="font-mono mr-1.5">{idx + 1}.</span>}{it}
            </button>
          )
        })}
      </div>
      {wrong && <div className="text-sm text-rose-soft mt-3">Этот элемент не следующий — попробуй другой.</div>}
      {done && <div className="mt-3 rounded-lg bg-teal/10 p-3 text-sm pop"><b className="text-teal-soft">Отлично!</b> <Md text={explain} /></div>}
    </div>
  )
}

export function FeynmanBlock({ prompt, keywords, topic, onDone }: { prompt: string; keywords: string[]; topic?: string; onDone: (text: string) => void }) {
  const ai = useAi()
  const s = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [fb, setFb] = useState<null | { ok: boolean; msg: string; score?: number; missing?: string[]; by: string }>(null)
  const check = async () => {
    if (text.trim().length < 20) { setFb({ ok: false, msg: 'Слишком коротко. Попробуй 2–3 предложения, как будто объясняешь другу.', by: '' }); return }
    setBusy(true); setFb(null)
    let channel = ai.channel
    let v
    try {
      v = await channel.grade(ai.learner(topic ? { title: topic, summary: prompt } : undefined), { prompt, keyIdeas: keywords, answer: text.trim() })
    } catch (e) {
      // ИИ недоступен — проверяем быстро по ключевым словам, чтобы урок не застревал
      channel = offlineChannel
      v = await offlineChannel.grade(ai.learner(), { prompt, keyIdeas: keywords, answer: text.trim() })
      s.notify(aiErrorText(e))
    } finally { setBusy(false) }
    if (v.insight) s.remember(v.insight)
    setFb({ ok: v.understood, msg: v.feedback, score: v.score, missing: v.missing, by: channel.label })
    if (v.understood) onDone(text.trim())
  }
  return (
    <div className="rounded-lg border border-line bg-s1 p-4 md:p-5">
      <div className="label mb-2 flex items-center gap-1.5 text-violet-soft"><Icon name="record_voice_over" className="text-[16px]" />Метод Фейнмана · объясни сам</div>
      <div className="font-semibold">{prompt}</div>
      <textarea className="input mt-3 min-h-[100px]" value={text} onChange={(e) => { setText(e.target.value); if (!fb?.ok) setFb(null) }} placeholder="Пиши простыми словами…" disabled={fb?.ok || busy} aria-label="Твоё объяснение" />
      <div className="flex items-center justify-between mt-3 gap-3">
        <span className="text-xs text-dim flex items-center gap-1"><Icon name="smart_toy" className="text-[16px]" />Проверит ИИ-наставник по смыслу</span>
        {!fb?.ok && <button onClick={check} disabled={busy} className="btn-secondary !py-2">{busy ? 'Наставник читает…' : 'Проверить'}</button>}
      </div>
      {fb && (
        <div className={`mt-3 rounded-lg p-3 text-sm pop ${fb.ok ? 'bg-teal/10' : 'bg-amber/10'}`}>
          <div className="flex items-center justify-between gap-2">
            <b className={fb.ok ? 'text-teal-soft' : 'text-amber-soft'}>{fb.ok ? 'Понятно объяснено' : 'Пока не хватает'}</b>
            {fb.score !== undefined && fb.by && <span className="font-mono text-xs text-dim">{fb.score}/100 · {fb.by}</span>}
          </div>
          <p className="mt-1">{fb.msg}</p>
          {!fb.ok && fb.missing && fb.missing.length > 0 && <ul className="mt-2 text-xs text-mute list-disc pl-4">{fb.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          {!fb.ok && <button onClick={() => ai.openMentor(`Я пытаюсь объяснить: «${prompt}». Мой вариант: «${text.trim()}». Что я упускаю?`)} className="text-xs text-violet-soft hover:underline mt-2">Разобрать с наставником</button>}
        </div>
      )}
    </div>
  )
}

export function TermsBlock({ items }: { items: { term: string; def: string }[] }) {
  return (
    <div className="rounded-lg border border-line p-4 md:p-5">
      <div className="label mb-3">Словарик урока</div>
      <dl className="grid sm:grid-cols-2 gap-3">
        {items.map((t) => (
          <div key={t.term} className="rounded-lg bg-s1 p-3">
            <dt className="font-semibold text-sm text-violet-soft">{t.term}</dt>
            <dd className="text-sm text-mute mt-1">{t.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const normAns = (x: string) => x.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.').replace(/^0x/, '')

export function NumericBlock({ q, answer, accept = [], hint, explain, onDone }: { q: string; answer: string; accept?: string[]; hint?: string; explain: string; onDone: (ok: boolean) => void }) {
  const [v, setV] = useState('')
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(false)
  const [wrong, setWrong] = useState(false)
  const submit = () => {
    if (!v.trim() || ok) return
    const good = [answer, ...accept].map(normAns).includes(normAns(v))
    setTries((t) => t + 1)
    if (good) { setOk(true); setWrong(false); onDone(tries === 0) } else setWrong(true)
  }
  return (
    <div className="rounded-lg border border-violet/30 bg-violet/5 p-4 md:p-5">
      <div className="label text-violet-soft mb-2 flex items-center gap-1.5"><Icon name="calculate" className="text-[16px]" />Посчитай</div>
      <div className="font-semibold"><Md text={q} /></div>
      <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input className="input font-mono" value={v} onChange={(e) => { setV(e.target.value); setWrong(false) }} disabled={ok} placeholder="Ответ" aria-label="Ответ" />
        {!ok && <button className="btn-secondary shrink-0">Проверить</button>}
      </form>
      {wrong && <div className="mt-3 rounded-lg p-3 text-sm bg-rose/10 pop">Не сходится.{hint ? <> Подсказка: <Md text={hint} /></> : ' Пересчитай по шагам из объяснения выше.'}{tries >= 2 && <button type="button" onClick={() => { setV(answer); }} className="text-violet-soft hover:underline ml-2">Показать ответ</button>}</div>}
      {ok && <div className="mt-3 rounded-lg p-3 text-sm bg-teal/10 pop"><b className="text-teal-soft">Верно{tries === 1 ? ' с первой попытки!' : '.'}</b> <Md text={explain} /></div>}
    </div>
  )
}

export function TruthBlock({ q, inputs, output, values, explain, onDone }: { q: string; inputs: string[]; output: string; values: number[]; explain: string; onDone: (ok: boolean) => void }) {
  const rows = Array.from({ length: 2 ** inputs.length }, (_, i) => inputs.map((_, k) => (i >> (inputs.length - 1 - k)) & 1))
  const [cells, setCells] = useState<(number | null)[]>(rows.map(() => null))
  const [checked, setChecked] = useState(false)
  const [tries, setTries] = useState(0)
  const ok = checked && cells.every((c, i) => c === values[i])
  const check = () => {
    const good = cells.every((c, i) => c === values[i])
    setChecked(true); setTries((t) => t + 1)
    if (good) onDone(tries === 0)
  }
  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 md:p-5">
      <div className="label text-teal-soft mb-2 flex items-center gap-1.5"><Icon name="table_chart" className="text-[16px]" />Заполни таблицу истинности</div>
      <div className="font-semibold"><Md text={q} /></div>
      <table className="mt-3 font-mono text-sm">
        <thead><tr className="text-dim text-xs">{inputs.map((i) => <th key={i} className="px-3 py-1 text-left">{i}</th>)}<th className="px-3 py-1 text-left text-amber-soft">{output}</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className="border-t border-line">
            {r.map((b, k) => <td key={k} className="px-3 py-1.5">{b}</td>)}
            <td className="px-2 py-1">
              <button disabled={ok} onClick={() => { setChecked(false); setCells(cells.map((c, k) => (k === i ? (c === 1 ? 0 : 1) : c))) }}
                className={`w-9 h-8 rounded-md border font-bold ${cells[i] === null ? 'border-line text-dim' : checked ? (cells[i] === values[i] ? 'border-teal text-teal-soft' : 'border-rose text-rose-soft') : 'border-s3'}`}>{cells[i] ?? '?'}</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
      {!ok && <button onClick={check} disabled={cells.some((c) => c === null)} className="btn-secondary !py-2 mt-3">Проверить</button>}
      {checked && !ok && <div className="mt-3 rounded-lg p-3 text-sm bg-rose/10 pop">Красные клетки неверны — нажми на них, чтобы поменять.</div>}
      {ok && <div className="mt-3 rounded-lg p-3 text-sm bg-teal/10 pop"><b className="text-teal-soft">Верно{tries === 1 ? ' с первой попытки!' : '.'}</b> <Md text={explain} /></div>}
    </div>
  )
}

export function CodeBlock({ title, code }: { title?: string; code: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#0A0E16] overflow-hidden">
      {title && <div className="px-4 py-2 border-b border-line text-xs text-dim flex items-center gap-1.5"><Icon name="code" className="text-[16px]" />{title}</div>}
      <pre className="p-4 text-[13px] leading-6 font-mono text-ink/90 overflow-x-auto">{code}</pre>
    </div>
  )
}
