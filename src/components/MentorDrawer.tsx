import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SCI_TOOLS } from '../../shared/sci-tools'
import type { ChatTurn } from '../../shared/tutor'
import { aiErrorText, useAi } from '../ai/AiContext'
import { Icon, Md } from './ui'

const QUICK = ['Объясни проще', 'Приведи пример из жизни', 'Проверь меня вопросом', 'Где это пригодится?']
const toolLabel = (n: string) => SCI_TOOLS.find((t) => t.name === n)?.domain ?? n

export default function MentorDrawer() {
  const ai = useAi()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [live, setLive] = useState<string | null>(null)
  const [tool, setTool] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const busy = live !== null

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [turns, live])
  useEffect(() => {
    if (!ai.mentorOpen) return
    const p = ai.takePrompt()
    if (p) void send(p)
  }, [ai.mentorOpen]) // eslint-disable-line

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const history: ChatTurn[] = [...turns, { role: 'user' as const, content: q }].slice(-20)
    setTurns(history); setDraft(''); setError(null); setLive(''); setTool(null)
    ctl.current = new AbortController()
    try {
      const answer = await ai.channel.mentor(ai.learner(), history, {
        signal: ctl.current.signal,
        onText: (t) => setLive(t),
        onTool: (n) => setTool(n),
      })
      setTurns((h) => [...h, { role: 'assistant', content: answer }])
    } catch (e) {
      const partial = (e as { text?: string }).text
      if (partial) setTurns((h) => [...h, { role: 'assistant', content: partial + ' …' }])
      if ((e as { code?: string }).code !== 'cancelled') setError(aiErrorText(e))
    } finally {
      setLive(null); setTool(null)
    }
  }

  const statusChip = ai.status === 'ready'
    ? <span className="chip bg-teal/15 text-teal-soft"><span className="w-1.5 h-1.5 rounded-full bg-teal" />{ai.channel.label}</span>
    : ai.status === 'checking' ? <span className="chip bg-s2 text-dim">Подключаю…</span>
    : <span className="chip bg-amber/15 text-amber-soft">Офлайн</span>

  return (
    <>
      {!ai.mentorOpen && (
        <button onClick={() => ai.openMentor()} className="fixed z-30 right-4 md:right-6 bottom-20 md:bottom-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet to-[#8B5CF6] px-4 py-3 text-sm font-semibold shadow-glow hover:brightness-110" aria-label="Открыть ИИ-наставника">
          <Icon name="smart_toy" fill className="text-[20px]" />Наставник
        </button>
      )}
      {ai.mentorOpen && (
        <div className="fixed inset-0 z-40 md:inset-auto md:right-4 md:bottom-4 md:top-20 md:w-[420px] flex flex-col bg-[rgba(17,24,39,0.97)] backdrop-blur-md md:rounded-xl border border-violet/25 shadow-2xl pop">
          <div className="flex items-center gap-2 p-4 border-b border-line">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet to-teal grid place-items-center"><Icon name="smart_toy" fill className="text-[20px]" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">ИИ-наставник</div>
              <div className="mt-1">{statusChip}</div>
            </div>
            {turns.length > 0 && <button onClick={() => { ctl.current?.abort(); setTurns([]); setError(null) }} className="btn-ghost !p-2" title="Новый разговор" aria-label="Новый разговор"><Icon name="add_comment" className="text-[20px]" /></button>}
            <button onClick={ai.closeMentor} className="btn-ghost !p-2" aria-label="Закрыть"><Icon name="close" /></button>
          </div>

          {ai.topic && (
            <div className="px-4 py-2 border-b border-line text-xs text-mute flex items-center gap-1.5">
              <Icon name="my_location" className="text-[14px] text-violet-soft" />Тема: <b className="text-ink truncate">{ai.topic.title}</b>
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {turns.length === 0 && !busy && (
              <div className="text-sm text-mute">
                <p>Спроси что угодно по теме. Наставник знает, что ты уже прошёл, где у тебя пробелы, и подстраивается под твой стиль.</p>
                {ai.status === 'fallback' && (
                  <p className="mt-3 rounded-lg bg-amber/10 text-amber-soft p-3 text-xs">ИИ сейчас не подключён — отвечу коротко без него. Подключение: <Link to="/settings/ai" onClick={ai.closeMentor} className="underline">Профиль → ИИ-наставник</Link>.</p>
                )}
              </div>
            )}
            {turns.map((t, i) => <Bubble key={i} t={t} />)}
            {busy && (
              <div>
                {tool && <div className="text-[11px] font-mono text-teal-soft mb-1 flex items-center gap-1"><Icon name="calculate" className="text-[14px]" />считаю точно: {toolLabel(tool)}</div>}
                {live ? <Bubble t={{ role: 'assistant', content: live }} /> : <div className="text-sm text-dim flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse" />Думаю…</div>}
              </div>
            )}
            {error && <div className="rounded-lg bg-rose/10 text-rose-soft p-3 text-sm">{error}</div>}
          </div>

          <div className="p-3 border-t border-line" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
            {!busy && turns.length < 2 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK.map((q) => <button key={q} onClick={() => send(ai.topic ? `${q}: «${ai.topic.title}»` : q)} className="chip border border-line text-mute hover:text-ink hover:border-violet/50">{q}</button>)}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void send(draft) }} className="flex gap-2">
              <textarea id="mentor-input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft) } }}
                placeholder="Спроси наставника…" className="input !py-2.5 resize-none max-h-32" aria-label="Вопрос наставнику" />
              {busy
                ? <button type="button" onClick={() => ctl.current?.abort()} className="btn-secondary !px-3" aria-label="Остановить"><Icon name="stop" fill className="text-[18px]" /></button>
                : <button className="btn-primary !px-3" disabled={!draft.trim()} aria-label="Отправить"><Icon name="send" className="text-[18px]" /></button>}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Bubble({ t }: { t: ChatTurn }) {
  if (t.role === 'user') return <div className="ml-8 rounded-xl rounded-br-sm bg-violet/20 border border-violet/30 px-3.5 py-2.5 text-sm">{t.content}</div>
  return (
    <div className="mr-4 rounded-xl rounded-bl-sm bg-s2 px-3.5 py-2.5 text-sm leading-6 space-y-2">
      {t.content.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-wrap"><Md text={p} /></p>)}
    </div>
  )
}
