import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Icon } from '../components/ui'

// Симулятор TCP: пользователь управляет клиентом, сервер отвечает сам.
// Клиент ISN = 100, сервер ISN = 300. Первая отправка данных теряется — специально.

type Who = 'c' | 's'
interface Msg { id: number; from: Who; flags: string; seq?: number; ack?: number; len?: number; body?: string; lost?: boolean; error?: boolean; note: string }
type Phase = 'closed' | 'synack' | 'est' | 'lost' | 'resp' | 'est2' | 'fin' | 'done'

const STATE: Record<Phase, [string, string]> = {
  closed: ['CLOSED', 'LISTEN'],
  synack: ['SYN-SENT', 'SYN-RECEIVED'],
  est: ['ESTABLISHED', 'ESTABLISHED'],
  lost: ['ESTABLISHED', 'ESTABLISHED'],
  resp: ['ESTABLISHED', 'ESTABLISHED'],
  est2: ['ESTABLISHED', 'ESTABLISHED'],
  fin: ['FIN-WAIT-2', 'LAST-ACK'],
  done: ['TIME-WAIT → CLOSED', 'CLOSED'],
}

const MISSIONS = [
  { id: 'hs', t: 'Установи соединение (тройное рукопожатие)' },
  { id: 'data', t: 'Отправь HTTP-запрос серверу' },
  { id: 'loss', t: 'Переживи потерю пакета' },
  { id: 'resp', t: 'Подтверди ответ сервера правильным ack' },
  { id: 'close', t: 'Корректно закрой соединение' },
]

const HINTS: Record<Phase, string> = {
  closed: 'Разговор в TCP всегда начинает тот, кто хочет подключиться. Какой флаг означает «давай синхронизируемся»?',
  synack: 'Сервер прислал свой SYN с seq=300. Подтверди его: ack = «следующий байт, который я жду от тебя».',
  est: 'Соединение установлено — можно слать данные (запрос GET).',
  lost: 'Подтверждение не пришло, таймер истёк. Что делает TCP в этом случае?',
  resp: 'Сервер прислал 300 байт, начиная с seq=301. Какой следующий номер байта ты ждёшь?',
  est2: 'Данные получены. Пора вежливо попрощаться — какой флаг означает «я закончил»?',
  fin: 'Сервер тоже прислал FIN с seq=601. FIN занимает один номер — подтверди его.',
  done: 'Соединение закрыто. Лаборатория пройдена!',
}

