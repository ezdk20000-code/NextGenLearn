import { useState } from 'react'
import { Link } from 'react-router-dom'
import { labById, nodeById, trackById, trackOfNode } from '../data'
import { useStore, type LearnEvent } from '../store'
import { Icon, PageHeader, Stat } from '../components/ui'

const KIND: Record<LearnEvent['type'], { icon: string; tone: string; label: string }> = {
  lesson: { icon: 'menu_book', tone: 'text-violet-soft bg-violet/15', label: 'Урок' },
  lab: { icon: 'science', tone: 'text-teal-soft bg-teal/15', label: 'Лаборатория' },
  focus: { icon: 'center_focus_strong', tone: 'text-amber-soft bg-amber/15', label: 'Фокус' },
  enroll: { icon: 'flag', tone: 'text-mute bg-s2', label: 'Новый трек' },
  card: { icon: 'add_card', tone: 'text-mute bg-s2', label: 'Карточка' },
}

function trackOfEvent(e: LearnEvent) {
  if (e.type === 'lesson') return trackOfNode(e.ref)?.id
  if (e.type === 'lab') return labById(e.ref)?.trackId
  if (e.type === 'enroll') return e.ref
  return undefined
}

export default function History() {
  const s = useStore()
  const [filter, setFilter] = useState<string>('all')
  const events = [...s.events].sort((a, b) => b.at - a.at).filter((e) => filter === 'all' || trackOfEvent(e) === filter || (filter === 'focus' && e.type === 'focus'))
  const lessons = s.events.filter((e) => e.type === 'lesson')
  const firstTry = lessons.reduce((a, e) => a + (e.firstTry ?? 0), 0)
  const total = lessons.reduce((a, e) => a + (e.total ?? 0), 0)
  const graded = s.reviewLog.filter((l) => l.before === 'review')
  const ret = graded.length ? Math.round((graded.filter((l) => l.grade > 1).length / graded.length) * 100) : null

  const share = async () => {
    const text = [`${s.name} · NextGenLearn`, `Уровень ${s.level}, ${s.xp} XP, серия ${s.streak} дн.`,
      ...s.enrolled.map((t) => `• ${trackById(t)!.title}: ${s.progressOf(t)}%`),
      `Лабораторий пройдено: ${s.labsDone.length}`].join('\n')
    try { await navigator.clipboard.writeText(text); s.notify('Сводка портфолио скопирована') } catch { s.notify('Не удалось скопировать') }
  }

  // группировка по дням
  const groups: { day: string; items: LearnEvent[] }[] = []
  events.forEach((e) => {
    const day = new Date(e.at).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, items: [] })
    groups[groups.length - 1].items.push(e)
  })

  return (
    <div>
      <PageHeader eyebrow="Портфолио" title="История и достижения" sub="Всё, что ты прошёл: уроки, лаборатории и фокус-сессии — с результатами."
        right={<button onClick={share} className="btn-secondary"><Icon name="ios_share" className="text-[18px]" />Скопировать сводку</button>} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="Понятий освоено" value={s.lessonsDone.length} hint={`${s.enrolled.length} ${s.enrolled.length === 1 ? 'трек' : 'трека'}`} icon="hub" />
        <Stat label="Лабораторий" value={s.labsDone.length} hint="пройдено успешно" icon="science" tone="teal" />
        <Stat label="С первой попытки" value={total ? `${Math.round((firstTry / total) * 100)}%` : '—'} hint={`${firstTry} из ${total} заданий в уроках`} icon="target" tone="teal" />
        <Stat label="Удержание в памяти" value={ret === null ? '—' : `${ret}%`} hint="ответы на карточки в срок" icon="psychology" tone="amber" />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[{ id: 'all', t: 'Всё' }, ...s.enrolled.map((t) => ({ id: t, t: trackById(t)!.title })), { id: 'focus', t: 'Фокус-сессии' }].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`chip !text-xs !px-3 !py-1.5 shrink-0 border ${filter === f.id ? 'border-violet bg-violet/10 text-violet-soft' : 'border-line text-mute'}`}>{f.t}</button>
        ))}
      </div>

      <div className="space-y-6">
        {groups.length === 0 && <div className="card p-8 text-center text-mute">Здесь пока пусто.</div>}
        {groups.map((g) => (
          <section key={g.day}>
            <div className="label mb-2 first-letter:uppercase">{g.day}</div>
            <div className="card divide-y divide-line">
              {g.items.map((e, i) => {
                const k = KIND[e.type]
                const node = e.type === 'lesson' ? nodeById(e.ref) : undefined
                const lab = e.type === 'lab' ? labById(e.ref) : undefined
                const title = node?.title ?? lab?.title ?? (e.type === 'enroll' ? trackById(e.ref)?.title : e.type === 'focus' ? `Фокус-сессия ${e.minutes} мин` : s.cardDef(e.ref)?.front ?? 'Карточка')
                const to = node ? `/lesson/${node.id}` : lab ? `/lab/${lab.id}` : e.type === 'enroll' ? `/track/${e.ref}` : undefined
                return (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${k.tone}`}><Icon name={k.icon} className="text-[20px]" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-dim">{k.label} · {new Date(e.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                      {to ? <Link to={to} className="font-semibold hover:text-violet-soft block truncate">{title}</Link> : <div className="font-semibold truncate">{title}</div>}
                    </div>
                    <div className="text-right text-xs shrink-0">
                      {e.xp > 0 && <div className="font-mono text-violet-soft">+{e.xp} XP</div>}
                      {e.type === 'lesson' && e.total !== undefined && <div className="text-dim">{e.firstTry}/{e.total} с первой</div>}
                      {e.type === 'lab' && e.mistakes !== undefined && <div className="text-dim">ошибок: {e.mistakes}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
