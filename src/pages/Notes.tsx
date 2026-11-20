import { useState } from 'react'
import { Link } from 'react-router-dom'
import { nodeById, trackById, trackOfNode } from '../data'
import { useStore } from '../store'
import { Icon, PageHeader } from '../components/ui'
import AiCardsButton from '../components/AiCardsButton'

export default function Notes() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const entries = Object.entries(s.notes).filter(([id, text]) => text.trim() && nodeById(id))
    .filter(([id, text]) => !q || `${nodeById(id)!.title} ${text}`.toLowerCase().includes(q.toLowerCase()))
  const byTrack = s.enrolled.map((tid) => ({ t: trackById(tid)!, items: entries.filter(([id]) => trackOfNode(id)?.id === tid) })).filter((g) => g.items.length)
  const words = entries.reduce((a, [, t]) => a + t.split(/\s+/).filter(Boolean).length, 0)

  return (
    <div>
      <div className="relative h-32 md:h-44 rounded-lg overflow-hidden mb-6 border border-line">
        <img src="covers/notes.webp" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/60 to-transparent" />
      </div>
      <PageHeader eyebrow="Память" title="Библиотека конспектов" sub="Твои заметки из уроков и Deep Study, а также объяснения «своими словами». Пересказ — лучший способ проверить понимание."
        right={<Link to="/deep" className="btn-primary"><Icon name="center_focus_strong" className="text-[18px]" />Новая сессия Deep Study</Link>} />
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#0F172A] border border-line px-3 focus-within:border-violet">
          <Icon name="search" className="text-dim text-[20px]" />
          <input id="notes-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по конспектам…" className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-dim" />
        </div>
        <div className="text-sm text-dim self-center">{entries.length} конспектов · {words} слов</div>
      </div>

      {byTrack.length === 0 && (
        <div className="card p-8 text-center">
          <Icon name="edit_note" className="text-[40px] text-dim" />
          <div className="font-semibold mt-2">Конспектов пока нет</div>
          <p className="text-sm text-mute mt-1 max-w-md mx-auto">Пиши заметки во время урока в правой колонке или запусти Deep Study. Объяснения из заданий «объясни сам» попадают сюда автоматически.</p>
        </div>
      )}

      <div className="space-y-8">
        {byTrack.map(({ t, items }) => (
          <section key={t.id}>
            <h2 className="font-bold mb-3 flex items-center gap-2"><Icon name={t.cover.icon} className="text-violet-soft" />{t.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map(([id, text]) => {
                const n = nodeById(id)!
                const isEdit = edit === id
                return (
                  <article key={id} className="card p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="label">{t.category}</div>
                        <Link to={`/lesson/${id}`} className="font-bold hover:text-violet-soft">{n.title}</Link>
                      </div>
                      <div className="flex gap-1">
                        <Link to={`/deep?node=${id}`} className="btn-ghost !p-2" aria-label="Deep Study"><Icon name="center_focus_strong" className="text-[18px]" /></Link>
                        <button onClick={() => { if (isEdit) { s.saveNote(id, draft); setEdit(null); s.notify('Конспект сохранён') } else { setEdit(id); setDraft(text) } }} className="btn-ghost !p-2" aria-label={isEdit ? 'Сохранить' : 'Редактировать'}>
                          <Icon name={isEdit ? 'check' : 'edit'} className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                    {isEdit
                      ? <textarea className="input mt-3 min-h-[160px] !text-[13px] leading-6" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                      : <p className="text-sm text-ink/85 mt-3 whitespace-pre-wrap leading-6 flex-1">{text}</p>}
                    <div className="text-[11px] text-dim mt-3">{text.split(/\s+/).filter(Boolean).length} слов</div>
                    <AiCardsButton nodeId={id} topic={n.title} text={text} />
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