export default function TcpLab() {
  const s = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [phase, setPhase] = useState<Phase>('closed')
  const [done, setDone] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [busy, setBusy] = useState(false)
  const [ackPick, setAckPick] = useState<number[] | null>(null)
  const [rto, setRto] = useState(0)
  const [hint, setHint] = useState(false)
  const idRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs])

  // таймер повторной передачи
  useEffect(() => {
    if (phase !== 'lost' || rto >= 100) return
    const t = window.setTimeout(() => setRto((x) => Math.min(100, x + 5)), 90)
    return () => window.clearTimeout(t)
  }, [phase, rto])

  const push = (m: Omit<Msg, 'id'>) => setMsgs((xs) => [...xs, { ...m, id: ++idRef.current }])
  const later = (fn: () => void, ms = 700) => { setBusy(true); window.setTimeout(() => { fn(); setBusy(false) }, ms) }
  const mission = (id: string) => setDone((d) => (d.includes(id) ? d : [...d, id]))
  const mistake = (note: string, flags = '✕') => { setMistakes((m) => m + 1); push({ from: 'c', flags, error: true, note }) }

  const send = (kind: 'SYN' | 'ACK' | 'DATA' | 'FIN' | 'RETX') => {
    setHint(false)
    if (kind === 'SYN') {
      if (phase !== 'closed') return mistake('Соединение уже начато — повторный SYN тут не нужен.', 'SYN')
      push({ from: 'c', flags: 'SYN', seq: 100, note: 'Клиент: «Хочу подключиться, мой стартовый номер 100»' })
      later(() => { push({ from: 's', flags: 'SYN-ACK', seq: 300, ack: 101, note: 'Сервер: «Принял до 100, жду 101. Мой стартовый номер 300»' }); setPhase('synack') })
      return
    }
    if (kind === 'ACK') {
      if (phase === 'synack') return setAckPick([300, 301, 101])
      if (phase === 'resp') return setAckPick([600, 121, 601])
      if (phase === 'fin') return setAckPick([601, 602, 122])
      return mistake('Сейчас нечего подтверждать — от сервера не приходило новых данных.', 'ACK')
    }
    if (kind === 'DATA') {
      if (phase === 'closed' || phase === 'synack') {
        push({ from: 'c', flags: 'DATA', note: 'Попытка отправить данные без соединения' })
        setMistakes((m) => m + 1)
        later(() => push({ from: 's', flags: 'RST', error: true, note: 'Сервер: RST — «Я тебя не знаю, соединение не установлено». Сначала рукопожатие!' }))
        return
      }
      if (phase === 'est') {
        push({ from: 'c', flags: 'PSH-ACK', seq: 101, ack: 301, len: 20, body: 'GET / HTTP/1.1', lost: true, note: 'Пакет потерялся по дороге (перегруженный роутер)' })
        mission('data'); setRto(0); setPhase('lost')
        return
      }
      return mistake('Запрос уже отправлен. Дождись ответа сервера.', 'DATA')
    }
    if (kind === 'RETX') {
      if (phase !== 'lost') return
      if (rto < 100) return mistake('Рано! TCP ждёт, пока истечёт таймер RTO, — иначе сеть забьётся дублями.', 'RETX')
      push({ from: 'c', flags: 'PSH-ACK', seq: 101, ack: 301, len: 20, body: 'GET / HTTP/1.1', note: 'Повторная отправка тех же байтов 101–120' })
      mission('loss')
      later(() => {
        push({ from: 's', flags: 'ACK', seq: 301, ack: 121, note: 'Сервер: «Получил байты до 120, жду 121»' })
        window.setTimeout(() => {
          push({ from: 's', flags: 'PSH-ACK', seq: 301, ack: 121, len: 300, body: 'HTTP/1.1 200 OK …', note: 'Сервер отправил страницу: 300 байт, номера 301–600' })
          setPhase('resp')
        }, 600)
      })
      return
    }
    if (kind === 'FIN') {
      if (phase !== 'est2') return mistake(phase === 'resp' ? 'Сначала подтверди полученные данные — иначе сервер будет слать их повторно.' : 'Закрывать соединение сейчас рано.', 'FIN')
      push({ from: 'c', flags: 'FIN-ACK', seq: 121, ack: 601, note: 'Клиент: «Я закончил отправлять»' })
      later(() => {
        push({ from: 's', flags: 'ACK', seq: 601, ack: 122, note: 'Сервер: «Понял, что ты закончил»' })
        window.setTimeout(() => { push({ from: 's', flags: 'FIN-ACK', seq: 601, ack: 122, note: 'Сервер: «Я тоже закончил»' }); setPhase('fin') }, 600)
      })
    }
  }

  const chooseAck = (v: number) => {
    setAckPick(null)
    if (phase === 'synack') {
      if (v !== 301) return mistake(v === 101 ? 'ack=101 — это номер, который ждёт сервер от тебя. А ты подтверждаешь его SYN с seq=300.' : 'ack=300 значит «жду байт 300», но SYN сервера уже занял этот номер. Нужно 300+1.', `ACK ${v}`)
      push({ from: 'c', flags: 'ACK', seq: 101, ack: 301, note: 'Клиент: «Принял твой 300, жду 301». Соединение установлено!' })
      mission('hs'); setPhase('est')
    } else if (phase === 'resp') {
      if (v !== 601) return mistake(v === 121 ? 'ack=121 — это номер твоих собственных байтов. Подтверждать нужно байты сервера.' : 'Сервер прислал байты 301–600. «Жду следующий» — это 601, а не 600.', `ACK ${v}`)
      push({ from: 'c', flags: 'ACK', seq: 121, ack: 601, note: 'Клиент: «Получил всё до 600, жду 601»' })
      mission('resp'); setPhase('est2')
    } else if (phase === 'fin') {
      if (v !== 602) return mistake('FIN сервера занимает номер 601. Значит, подтверждаем 601+1.', `ACK ${v}`)
      push({ from: 'c', flags: 'ACK', seq: 122, ack: 602, note: 'Клиент: «Принял твой FIN». Соединение закрыто.' })
      mission('close'); setPhase('done')
    }
  }

  const xp = Math.max(60, 150 - mistakes * 10)
  const allDone = MISSIONS.every((m) => done.includes(m.id))
  useEffect(() => { if (allDone) s.completeLab('tcp', 'tcp', xp) }, [allDone]) // eslint-disable-line

  const restart = () => { setMsgs([]); setPhase('closed'); setDone([]); setMistakes(0); setAckPick(null); setRto(0) }

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-dim mb-3">
        <Link to="/labs" className="hover:text-ink flex items-center gap-1"><Icon name="arrow_back" className="text-[16px]" />Лаборатории</Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="chip bg-teal/15 text-teal-soft"><span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />Живой симулятор</span>
            <span className="chip bg-amber/15 text-amber-soft">Ненадёжная сеть</span>
            <span className="chip bg-violet/15 text-violet-soft">+{xp} XP</span>
          </div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight">TCP: рукопожатие, потери и прощание</h1>
          <p className="text-mute mt-1 text-sm md:text-base">Ты — клиент (браузер). Подключись к серверу, получи страницу и закрой соединение. Сеть иногда теряет пакеты.</p>
        </div>
        <button onClick={restart} className="btn-ghost"><Icon name="restart_alt" className="text-[18px]" />Заново</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden flex flex-col">
          {/* Шапка диаграммы */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line p-4">
            <Host icon="laptop_mac" name="Клиент" sub="192.168.1.5:52144" state={STATE[phase][0]} tone="violet" />
            <div className="text-[10px] text-dim font-mono text-center px-2">интернет<br />~40 мс</div>
            <Host icon="dns" name="Сервер" sub="93.184.216.34:80" state={STATE[phase][1]} tone="teal" right />
          </div>

          {/* Диаграмма последовательности */}
          <div ref={listRef} className="relative h-[380px] md:h-[440px] overflow-y-auto grid-bg px-3 md:px-6 py-4">
            <div className="absolute top-0 bottom-0 left-[12%] w-px bg-violet/30" />
            <div className="absolute top-0 bottom-0 right-[12%] w-px bg-teal/30" />
            {msgs.length === 0 && <div className="h-full grid place-items-center text-sm text-dim text-center px-8">Пакетов пока нет. Начни разговор кнопкой ниже.</div>}
            <div className="space-y-3">
              {msgs.map((m) => <Arrow key={m.id} m={m} />)}
            </div>
          </div>

          {/* Пульт управления */}
          <div className="border-t border-line p-4 bg-[#0A0E16]">
            {phase === 'lost' && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1"><span className="text-amber-soft flex items-center gap-1"><Icon name="timer" className="text-[16px]" />Таймер повторной передачи (RTO)</span><span className="font-mono text-dim">{rto < 100 ? `${((100 - rto) * 0.03).toFixed(1)} с` : 'истёк — ACK не пришёл'}</span></div>
                <div className="h-1.5 rounded-full bg-s2 overflow-hidden"><div className="h-full bg-amber" style={{ width: `${rto}%` }} /></div>
              </div>
            )}
            {ackPick ? (
              <div className="pop">
                <div className="text-sm font-semibold mb-2">Какой номер подтвердить (ack)?</div>
                <div className="flex gap-2">
                  {ackPick.map((v) => <button key={v} onClick={() => chooseAck(v)} className="btn-secondary flex-1 font-mono">ack={v}</button>)}
                  <button onClick={() => setAckPick(null)} className="btn-ghost"><Icon name="close" className="text-[18px]" /></button>
                </div>
              </div>
            ) : phase === 'done' ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 pop">
                <Icon name="verified" fill className="text-teal-soft text-[32px]" />
                <div className="flex-1 text-center sm:text-left"><div className="font-bold">Лаборатория пройдена!</div><div className="text-sm text-mute">Ошибок: {mistakes} · начислено +{xp} XP</div></div>
                <Link to="/track" className="btn-teal">К древу знаний</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Ctl label="SYN" sub="начать" onClick={() => send('SYN')} disabled={busy} />
                <Ctl label="ACK" sub="подтвердить" onClick={() => send('ACK')} disabled={busy} />
                <Ctl label="DATA" sub="GET /" onClick={() => send('DATA')} disabled={busy} />
                <Ctl label="RETX" sub="повторить" onClick={() => send('RETX')} disabled={busy} warn={phase === 'lost' && rto >= 100} />
                <Ctl label="FIN" sub="закончить" onClick={() => send('FIN')} disabled={busy} />
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="label mb-3">Задания</div>
            <ul className="space-y-2.5">
              {MISSIONS.map((m) => {
                const ok = done.includes(m.id)
                return (
                  <li key={m.id} className={`flex gap-2.5 text-sm ${ok ? 'text-mute' : ''}`}>
                    <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} fill={ok} className={`text-[18px] mt-px ${ok ? 'text-teal-soft' : 'text-dim'}`} />
                    <span className={ok ? 'line-through' : ''}>{m.t}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="label">Подсказка наставника</div>
              {!hint && phase !== 'done' && <button onClick={() => setHint(true)} className="text-xs text-violet-soft hover:underline">Показать</button>}
            </div>
            {hint || phase === 'done' ? <p className="text-sm text-mute mt-2 pop">{HINTS[phase]}</p> : <p className="text-sm text-dim mt-2">Сначала попробуй сам — так запоминается лучше.</p>}
          </div>
          <div className="card p-4">
            <div className="label mb-2">Шпаргалка</div>
            <ul className="text-xs text-mute space-y-1.5 leading-relaxed">
              <li><b className="text-ink font-mono">seq</b> — номер первого байта в пакете</li>
              <li><b className="text-ink font-mono">ack</b> — «получил всё до этого номера, жду его»</li>
              <li><b className="text-ink font-mono">SYN</b> и <b className="text-ink font-mono">FIN</b> занимают по одному номеру</li>
              <li><b className="text-ink font-mono">RTO</b> — сколько ждать подтверждения до повтора</li>
            </ul>
          </div>
          <div className="card p-4 flex items-center justify-between">
            <span className="text-sm text-mute">Ошибки</span><span className={`font-mono font-bold ${mistakes ? 'text-rose-soft' : 'text-teal-soft'}`}>{mistakes}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Host({ icon, name, sub, state, tone, right }: { icon: string; name: string; sub: string; state: string; tone: 'violet' | 'teal'; right?: boolean }) {
  const c = tone === 'teal' ? 'text-teal-soft bg-teal/10 border-teal/30' : 'text-violet-soft bg-violet/10 border-violet/30'
  return (
    <div className={`flex items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <div className={`w-10 h-10 rounded-lg border grid place-items-center shrink-0 ${c}`}><Icon name={icon} className="text-[22px]" /></div>
      <div className="min-w-0">
        <div className="font-semibold text-sm">{name}</div>
        <div className="text-[10px] text-dim font-mono truncate hidden sm:block">{sub}</div>
        <div className={`text-[10px] font-mono font-semibold mt-0.5 ${tone === 'teal' ? 'text-teal-soft' : 'text-violet-soft'}`}>{state}</div>
      </div>
    </div>
  )
}

function Arrow({ m }: { m: Msg }) {
  const right = m.from === 'c'
  const color = m.error ? '#F43F5E' : m.lost ? '#F59E0B' : right ? '#818CF8' : '#4FDBC8'
  return (
    <div className="pop">
      <div className={`relative mx-[12%] h-7 flex items-center ${right ? '' : 'flex-row-reverse'}`}>
        <div className="h-0.5 rounded-full" style={{ width: m.lost ? '50%' : '100%', background: color, opacity: m.lost ? 0.8 : 1, borderStyle: m.lost ? 'dashed' : 'solid' }} />
        {m.lost
          ? <Icon name="close" className="text-[20px] -ml-1" />
          : <Icon name={right ? 'arrow_forward_ios' : 'arrow_back_ios'} className={`text-[14px] ${right ? '-ml-2' : '-mr-2.5'}`} />}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-[11px] font-bold px-1.5 rounded" style={{ color, background: '#0B0F17' }}>{m.flags}</span>
          {m.seq !== undefined && <span className="font-mono text-[10px] text-dim bg-canvas px-1 hidden sm:inline">seq={m.seq}{m.ack !== undefined ? ` ack=${m.ack}` : ''}{m.len ? ` len=${m.len}` : ''}</span>}
        </div>
      </div>
      <div className={`text-xs mx-[12%] ${right ? 'text-left' : 'text-right'} ${m.error ? 'text-rose-soft' : m.lost ? 'text-amber-soft' : 'text-mute'}`}>
        {m.body && <span className="font-mono text-ink/80 mr-1.5">«{m.body}»</span>}{m.note}
      </div>
    </div>
  )
}

function Ctl({ label, sub, onClick, disabled, warn }: { label: string; sub: string; onClick: () => void; disabled?: boolean; warn?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-left transition-all disabled:opacity-40 ${warn ? 'border-amber bg-amber/10 shadow-glow-amber animate-pulse' : 'border-s3 hover:border-violet hover:bg-violet/5'}`}>
      <div className="font-mono font-bold text-sm">{label}</div>
      <div className="text-[11px] text-dim">{sub}</div>
    </button>
  )
}
