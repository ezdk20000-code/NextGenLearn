import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NEGOTIATION_SCENARIO as SC, type ScenarioChoice } from '../data/negotiation'
import { useStore } from '../store'
import { Icon } from '../components/ui'

const CONF = ['Интуитивно', 'Обдуманно', 'Уверен'] as const
const START = { trust: 40, value: 50 }

interface Turn { step: number; choice: ScenarioChoice; conf: number }

export default function NegotiationLab() {
  const s = useStore()
  const [turns, setTurns] = useState<Turn[]>([])
  const [pick, setPick] = useState<number | null>(null)
  const [conf, setConf] = useState(1)
  const [revealed, setRevealed] = useState(false)

  const step = turns.length - (revealed ? 1 : 0)
  const finished = turns.length === SC.steps.length && revealed
  const cur = SC.steps[Math.min(step, SC.steps.length - 1)]
  const trust = Math.max(0, Math.min(100, START.trust + turns.reduce((a, t) => a + t.choice.trust, 0)))
  const value = Math.max(0, Math.min(100, START.value + turns.reduce((a, t) => a + t.choice.value, 0)))
  const best = turns.filter((t) => t.choice.verdict === 'best').length
  const deal = trust >= 40 && value >= 50
  // Калибровка: насколько уверенность совпала с качеством ответа
  const calibrated = turns.filter((t) => (t.choice.verdict === 'best') === (t.conf >= 1)).length

  const submit = () => {
    if (pick === null) return
    const choice = cur.choices[pick]
    const next = [...turns, { step, choice, conf }]
    setTurns(next)
    setRevealed(true)
    if (next.length === SC.steps.length) {
      const fT = Math.max(0, Math.min(100, START.trust + next.reduce((a, t) => a + t.choice.trust, 0)))
      const fV = Math.max(0, Math.min(100, START.value + next.reduce((a, t) => a + t.choice.value, 0)))
      if (fT >= 40 && fV >= 50) s.completeLab('negotiation', 'n-batna', 80 + next.filter((t) => t.choice.verdict === 'best').length * 15, next.filter((t) => t.choice.verdict === 'bad').length)
    }
  }
  const nextStep = () => { setRevealed(false); setPick(null); setConf(1) }
  const restart = () => { setTurns([]); setPick(null); setConf(1); setRevealed(false) }
  const last = turns[turns.length - 1]

  return (
    <div>
      <Link to="/labs" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Лаборатории</Link>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="chip bg-amber/15 text-amber-soft">Высокие ставки</span>
        <span className="chip bg-s2 text-mute">Шаг {Math.min(step + 1, SC.steps.length)} из {SC.steps.length}</span>
      </div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">Переговоры о стратегическом партнёрстве</h1>
          <p className="text-mute mt-1 text-sm md:text-base max-w-3xl">{SC.brief}</p>
        </div>
        <button onClick={restart} className="btn-ghost shrink-0"><Icon name="restart_alt" className="text-[18px]" />Заново</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* Реплика оппонента */}
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <img src="covers/viktor.webp" alt="Виктор К." className="w-12 h-12 rounded-full object-cover border border-amber/40" />
              <div className="flex-1"><div className="font-semibold">{cur.speaker}</div><div className="text-xs text-dim">{cur.role}</div></div>
              <span className="chip bg-rose/10 text-rose-soft border border-rose/30">{cur.mood}</span>
            </div>
            <blockquote className="mt-4 text-lg leading-8 border-l-2 border-amber/60 pl-4 pop" key={step}>{cur.line}</blockquote>
          </div>

          {!finished && !revealed && (
            <div className="card p-5 pop" key={`q${step}`}>
              <div className="font-semibold">{cur.question}</div>
              <div className="grid gap-2 mt-4">
                {cur.choices.map((c, i) => (
                  <button key={c.label} onClick={() => setPick(i)}
                    className={`text-left rounded-lg border p-4 transition-colors ${pick === i ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'}`}>
                    <div className="flex items-center gap-2 text-xs"><span className="w-6 h-6 rounded-md bg-s2 grid place-items-center font-mono font-bold">{c.label}</span><span className="text-dim">{c.approach}</span></div>
                    <div className="mt-2 text-[15px] leading-relaxed">{c.text}</div>
                  </button>
                ))}
              </div>
              <div className="mt-5">
                <div className="label mb-2">Насколько ты уверен в ответе?</div>
                <div className="flex rounded-lg bg-[#0A0E16] border border-line p-1">
                  {CONF.map((c, i) => <button key={c} onClick={() => setConf(i)} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${conf === i ? 'bg-s2 text-ink' : 'text-dim'}`}>{c}</button>)}
                </div>
              </div>
              <button onClick={submit} disabled={pick === null} className="btn-primary w-full mt-4">Ответить</button>
            </div>
          )}

          {revealed && last && (
            <div className={`card p-5 pop border ${last.choice.verdict === 'best' ? 'border-teal/40' : last.choice.verdict === 'ok' ? 'border-amber/40' : 'border-rose/40'}`}>
              <div className="flex items-center gap-2">
                <Icon name={last.choice.verdict === 'best' ? 'verified' : last.choice.verdict === 'ok' ? 'info' : 'error'} fill
                  className={last.choice.verdict === 'best' ? 'text-teal-soft' : last.choice.verdict === 'ok' ? 'text-amber-soft' : 'text-rose-soft'} />
                <div className="font-semibold">Разбор наставника · {last.choice.approach}</div>
              </div>
              <p className="text-sm text-ink/90 mt-2 leading-relaxed">{last.choice.feedback}</p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <Delta label="Доверие" v={last.choice.trust} />
                <Delta label="Выгода" v={last.choice.value} />
                {last.choice.verdict !== 'best' && (() => {
                  const b = SC.steps[last.step].choices.find((c) => c.verdict === 'best')!
                  return <span className="text-dim">Сильнейший ход: вариант {b.label} — {b.approach.toLowerCase()}</span>
                })()}
              </div>
              {!finished && <button onClick={nextStep} className="btn-primary mt-4">Следующая реплика <Icon name="arrow_forward" className="text-[18px]" /></button>}
            </div>
          )}

          {finished && (
            <div className={`card p-6 pop text-center ${deal ? 'shadow-glow-teal' : ''}`}>
              <Icon name={deal ? 'handshake' : 'heart_broken'} className={`text-[40px] ${deal ? 'text-teal-soft' : 'text-rose-soft'}`} />
              <h2 className="text-xl font-bold mt-2">{deal ? 'Сделка заключена' : 'Сделка сорвалась'}</h2>
              <p className="text-sm text-mute mt-2 max-w-lg mx-auto">{deal
                ? `Сильных ходов: ${best} из ${SC.steps.length}. Ты сохранил отношения и выгоду — Виктор подписал соглашение.`
                : 'Доверие или выгода упали слишком низко. Попробуй искать интересы за требованиями и опираться на BATNA.'}</p>
              <div className="grid grid-cols-3 gap-3 mt-5 max-w-md mx-auto">
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-teal-soft">{trust}</div><div className="text-[11px] text-dim">доверие</div></div>
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-violet-soft">{value}</div><div className="text-[11px] text-dim">выгода</div></div>
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-amber-soft">{calibrated}/{SC.steps.length}</div><div className="text-[11px] text-dim">калибровка</div></div>
              </div>
              <div className="flex gap-2 justify-center mt-5">
                <button onClick={restart} className="btn-secondary">Пройти ещё раз</button>
                <Link to="/track/negotiation" className="btn-teal">К древу знаний</Link>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3">Состояние переговоров</div>
            <Meter label="Доверие" v={trust} tone="teal" />
            <Meter label="Выгода для тебя" v={value} tone="violet" />
            <div className="text-xs text-dim mt-3">Сделка состоится, если доверие ≥ 40 и выгода ≥ 50.</div>
          </div>
          <div className="card p-4">
            <div className="label mb-2 text-amber-soft">Твоя BATNA</div>
            <p className="text-sm text-mute">{SC.batna}</p>
          </div>
          <div className="card p-4">
            <div className="label mb-2">Ходы</div>
            <ol className="space-y-1.5 text-sm">
              {SC.steps.map((st, i) => {
                const t = turns[i]
                return (
                  <li key={i} className="flex items-center gap-2">
                    <Icon name={!t ? 'radio_button_unchecked' : t.choice.verdict === 'best' ? 'check_circle' : t.choice.verdict === 'ok' ? 'remove_circle' : 'cancel'} fill={!!t}
                      className={`text-[18px] ${!t ? 'text-dim' : t.choice.verdict === 'best' ? 'text-teal-soft' : t.choice.verdict === 'ok' ? 'text-amber-soft' : 'text-rose-soft'}`} />
                    <span className={t ? 'text-mute' : 'text-dim'}>{st.mood}</span>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="card p-4 text-xs text-mute leading-relaxed">
            <div className="label mb-2">Калибровка уверенности</div>
            Ты отмечаешь, насколько уверен в ответе. Хорошо откалиброванный переговорщик уверен, когда прав, и сомневается, когда ошибается.
          </div>
        </aside>
      </div>
    </div>
  )
}

function Delta({ label, v }: { label: string; v: number }) {
  if (!v) return <span className="chip bg-s2 text-dim">{label} ±0</span>
  return <span className={`chip ${v > 0 ? 'bg-teal/10 text-teal-soft' : 'bg-rose/10 text-rose-soft'}`}>{label} {v > 0 ? '+' : ''}{v}</span>
}

function Meter({ label, v, tone }: { label: string; v: number; tone: 'teal' | 'violet' }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1.5"><span className="text-mute">{label}</span><span className="font-mono font-semibold">{v}</span></div>
      <div className="h-2 rounded-full bg-s2 overflow-hidden"><div className={`h-full rounded-full ${tone === 'teal' ? 'bg-teal' : 'bg-violet'}`} style={{ width: `${v}%`, transition: 'width .5s ease' }} /></div>
    </div>
  )
}
