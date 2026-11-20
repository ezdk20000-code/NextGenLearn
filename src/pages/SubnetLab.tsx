import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Icon } from '../components/ui'

const BASE = [192, 168, 0, 0]
const TASKS = [
  { need: 50, ctx: 'Офис маркетинга: 50 компьютеров и принтеров', answer: 26, icon: 'business' },
  { need: 2, ctx: 'Прямой канал между двумя роутерами', answer: 30, icon: 'cable' },
  { need: 200, ctx: 'Этаж бизнес-центра: 200 устройств', answer: 24, icon: 'apartment' },
  { need: 1000, ctx: 'Кампус университета: 1000 студентов с ноутбуками', answer: 22, icon: 'school' },
]

const toIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')
const baseNum = ((BASE[0] << 24) | (BASE[1] << 16) | (BASE[2] << 8) | BASE[3]) >>> 0

export default function SubnetLab() {
  const s = useStore()
  const [prefix, setPrefix] = useState(24)
  const [task, setTask] = useState(0)
  const [solved, setSolved] = useState<number[]>([])
  const [fb, setFb] = useState<null | { ok: boolean; msg: string }>(null)
  const [mistakes, setMistakes] = useState(0)

  const hostBits = 32 - prefix
  const total = 2 ** hostBits
  const usable = prefix >= 31 ? (prefix === 31 ? 2 : 1) : total - 2
  const mask = prefix === 0 ? 0 : (0xffffffff << hostBits) >>> 0
  const net = (baseNum & mask) >>> 0
  const bc = (net + total - 1) >>> 0

  const allDone = solved.length === TASKS.length
  const t = TASKS[task]

  const check = () => {
    if (usable < t.need) {
      setMistakes((m) => m + 1)
      setFb({ ok: false, msg: `В /${prefix} помещается только ${usable} устройств, а нужно ${t.need}. Добавь бит для хостов — сдвинь влево.` })
    } else if (prefix < t.answer) {
      setMistakes((m) => m + 1)
      setFb({ ok: false, msg: `Влезет, но /${prefix} даёт ${usable} адресов — это расточительно. Найди самую маленькую подсеть, где хватит места.` })
    } else {
      const next = [...solved, task]
      setSolved(next)
      setFb({ ok: true, msg: `Точно! /${prefix}: ${hostBits} бит на устройства → 2^${hostBits} − 2 = ${usable} адресов. Минимально и с запасом.` })
      if (next.length === TASKS.length) s.completeLab('subnet', 'subnets', Math.max(60, 140 - mistakes * 10), mistakes)
    }
  }

  return (
    <div>
      <Link to="/labs" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Лаборатории</Link>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="chip bg-teal/15 text-teal-soft">Визуальный калькулятор</span>
        <span className="chip bg-violet/15 text-violet-soft">+{Math.max(60, 140 - mistakes * 10)} XP</span>
      </div>
      <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">Нарезка подсетей</h1>
      <p className="text-mute mt-1 mb-6 text-sm md:text-base">Ты — сетевой инженер. Раздели адреса <span className="font-mono text-ink">192.168.0.0</span> так, чтобы каждому отделу хватило места и ничего не пропадало зря.</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label">32 бита IP-адреса</div>
              <div className="flex gap-3 text-[11px]"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet" />сеть</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-teal" />устройства</span></div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 md:gap-3">
              {[0, 1, 2, 3].map((o) => (
                <div key={o}>
                  <div className="grid grid-cols-8 gap-0.5">
                    {Array.from({ length: 8 }).map((_, b) => {
                      const i = o * 8 + b
                      const isNet = i < prefix
                      const bit = (baseNum >>> (31 - i)) & 1
                      return (
                        <div key={b} className={`aspect-[3/4] rounded-[3px] grid place-items-center font-mono text-[9px] md:text-[11px] font-bold transition-colors ${isNet ? 'bg-violet/80 text-white' : 'bg-teal/25 text-teal-soft'}`}>
                          {isNet ? bit : '·'}
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-center font-mono text-xs md:text-sm mt-1.5">{BASE[o]}</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-mute">Длина префикса (маска)</span>
                <span className="font-mono text-2xl font-bold text-violet-soft">/{prefix}</span>
              </div>
              <input type="range" min={16} max={30} value={prefix} onChange={(e) => { setPrefix(+e.target.value); setFb(null) }} className="w-full mt-2 accent-violet" />
              <div className="flex justify-between text-[10px] text-dim font-mono"><span>/16 · больше устройств</span><span>/30 · меньше</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Info label="Маска" value={toIp(mask)} />
            <Info label="Адрес сети" value={`${toIp(net)}/${prefix}`} />
            <Info label="Broadcast" value={toIp(bc)} />
            <Info label="Устройств" value={usable.toLocaleString('ru-RU')} accent />
          </div>
          <div className="card p-4 text-sm text-mute">
            Диапазон устройств: <span className="font-mono text-ink">{toIp(net + 1)}</span> — <span className="font-mono text-ink">{toIp(bc - 1)}</span>.
            Первый адрес — имя самой сети, последний — «всем в сети» (broadcast). Их устройствам не выдают, поэтому <b className="text-ink">−2</b>.
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3">Заказы отделов · {solved.length}/{TASKS.length}</div>
            <div className="space-y-2">
              {TASKS.map((x, i) => {
                const ok = solved.includes(i)
                return (
                  <button key={i} onClick={() => { setTask(i); setFb(null) }}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${i === task ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'}`}>
                    <Icon name={ok ? 'check_circle' : x.icon} fill={ok} className={`text-[20px] ${ok ? 'text-teal-soft' : 'text-mute'}`} />
                    <span className="flex-1">{x.ctx}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="card p-4 shadow-glow-violet">
            <div className="label text-violet-soft mb-1">Текущий заказ</div>
            <div className="font-semibold">{t.ctx}</div>
            <div className="text-sm text-mute mt-1">Нужно минимум <b className="text-ink">{t.need}</b> адресов. Подбери самую маленькую подходящую подсеть.</div>
            <button onClick={check} disabled={solved.includes(task)} className="btn-primary w-full mt-4">{solved.includes(task) ? 'Выполнено' : `Выдать /${prefix}`}</button>
            {fb && <div className={`mt-3 rounded-lg p-3 text-sm pop ${fb.ok ? 'bg-teal/10' : 'bg-amber/10 text-amber-soft'}`}>{fb.msg}</div>}
            {fb?.ok && !allDone && (
              <button onClick={() => { const n = TASKS.findIndex((_, i) => !solved.includes(i)); if (n >= 0) { setTask(n); setFb(null) } }} className="btn-ghost w-full mt-2">Следующий заказ <Icon name="arrow_forward" className="text-[18px]" /></button>
            )}
          </div>
          {allDone && (
            <div className="card p-4 border-teal/40 pop text-center">
              <Icon name="verified" fill className="text-teal-soft text-[32px]" />
              <div className="font-bold mt-1">Все отделы подключены!</div>
              <div className="text-sm text-mute">Ошибок: {mistakes}</div>
              <Link to="/track/networks" className="btn-teal w-full mt-3">К древу знаний</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-3">
      <div className="label">{label}</div>
      <div className={`font-mono text-sm md:text-base font-semibold mt-1 break-all ${accent ? 'text-teal-soft' : ''}`}>{value}</div>
    </div>
  )
}
