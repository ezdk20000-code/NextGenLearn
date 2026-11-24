import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BOOKS, CS_PROGRAM, ENGINES, programStats, type ModuleLevel } from '../data/cs-program'
import EvolutionBlock from '../components/EvolutionBlock'
import { Icon, PageHeader } from '../components/ui'

const LEVEL_TONE: Record<ModuleLevel, string> = {
  'Новичок': 'bg-teal/15 text-teal-soft',
  'Практик': 'bg-violet/15 text-violet-soft',
  'Специалист': 'bg-amber/15 text-amber-soft',
  'Эксперт': 'bg-rose/15 text-rose-soft',
}

/** Обзор программы: путь из 7 курсов. */
export function ProgramOverview() {
  const st = programStats()
  const engines = Object.values(ENGINES)
  return (
    <div>
      <PageHeader eyebrow="Программа · по 9 твоим книгам" title={CS_PROGRAM.title} sub={CS_PROGRAM.subtitle} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-6">
        {[['Курсов', st.courses], ['Модулей', st.modules], ['Понятий', st.concepts], ['Лабораторий', st.labs], ['Проектов', st.projects], ['Обновлений', st.updates], ['Недель', `≈${st.weeks}`]].map(([k, v]) => (
          <div key={k} className="card p-3"><div className="font-mono text-[10px] uppercase tracking-wider text-dim">{k}</div><div className="text-xl font-bold mt-1">{v}</div></div>
        ))}
      </div>

      <div className="card p-4 mb-6 flex gap-3 text-sm">
        <Icon name="info" className="text-violet-soft shrink-0" />
        <p className="text-mute">Это <b className="text-ink">структура программы</b>: что будет в каждом курсе и модуле. Уроки, лаборатории и экзамены пишутся по ней модуль за модулем. В каждом уроке — ссылка на главу твоей книги и обновления «было → стало», если технология изменилась после издания.</p>
      </div>

      <h2 className="text-lg font-bold mb-3">Путь</h2>
      <ol className="space-y-3">
        {CS_PROGRAM.courses.map((c, i) => {
          const concepts = c.modules.reduce((a, m) => a + m.concepts.length, 0)
          const labs = c.modules.reduce((a, m) => a + m.labs.length, 0)
          return (
            <li key={c.id}>
              <Link to={`/program/${c.id}`} className="card card-hover p-5 flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex items-center gap-3 md:w-20 shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet to-teal grid place-items-center font-mono font-bold">{c.code}</div>
                  {i < CS_PROGRAM.courses.length - 1 && <Icon name="south" className="text-dim md:hidden" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg">{c.title}</div>
                  <p className="text-sm text-mute mt-0.5">{c.subtitle}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-mono text-[11px] text-dim">
                    <span>{c.modules.length} модулей</span><span>{concepts} понятий</span><span>{labs} лабораторий</span><span>≈{c.weeks} нед</span>
                  </div>
                  <div className="text-xs text-dim mt-2 flex items-center gap-1 min-w-0"><Icon name="menu_book" className="text-[15px] shrink-0" /><span className="truncate">{c.books.join(' · ')}</span></div>
                </div>
                <Icon name="chevron_right" className="text-dim hidden md:block" />
              </Link>
            </li>
          )
        })}
      </ol>

      <h2 className="text-lg font-bold mt-8 mb-3">Движки лабораторий</h2>
      <p className="text-sm text-mute mb-3">95 лабораторий собираются из 12 движков. Четыре уже работают в NGL, остальные будут созданы под программу.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(ENGINES).map(([id, e]) => {
          const count = CS_PROGRAM.courses.flatMap((c) => c.modules).flatMap((m) => m.labs).filter((l) => l.engine === id).length
          return (
            <div key={id} className="card p-3 flex items-center gap-3">
              <Icon name={e.icon} className={e.ready ? 'text-teal-soft' : 'text-dim'} />
              <span className="flex-1 text-sm">{e.label}</span>
              <span className="font-mono text-[11px] text-dim">{count} лаб.</span>
              <span className={`chip ${e.ready ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}>{e.ready ? 'готов' : 'будет'}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-dim mt-2">Готово движков: {engines.filter((e) => e.ready).length} из {engines.length}.</p>

      <h2 className="text-lg font-bold mt-8 mb-3">Книги-источники</h2>
      <ul className="card divide-y divide-line">
        {Object.values(BOOKS).map((b) => <li key={b} className="p-3 text-sm flex gap-2"><Icon name="menu_book" className="text-[18px] text-violet-soft" />{b}</li>)}
      </ul>
    </div>
  )
}

/** Курс программы: модули, понятия, лаборатории, проекты, обновления. */
export function ProgramCourse() {
  const { id = '' } = useParams()
  const idx = CS_PROGRAM.courses.findIndex((c) => c.id === id)
  const c = CS_PROGRAM.courses[idx]
  const [open, setOpen] = useState<string | null>(c?.modules[0]?.id ?? null)
  if (!c) return <Navigate to="/program" replace />
  const prev = CS_PROGRAM.courses[idx - 1]
  const next = CS_PROGRAM.courses[idx + 1]

  return (
    <div className="max-w-5xl">
      <Link to="/program" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Программа</Link>
      <div className="font-mono text-xs text-violet-soft">{c.code} · ≈{c.weeks} недель · {c.modules.length} модулей</div>
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
        {prev ? <Link to={`/program/${prev.id}`} className="btn-secondary"><Icon name="arrow_back" className="text-[18px]" />{prev.code}</Link> : <span />}
        {next && <Link to={`/program/${next.id}`} className="btn-primary">{next.code}: {next.title}<Icon name="arrow_forward" className="text-[18px]" /></Link>}
      </div>
    </div>
  )
}
