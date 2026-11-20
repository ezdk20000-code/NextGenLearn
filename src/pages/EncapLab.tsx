import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Icon } from '../components/ui'

const WRAPS = [
  { id: 'tcp', name: 'TCP-заголовок', detail: 'порт 52144 → 443', color: '#4FDBC8' },
  { id: 'ip', name: 'IP-заголовок', detail: '192.168.1.5 → 93.184.216.34 · TTL 64', color: '#FFB95F' },
  { id: 'eth', name: 'Ethernet-заголовок', detail: 'MAC ноутбука → MAC роутера', color: '#FDA4AF' },
]
const DECOYS = [{ id: 'dns', name: 'DNS-ответ', detail: 'example.com = 93.184.216.34', color: '#94A3B8' }]

const FIELDS = [
  { id: 'mac', t: 'MAC-адреса отправителя и получателя', change: true, why: 'MAC работает только «в пределах комнаты». На каждом участке пути — новые соседи, значит новые MAC.' },
  { id: 'ip', t: 'IP-адрес получателя', change: false, why: 'IP — адрес «в пределах планеты». Он не меняется от отправителя до получателя (если нет NAT).' },
  { id: 'ttl', t: 'TTL (время жизни пакета)', change: true, why: 'Каждый роутер уменьшает TTL на 1. Когда он дойдёт до 0, пакет уничтожат — так сеть защищается от бесконечных петель.' },
  { id: 'port', t: 'TCP-порт получателя', change: false, why: 'Роутер вообще не заглядывает в транспортный слой — порт ему не нужен.' },
  { id: 'data', t: 'HTTP-запрос внутри', change: false, why: 'Данные приложения едут нетронутыми. Роутеру всё равно, что внутри.' },
]

