import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_SRS, useStore } from '../store'
import { DEFAULT_W } from '../lib/fsrs'
import { simulateWorkload } from '../lib/simulate'
import { BarChart } from '../components/charts'
import { Icon, PageHeader } from '../components/ui'

const MAX_OPTIONS = [{ v: 365, t: '1 год' }, { v: 1095, t: '3 года' }, { v: 36500, t: 'Без ограничений' }]
const W_GROUPS = [
  { r: [0, 4], t: 'Начальная стабильность для оценок Снова / Трудно / Хорошо / Легко' },
  { r: [4, 8], t: 'Начальная сложность, шаг и возврат сложности' },
  { r: [8, 11], t: 'Рост стабильности после успешного вспоминания' },
  { r: [11, 15], t: 'Стабильность после забывания' },
  { r: [15, 17], t: 'Штраф за «Трудно» и бонус за «Легко»' },
  { r: [17, 20], t: 'Повторения в тот же день' },
  { r: [20, 21], t: 'Форма кривой забывания' },
]

export default function FsrsSettings() {
  const s = useStore()
  const [retention, setRetention] = useState(s.srs.requestRetention)
  const [maxI, setMaxI] = useState(s.srs.maximumInterval)
  const [newPerDay, setNewPerDay] = useState(s.srs.newPerDay)
  const [reviewsPerDay, setReviewsPerDay] = useState(s.srs.reviewsPerDay)
  const [simNew, setSimNew] = useState(5)
  const dirty = retention !== s.srs.requestRetention || maxI !== s.srs.maximumInterval || newPerDay !== s.srs.newPerDay || reviewsPerDay !== s.srs.reviewsPerDay

  const cards = useMemo(() => Object.values(s.cards), [s.cards])
  const sim = useMemo(() => simulateWorkload(cards, { w: DEFAULT_W, requestRetention: retention, maximumInterval: maxI }, { days: 30, newPerDay: simNew }), [cards, retention, maxI, simNew])
  const compare = useMemo(() => [0.8, 0.85, 0.9, 0.95].map((r) => ({ r, ...simulateWorkload(cards, { w: DEFAULT_W, requestRetention: r, maximumInterval: maxI }, { days: 30, newPerDay: simNew, runs: 2 }) })), [cards, maxI, simNew])
  const minutes = Math.round(sim.avgPerDay * 8 / 60) // ~8 секунд на карточку

  return (
    <div>
      <Link to="/cards" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Флеш-карты</Link>
      <PageHeader eyebrow="Настройки движка · FSRS-6" title="Параметры повторения"
        sub="Главная настройка — какую долю материала ты хочешь помнить. Чем выше цель, тем чаще придётся повторять. График ниже пересчитывается сразу."
        right={
          <div className="flex gap-2">
            <button onClick={() => { setRetention(DEFAULT_SRS.requestRetention); setMaxI(DEFAULT_SRS.maximumInterval); setNewPerDay(DEFAULT_SRS.newPerDay); setReviewsPerDay(DEFAULT_SRS.reviewsPerDay) }} className="btn-ghost">По умолчанию</button>
            <button disabled={!dirty} onClick={() => { s.setSrs({ requestRetention: retention, maximumInterval: maxI, newPerDay, reviewsPerDay }); s.notify('Настройки сохранены — новые интервалы применятся со следующего ответа') }} className="btn-primary">Сохранить</button>
          </div>
        } />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <div className="label text-teal-soft">Желаемое удержание</div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-4xl font-extrabold text-teal-soft font-mono">{Math.round(retention * 100)}%</span>
            <span className="text-xs text-dim">80–97%</span>
          </div>
          <input id="retention" type="range" min={0.8} max={0.97} step={0.01} value={retention} onChange={(e) => setRetention(+e.target.value)} className="w-full mt-3 accent-teal" />
          <p className="text-sm text-mute mt-2">Вероятность вспомнить карточку в момент планового повторения.</p>
          <div className="mt-4 rounded-lg bg-s2/60 p-3 text-sm">
            Расчётная нагрузка: <b className="text-ink">~{Math.round(sim.avgPerDay)} карточек в день</b> · около {Math.max(1, minutes)} мин
          </div>
        </div>

        <div className="card p-5">
          <div className="label">Лимиты на день</div>
          <Num id="new-per-day" label="Новых карточек" hint="сколько новых карточек вводить в день" v={newPerDay} set={setNewPerDay} min={1} max={100} />
          <Num id="reviews-per-day" label="Повторений" hint="верхний предел, чтобы не перегореть" v={reviewsPerDay} set={setReviewsPerDay} min={10} max={999} step={10} />
        </div>

        <div className="card p-5">
          <div className="label">Максимальный интервал</div>
          <p className="text-sm text-mute mt-2">Как надолго можно отложить карточку, даже если ты её отлично помнишь.</p>
          <div className="grid gap-2 mt-3">
            {MAX_OPTIONS.map((o) => (
              <button key={o.v} onClick={() => setMaxI(o.v)} className={`rounded-lg border px-3 py-2 text-sm text-left ${maxI === o.v ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'}`}>{o.t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5 mt-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
          <div>
            <div className="label">Прогноз на 30 дней</div>
            <div className="font-semibold mt-1">Повторений в день при удержании {Math.round(retention * 100)}%</div>
            <div className="text-xs text-dim mt-0.5">Моделирование по твоей колоде ({cards.length} карт) и {simNew} новым карточкам в день</div>
          </div>
          <label className="text-xs text-mute flex items-center gap-2" htmlFor="sim-new">Новых в день в прогнозе
            <input id="sim-new" type="range" min={0} max={30} value={simNew} onChange={(e) => setSimNew(+e.target.value)} className="accent-violet w-28" />
            <span className="font-mono text-ink w-5">{simNew}</span>
          </label>
        </div>
        <BarChart data={sim.perDay.map((v, i) => ({ label: `${i + 1}д`, value: v }))} color="#0D9488" unit=" карт." width={1100} height={220} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
          {compare.map((c) => (
            <button key={c.r} onClick={() => setRetention(c.r)} className={`rounded-lg border p-3 text-left ${Math.abs(c.r - retention) < 0.001 ? 'border-teal bg-teal/10' : 'border-line hover:border-s3'}`}>
              <div className="text-xs text-dim">Удержание {Math.round(c.r * 100)}%</div>
              <div className="font-mono font-semibold mt-1">~{Math.round(c.avgPerDay)} карт/день</div>
              <div className="text-[11px] text-dim">помнишь через месяц ≈ {Math.round(c.endRetention * 100)}%</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between">
          <div className="label">Веса модели · 21 параметр</div>
          <span className="chip bg-s2 text-mute">по умолчанию</span>
        </div>
        <p className="text-sm text-mute mt-2">Веса описывают, как в среднем работает память. Когда у тебя накопится около 1000 ответов, их можно подобрать лично под тебя — журнал повторений уже записывается ({s.reviewLog.length} ответов).</p>
        <div className="grid md:grid-cols-2 gap-2 mt-4">
          {W_GROUPS.map((g) => (
            <div key={g.t} className="rounded-lg bg-[#0A0E16] border border-line p-3">
              <div className="text-xs text-mute">{g.t}</div>
              <div className="font-mono text-xs text-teal-soft mt-1 break-all">{DEFAULT_W.slice(g.r[0], g.r[1]).map((w, i) => `w${g.r[0] + i}=${w}`).join('  ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Num({ id, label, hint, v, set, min, max, step = 1 }: { id: string; label: string; hint: string; v: number; set: (n: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="flex-1"><label htmlFor={id} className="text-sm font-semibold">{label}</label><div className="text-xs text-dim">{hint}</div></div>
      <div className="flex items-center gap-1">
        <button onClick={() => set(Math.max(min, v - step))} className="w-8 h-8 rounded-lg bg-s2 grid place-items-center" aria-label="Меньше"><Icon name="remove" className="text-[18px]" /></button>
        <input id={id} type="number" value={v} min={min} max={max} onChange={(e) => set(Math.min(max, Math.max(min, +e.target.value || min)))} className="w-14 text-center bg-transparent font-mono font-semibold outline-none" />
        <button onClick={() => set(Math.min(max, v + step))} className="w-8 h-8 rounded-lg bg-s2 grid place-items-center" aria-label="Больше"><Icon name="add" className="text-[18px]" /></button>
      </div>
    </div>
  )
}
