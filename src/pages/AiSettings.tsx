import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SCI_TOOLS } from '../../shared/sci-tools'
import { aiErrorText, useAi } from '../ai/AiContext'
import type { Tier } from '../ai/channels'
import { useStore, type AiPrefs } from '../store'
import { Icon, PageHeader } from '../components/ui'

const CHANNELS: { id: AiPrefs['channel']; icon: string; title: string; text: string }[] = [
  { id: 'auto', icon: 'auto_mode', title: 'Автоматически', text: 'Сначала твой Claude, затем сервер NGL, иначе офлайн.' },
  { id: 'account', icon: 'account_circle', title: 'Claude · твой аккаунт', text: 'Наставник работает через твой аккаунт Claude. Первый запрос попросит разрешения; тратятся твои лимиты Claude.' },
  { id: 'server', icon: 'dns', title: 'Сервер NGL', text: 'Claude по API и другие модели, включая научные. Личный профиль и память хранятся на сервере.' },
  { id: 'offline', icon: 'cloud_off', title: 'Офлайн', text: 'Без ИИ: проверки по ключевым словам, наставник отвечает шаблоном.' },
]
const TASKS: { id: keyof AiPrefs['tiers']; title: string; hint: string }[] = [
  { id: 'mentor', title: 'Разговор с наставником', hint: 'объяснения, примеры, вопросы' },
  { id: 'grade', title: 'Проверка «объясни сам»', hint: 'оценка понимания по смыслу' },
  { id: 'cards', title: 'Карточки из конспекта', hint: 'составление флеш-карт' },
]
const TIERS: { id: Tier; label: string; hint: string }[] = [
  { id: 'quick', label: 'Быстрая', hint: 'отвечает сразу' },
  { id: 'default', label: 'Обычная', hint: 'думает перед ответом' },
  { id: 'complex', label: 'Самая мощная', hint: 'для сложных тем' },
]