export default function EncapLab() {
  const s = useStore()
  const [stack, setStack] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [stage, setStage] = useState<1 | 2 | 3>(1)
  const [picked, setPicked] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const [mistakes, setMistakes] = useState(0)

  const options = [...WRAPS, ...DECOYS].sort((a, b) => a.name.localeCompare(b.name))

  const wrap = (id: string) => {
    const expected = WRAPS[stack.length]?.id
    if (id === 'dns') { setMistakes((m) => m + 1); setErr('DNS — отдельный разговор (узнать IP по имени). В этот пакет он не заворачивается.'); return }
    if (id !== expected) {
      setMistakes((m) => m + 1)
      setErr(id === 'eth' ? 'Ethernet — самый внешний конверт, его надевают последним, прямо перед отправкой в провод.' : id === 'ip' ? 'Сначала транспортный слой: какому приложению на сервере отдать данные?' : 'Этот слой уже есть.')
      return
    }
    setErr(null)
    const n = [...stack, id]
    setStack(n)
    if (n.length === WRAPS.length) window.setTimeout(() => setStage(2), 900)
  }

  const verify = () => {
    setChecked(true)
    const correct = FIELDS.filter((f) => f.change).map((f) => f.id).sort().join()
    if (picked.slice().sort().join() === correct) {
      setStage(3)
      s.completeLab('encap', 'layers', Math.max(50, 100 - mistakes * 10), mistakes)
    } else setMistakes((m) => m + 1)
  }

  // вложенная визуализация
  let packet = <div className="rounded-md border border-dashed border-violet-soft/70 px-3 py-2 text-violet-soft font-mono text-xs">HTTP: GET / </div>
  stack.forEach((id) => {
    const w = WRAPS.find((x) => x.id === id)!
    packet = (
      <div className="rounded-lg border-2 p-2.5 pop" style={{ borderColor: w.color, background: `${w.color}12` }}>
        <div className="font-mono text-[11px] mb-2 truncate" style={{ color: w.color }}>{w.name} · {w.detail}</div>
        {packet}
      </div>
    )
  })

  return (
    <div>
      <Link to="/labs" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Лаборатории</Link>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="chip bg-teal/15 text-teal-soft">Конструктор</span>
        <span className="chip bg-s2 text-mute">Этап {Math.min(stage, 2)} из 2</span>
      </div>
      <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">Матрёшка пакета</h1>
      <p className="text-mute mt-1 mb-6 text-sm md:text-base">Собери пакет, который браузер отправит серверу, а потом проследи, что с ним делает роутер по пути.</p>

      {stage === 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="label mb-3">Шаг 1 · Заверни данные в конверты</div>
            <p className="text-sm text-mute mb-4">Браузер подготовил HTTP-запрос. Нажимай заголовки в том порядке, в котором слои заворачивают данные — от внутреннего к внешнему.</p>
            <div className="grid gap-2">
              {options.map((o) => (
                <button key={o.id} disabled={stack.includes(o.id)} onClick={() => wrap(o.id)}
                  className="flex items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-s3 disabled:opacity-30">
                  <span className="w-3 h-3 rounded-sm" style={{ background: o.color }} />
                  <span className="flex-1"><span className="font-semibold text-sm">{o.name}</span><span className="block text-xs text-dim font-mono">{o.detail}</span></span>
                  <Icon name="add" className="text-mute" />
                </button>
              ))}
            </div>
            {err && <div className="mt-3 rounded-lg bg-amber/10 text-amber-soft p-3 text-sm pop">{err}</div>}
          </div>
          <div className="card grid-bg p-5 flex flex-col">
            <div className="label mb-3">Пакет · {stack.length}/3 слоя</div>
            <div className="flex-1 grid place-items-center"><div className="w-full max-w-md">{packet}</div></div>
            {stack.length === 3 && <div className="text-sm text-teal-soft text-center mt-4 pop">Кадр готов — уходит в провод!</div>}
          </div>
        </div>
      )}

      {stage >= 2 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card p-5">
            <div className="label mb-3">Шаг 2 · Пакет прошёл через роутер</div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#0A0E16] border border-line p-4 mb-5">
              {[['laptop_mac', 'Ноутбук'], ['router', 'Домашний роутер'], ['cell_tower', 'Провайдер'], ['dns', 'Сервер']].map(([ic, n], i) => (
                <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-lg grid place-items-center ${i === 1 ? 'bg-amber/15 text-amber-soft ring-2 ring-amber/40' : 'bg-s2 text-mute'}`}><Icon name={ic} /></div>
                    <div className="text-[10px] text-dim mt-1 hidden sm:block">{n}</div>
                  </div>
                  {i < 3 && <div className="flex-1 h-0.5 bg-gradient-to-r from-violet to-teal rounded-full" />}
                </div>
              ))}
            </div>
            <div className="font-semibold">Что роутер <span className="text-amber-soft">изменил</span> в пакете, прежде чем отправить его дальше?</div>
            <div className="text-sm text-mute mt-1 mb-4">Отметь все поля, которые поменялись.</div>
            <div className="grid gap-2">
              {FIELDS.map((f) => {
                const on = picked.includes(f.id)
                const showRes = checked
                const right = on === f.change
                return (
                  <div key={f.id}>
                    <button disabled={stage === 3} onClick={() => { setChecked(false); setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id])) }}
                      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${on ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'} ${showRes && !right ? '!border-rose' : ''}`}>
                      <span className={`w-5 h-5 rounded-md border grid place-items-center ${on ? 'bg-violet border-violet' : 'border-s3'}`}>{on && <Icon name="check" className="text-[16px]" />}</span>
                      <span className="flex-1">{f.t}</span>
                      {stage === 3 && <span className={`chip ${f.change ? 'bg-amber/15 text-amber-soft' : 'bg-s2 text-dim'}`}>{f.change ? 'меняется' : 'не меняется'}</span>}
                    </button>
                    {stage === 3 && <div className="text-xs text-mute px-3 pt-1.5 pb-1 pop">{f.why}</div>}
                  </div>
                )
              })}
            </div>
            {stage === 2 && <button onClick={verify} disabled={!picked.length} className="btn-primary mt-4">Проверить</button>}
            {checked && stage === 2 && <div className="mt-3 rounded-lg bg-amber/10 text-amber-soft p-3 text-sm pop">Не совсем. Подсказка: роутер работает на сетевом слое и «переодевает» пакет для следующего участка пути.</div>}
          </div>
          <div className="card p-5 self-start">
            {stage === 3 ? (
              <div className="text-center pop">
                <Icon name="verified" fill className="text-teal-soft text-[36px]" />
                <div className="font-bold text-lg mt-1">Лаборатория пройдена!</div>
                <p className="text-sm text-mute mt-2">Главная мысль: <b className="text-ink">IP-адрес — пункт назначения, MAC-адрес — следующая остановка.</b> Роутер меняет «конверт» на каждом шаге, но не трогает содержимое.</p>
                <div className="text-sm text-dim mt-3">Ошибок: {mistakes}</div>
                <Link to="/track/networks" className="btn-teal w-full mt-4">К древу знаний</Link>
              </div>
            ) : (
              <>
                <div className="label mb-2">Что знает роутер</div>
                <ul className="text-sm text-mute space-y-2">
                  <li className="flex gap-2"><Icon name="layers" className="text-[18px] text-amber-soft" />Работает на сетевом слое (IP)</li>
                  <li className="flex gap-2"><Icon name="table_rows" className="text-[18px] text-amber-soft" />Ищет IP получателя в таблице маршрутов</li>
                  <li className="flex gap-2"><Icon name="swap_horiz" className="text-[18px] text-amber-soft" />Отправляет пакет следующему соседу</li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
