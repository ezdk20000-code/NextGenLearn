import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BOOKS, CS_PROGRAM, ENGINES, programStats, type ModuleLevel } from '../data/cs-program'
import EvolutionBlock from '../components/EvolutionBlock'
import { Icon } from '../components/ui'

const LEVEL_TONE: Record<ModuleLevel, string> = {
  'Новичок': 'bg-teal/15 text-teal-soft',
  'Практик': 'bg-violet/15 text-violet-soft',
  'Специалист': 'bg-amber/15 text-amber-soft',
  'Эксперт': 'bg-rose/15 text-rose-soft',
}

/** Раздел программы в каталоге треков: 7 курсов по порядку прохождения. */
export function CsProgramSection({ q }: { q: string }) {
  const [about, setAbout] = useState(false)
  const st = programStats()
  const needle = q.trim().toLowerCase()
  const courses = CS_PROGRAM.courses.filter((c) => !needle || `${c.code} ${c.title} ${c.subtitle} ${c.modules.map((m) => `${m.title} ${m.concepts.join(' ')}`).join(' ')}`.toLowerCase().includes(needle))
  if (!courses.length) return null
  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="school" className="text-violet-soft" />{CS_PROGRAM.title}</h2>
          <p className="text-sm text-mute mt-0.5">Программа из {st.courses} курсов по твоим 9 книгам · {st.modules} модулей · {st.concepts} понятий · {st.labs} лабораторий · ≈{st.weeks} недель</p>
        </div>
        <button onClick={() => setAbout((a) => !a)} className="btn-ghost !px-2 !py-1.5 text-xs shrink-0" aria-expanded={about}>О программе <Icon name={about ? 'expand_less' : 'expand_more'} className="text-[16px]" /></button>
      </div>
      {about && (
        <div className="card p-4 mb-3 grid gap-4 md:grid-cols-2 pop">
          <div>
            <div className="label mb-2">Книги-источники</div>
            <ul className="space-y-1 text-sm text-mute">{Object.values(BOOKS).map((b) => <li key={b} className="flex gap-2"><Icon name="menu_book" className="text-[16px] text-violet-soft shrink-0 mt-0.5" />{b}</li>)}</ul>
          </div>
          <div>
            <div className="label mb-2">Движки лабораторий · готово {Object.values(ENGINES).filter((e) => e.ready).length} из {Object.keys(ENGINES).length}</div>
            <div className="flex flex-wrap gap-1.5">{Object.values(ENGINES).map((e) => <span key={e.label} className={`chip ${e.ready ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}><Icon name={e.icon} className="text-[14px]" />{e.label}</span>)}</div>
            <p className="text-xs text-dim mt-3">Уроки пишутся по структуре модуль за модулем. В каждом — ссылка на главу книги и обновления «было → стало».</p>
          </div>
        </div>
      )}
      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const step = CS_PROGRAM.courses.indexOf(c) + 1
          const concepts = c.modules.reduce((a, m) => a + m.concepts.length, 0)
          const labs = c.modules.reduce((a, m) => a + m.labs.length, 0)
          return (
            <li key={c.id}>
              <Link to={`/catalog/${c.id}`} className="card card-hover overflow-hidden flex flex-col h-full">
                <div className="relative h-24 bg-gradient-to-br from-[#312E81] to-[#0F766E] grid-bg">
                  <span className="absolute left-4 top-4 chip bg-black/40 backdrop-blur text-white/90 border border-white/15">Шаг {step} из {CS_PROGRAM.courses.length}</span>
                  <span className="absolute right-4 bottom-2 font-mono text-4xl font-bold text-white/25">{c.code}</span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="font-bold text-lg leading-snug">{c.title}</div>
                  <p className="text-sm text-mute mt-1.5 line-clamp-3 flex-1">{c.subtitle}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4 text-xs text-mute">
                    <span className="flex items-center gap-1.5"><Icon name="view_module" className="text-[16px] text-dim" />{c.modules.length} модулей</span>
                    <span className="flex items-center gap-1.5"><Icon name="hub" className="text-[16px] text-dim" />{concepts} понятий</span>
                    <span className="flex items-center gap-1.5"><Icon name="science" className="text-[16px] text-dim" />{labs} лабораторий</span>
                    <span className="flex items-center gap-1.5"><Icon name="calendar_month" className="text-[16px] text-dim" />≈{c.weeks} нед</span>
                  </div>
                  <span className="btn-secondary w-full mt-4">Программа курса <Icon name="arrow_forward" className="text-[18px]" /></span>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Курс программы: модули, понятия, лаборатории, проекты, обновления. */
export function ProgramCourse() {
  const { id = '' } = useParams()
  const idx = CS_PROGRAM.courses.findIndex((c) => c.id === id)
  const c = CS_PROGRAM.courses[idx]
  const [open, setOpen] = useState<string | null>(c?.modules[0]?.id ?? null)
  if (!c) return <Navigate to="/catalog" replace />
  const prev = CS_PROGRAM.courses[idx - 1]
  const next = CS_PROGRAM.courses[idx + 1]

  return (
    <div className="max-w-5xl">
      <Link to="/catalog" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Каталог треков</Link>
      <div className="font-mono text-xs text-violet-soft">{CS_PROGRAM.title} · шаг {idx + 1} из {CS_PROGRAM.courses.length} · {c.code} · ≈{c.weeks} недель · {c.modules.length} модулей</div>
      <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-1">{c.title}</h1>
      <p className="text-mute mt-1 max-w-3xl">{c.subtitle}</p>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <div className="card p-5">
          <h2 className="font-bold">После курса ты сможешь</h2>
          <ul className="mt-3 space-y-2">{c.outcomes.map((o) => <li key={o} className="flex gap-2 text-sm"><Icon name="check_circle" fill className="text-teal-soft text-[18px] shrink-0" />{o}</li>)}</ul>
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Итоговые проекты</h2>
          <ul className="mt-3 space-y-2">{c.capstones.map((o) => <li key={o} className="flex gap-2 text-sm"><Icon name="workspace_premium" className="text-amber-soft text-[18px] shrink-0" />{o}</li>)}</ul>
          <div className="mt-4 text-xs text-dim">
            {c.requires.length > 0 && <>Перед курсом: {c.requires.map((r) => CS_PROGRAM.courses.find((x) => x.id === r)!.title).join(', ')}. </>}
            Книги: {c.books.join('; ')}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mt-8 mb-3">Модули</h2>
      <div className="space-y-2">
        {c.modules.map((m, i) => {
          const isOpen = open === m.id
          return (
            <section key={m.id} className={`card overflow-hidden ${isOpen ? 'border-violet/40' : ''}`}>
              <button onClick={() => setOpen(isOpen ? null : m.id)} className="w-full p-4 flex items-center gap-3 text-left" aria-expanded={isOpen}>
                <span className="w-8 h-8 rounded-lg bg-s2 grid place-items-center font-mono text-sm shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-semibold block">{m.title}</span>
                  <span className="font-mono text-[11px] text-dim">{m.concepts.length} понятий · {m.labs.length} лаб.{m.project ? ' · проект' : ''}{m.evolution.length ? ` · ${m.evolution.length} обновл.` : ''}</span>
                </span>
                <span className={`chip ${LEVEL_TONE[m.level]} hidden sm:inline-flex`}>{m.level}</span>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} className="text-dim" />
              </button>
              {isOpen && (
                <div className="px-4 pb-5 space-y-5 pop">
                  <div>
                    <div className="label mb-2">Понятия — у каждого будет полный урок</div>
                    <div className="flex flex-wrap gap-1.5">{m.concepts.map((x) => <span key={x} className="chip bg-s2 text-mute !font-medium">{x}</span>)}</div>
                  </div>
                  <div>
                    <div className="label mb-2">Лаборатории</div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {m.labs.map((l) => (
                        <li key={l.title} className="rounded-lg border border-line p-3">
                          <div className="flex items-center gap-2"><Icon name={ENGINES[l.engine].icon} className="text-[18px] text-teal-soft" /><span className="text-sm font-semibold">{l.title}</span></div>
                          <div className="text-xs text-mute mt-1">{l.goal}</div>
                          <div className="font-mono text-[10px] text-dim mt-1.5">движок: {ENGINES[l.engine].label}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {m.project && <div className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm flex gap-2"><Icon name="assignment" className="text-amber-soft text-[18px]" /><span><b>Проект модуля:</b> {m.project}</span></div>}
                  {m.evolution.length > 0 && <div className="space-y-2">{m.evolution.map((e) => <EvolutionBlock key={e.topic} e={e} compact />)}</div>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
                    <span className="flex items-center gap-1"><Icon name="menu_book" className="text-[15px]" />{m.sources.join(' · ')}</span>
                    <span className="flex items-center gap-1"><Icon name="quiz" className="text-[15px]" />Экзамен модуля в конце</span>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="flex justify-between gap-2 mt-8">
        {prev ? <Link to={`/catalog/${prev.id}`} className="btn-secondary"><Icon name="arrow_back" className="text-[18px]" />{prev.code}</Link> : <span />}
        {next && <Link to={`/catalog/${next.id}`} className="btn-primary">{next.code}: {next.title}<Icon name="arrow_forward" className="text-[18px]" /></Link>}
      </div>
    </div>
  )
}