export default function AiSettings() {
  const s = useStore()
  const ai = useAi()
  const [url, setUrl] = useState(s.ai.serverUrl)
  const [fact, setFact] = useState('')
  const [test, setTest] = useState<{ busy: boolean; text?: string; error?: string }>({ busy: false })
  const toolOn = (n: string) => !s.ai.tools || s.ai.tools.includes(n)
  const toggleTool = (n: string) => {
    const all = SCI_TOOLS.map((t) => t.name)
    const cur = s.ai.tools ?? all
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]
    s.setAi({ tools: next.length === all.length ? null : next })
  }
  const status = (id: AiPrefs['channel']) => {
    if (id === 'auto') return null
    const a = ai.availability[id]
    return a === null ? <span className="chip bg-s2 text-dim">проверяю…</span> : a ? <span className="chip bg-teal/15 text-teal-soft">доступен</span> : <span className="chip bg-s2 text-dim">недоступен</span>
  }
  const runTest = async () => {
    setTest({ busy: true })
    try {
      const text = await ai.channel.mentor(ai.learner(), [{ role: 'user', content: 'Проверка связи. Представься одной фразой и скажи, чем поможешь мне в моём треке.' }], { onText: (t) => setTest({ busy: true, text: t }) })
      setTest({ busy: false, text })
    } catch (e) { setTest({ busy: false, error: aiErrorText(e) }) }
  }

  return (
    <div className="max-w-4xl">
      <Link to="/profile" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Профиль</Link>
      <PageHeader eyebrow="Личная интеграция" title="ИИ-наставник" sub="У каждого ученика свой наставник: он знает твой прогресс, слабые места и стиль, а подключение и модели ты выбираешь сам." />

      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Подключение</h2>
          <span className="text-xs text-dim">Сейчас отвечает: <b className="text-ink">{ai.channel.label}</b></span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {CHANNELS.map((c) => (
            <button key={c.id} onClick={() => s.setAi({ channel: c.id })} className={`text-left rounded-lg border p-4 ${s.ai.channel === c.id ? 'border-violet bg-violet/10' : 'border-line hover:border-s3'}`}>
              <div className="flex items-center gap-2"><Icon name={c.icon} className="text-violet-soft" /><span className="font-semibold text-sm flex-1">{c.title}</span>{status(c.id)}</div>
              <p className="text-xs text-mute mt-2">{c.text}</p>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="server-url" className="text-xs text-dim">Адрес сервера NGL</label>
          <div className="flex gap-2 mt-1">
            <input id="server-url" className="input !py-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ngl.example.com" />
            <button onClick={() => { s.setAi({ serverUrl: url.trim() }); s.notify('Адрес сохранён — проверяю связь') }} className="btn-secondary !py-2">Сохранить</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={runTest} disabled={test.busy} className="btn-primary !py-2"><Icon name="bolt" className="text-[18px]" />{test.busy ? 'Жду ответ…' : 'Проверить наставника'}</button>
          {test.error && <span className="text-sm text-rose-soft">{test.error}</span>}
        </div>
        {test.text && <div className="mt-3 rounded-lg bg-s2 p-3 text-sm whitespace-pre-wrap">{test.text}</div>}
      </section>

      <section className="card p-5 mt-4">
        <h2 className="font-bold">Модели по задачам</h2>
        <p className="text-sm text-mute mt-1">Для каждой задачи своя мощность. Через твой аккаунт Claude выбирается уровень модели; на сервере NGL — любая подключённая модель, в том числе не Claude.</p>
        <div className="mt-4 space-y-3">
          {TASKS.map((t) => (
            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1"><div className="text-sm font-semibold">{t.title}</div><div className="text-xs text-dim">{t.hint}</div></div>
              <div className="flex rounded-lg bg-[#0A0E16] border border-line p-1">
                {TIERS.map((x) => (
                  <button key={x.id} title={x.hint} onClick={() => s.setAi({ tiers: { ...s.ai.tiers, [t.id]: x.id } })}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${s.ai.tiers[t.id] === x.id ? 'bg-s2 text-ink' : 'text-dim hover:text-ink'}`}>{x.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 mt-4">
        <h2 className="font-bold">Научные инструменты и модели</h2>
        <p className="text-sm text-mute mt-1">Наставник не считает «в уме»: для точных вычислений он вызывает инструменты. Включи нужные.</p>
        <div className="mt-4 space-y-2">
          {SCI_TOOLS.map((t) => (
            <button key={t.name} onClick={() => toggleTool(t.name)} role="switch" aria-checked={toolOn(t.name)} className="w-full flex items-start gap-3 rounded-lg border border-line p-3 text-left hover:border-s3">
              <Icon name="calculate" className="text-teal-soft mt-0.5" />
              <span className="flex-1"><span className="text-sm font-semibold">{t.domain}</span> <span className="font-mono text-[11px] text-dim">{t.name}</span><span className="block text-xs text-mute mt-0.5">{t.description}</span></span>
              <span className={`w-11 h-6 rounded-full p-0.5 shrink-0 transition-colors ${toolOn(t.name) ? 'bg-teal' : 'bg-s3'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${toolOn(t.name) ? 'translate-x-5' : ''}`} /></span>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-s3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Icon name="add_link" className="text-violet-soft" />Внешние научные модели</div>
          <p className="text-xs text-mute mt-1">Wolfram, SymPy, химические и биологические предикторы, собственные модели подключаются на сервере NGL одной записью в <span className="font-mono">server/models.json</span>: адрес, описание и схема входа. После этого наставник сам решает, когда к ним обратиться, и объясняет результат.</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {['Wolfram|Alpha', 'SymPy', 'Химический предиктор', 'Своя модель (HTTP)'].map((m) => <span key={m} className="chip bg-s2 text-dim">{m} · через сервер</span>)}
          </div>
        </div>
      </section>

      <section className="card p-5 mt-4">
        <h2 className="font-bold">Стиль наставника</h2>
        <div className="flex rounded-lg bg-[#0A0E16] border border-line p-1 mt-3 max-w-md">
          {([['socratic', 'Сократовский диалог'], ['direct', 'Прямые ответы']] as const).map(([v, t]) => (
            <button key={v} onClick={() => s.setPrefs({ mentorStyle: v })} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${s.prefs.mentorStyle === v ? 'bg-s2 text-ink' : 'text-dim'}`}>{t}</button>
          ))}
        </div>
        <p className="text-xs text-dim mt-2">{s.prefs.mentorStyle === 'socratic' ? 'Наводящие вопросы: доходишь до ответа сам, прямой ответ — если застрял.' : 'Короткое объяснение, пример, аналогия и вопрос для самопроверки.'}</p>
      </section>

      <section className="card p-5 mt-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">Что наставник знает о тебе</h2><span className="text-xs text-dim">{s.aiMemory.length} заметок</span></div>
        <p className="text-sm text-mute mt-1">Наставник записывает наблюдения после проверок «объясни сам». Они учитываются в каждом ответе. Можно удалить или добавить своё.</p>
        <ul className="mt-3 space-y-1.5">
          {s.aiMemory.map((m) => (
            <li key={m} className="flex items-center gap-2 rounded-lg bg-s2/60 px-3 py-2 text-sm">
              <Icon name="psychology" className="text-[18px] text-violet-soft" /><span className="flex-1">{m}</span>
              <button onClick={() => s.forget(m)} className="text-dim hover:text-rose-soft" aria-label="Удалить"><Icon name="close" className="text-[18px]" /></button>
            </li>
          ))}
          {s.aiMemory.length === 0 && <li className="text-sm text-dim">Пока пусто.</li>}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (fact.trim()) { s.remember(fact.trim()); setFact('') } }} className="flex gap-2 mt-3">
          <input id="ai-fact" className="input !py-2" value={fact} onChange={(e) => setFact(e.target.value)} placeholder="Например: лучше понимаю на примерах из игр" />
          <button className="btn-secondary !py-2">Добавить</button>
        </form>
      </section>
    </div>
  )
}
