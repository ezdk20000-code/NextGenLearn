import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { trackById } from '../data'
import { useStore } from '../store'
import { BOOKS, CS_PROGRAM, ENGINES, programStats, type ModuleLevel } from '../data/cs-program'
import EvolutionBlock from '../components/EvolutionBlock'
import Cs1Tower from './Cs1Tower'
import { Icon } from '../components/ui'

const LEVEL_TONE: Record<ModuleLevel, string> = {
  'Новичок': 'bg-teal/15 text-teal-soft',
  'Практик': 'bg-violet/15 text-violet-soft',
  'Специалист': 'bg-amber/15 text-amber-soft',
  'Эксперт': 'bg-rose/15 text-rose-soft',
}

export const CS_PROGRAM_ID = 'cs'
const COVER = 'covers/cs-program.webp'

/** Кнопка «Начать / Продолжить курс», если уроки курса уже готовы. */
function StartCourse({ courseId, label, className = 'btn-primary' }: { courseId: string; label?: string; className?: string }) {
  const s = useStore()
  const nav = useNavigate()
  const t = trackById(courseId)
  if (!t?.playable) return <span className="btn-secondary opacity-70 cursor-default"><Icon name="edit_note" className="text-[18px]" />Уроки курса пишутся</span>
  const isIn = s.enrolled.includes(t.id)
  return (
    <button className={className} onClick={() => { if (!isIn) { s.enroll(t.id); s.notify(`Курс «${t.title}» начат`) } else s.setActiveTrack(t.id); nav(`/track/${t.id}`) }}>
      <Icon name={isIn ? 'hub' : 'play_arrow'} fill className="text-[18px]" />{isIn ? `Продолжить · ${s.progressOf(t.id)}%` : label ?? 'Начать курс'}
    </button>
  )
}

const searchText = () => `${CS_PROGRAM.title} ${CS_PROGRAM.subtitle} computer science ${CS_PROGRAM.courses.map((c) => `${c.code} ${c.title} ${c.subtitle} ${c.modules.map((m) => `${m.title} ${m.concepts.join(' ')}`).join(' ')}`).join(' ')}`.toLowerCase()
export const csProgramMatches = (q: string) => !q.trim() || searchText().includes(q.trim().toLowerCase())

function ProgramCover({ className = 'h-36' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#312E81] to-[#0F766E] ${className}`}>
      <img src={COVER} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent opacity-80" />
      <div className="absolute left-4 top-4 flex gap-1.5">
        <span className="chip bg-black/40 backdrop-blur text-white/90 border border-white/15">Мастерство</span>
        <span className="chip bg-amber/90 text-[#2a1700]">Новый</span>
        <span className="chip bg-black/40 backdrop-blur text-white/90 border border-white/15">{CS_PROGRAM.courses.length} курсов</span>
      </div>
    </div>
  )
}

/** Карточка программы CS в каталоге — в том же стиле, что и остальные треки. */
export function CsProgramCard() {
  const st = programStats()
  const facts = [
    { icon: 'calendar_month', t: `≈${st.weeks} нед · ${st.courses} курсов` },
    { icon: 'hub', t: `${st.concepts} понятий` },
    { icon: 'science', t: `${st.labs} лабораторий` },
    { icon: 'assignment', t: `${st.projects} проект · ${st.modules} модулей` },
  ]
  return (
    <article className="card overflow-hidden flex flex-col card-hover">
      <Link to={`/catalog/${CS_PROGRAM_ID}`}><ProgramCover /></Link>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex flex-wrap gap-1.5">{['Computer Science', 'Железо', 'ОС', 'Сети', 'Безопасность'].map((x) => <span key={x} className="text-[10px] font-bold uppercase tracking-wider text-dim">{x}</span>)}</div>
        <Link to={`/catalog/${CS_PROGRAM_ID}`} className="text-lg font-bold leading-snug mt-2 hover:text-violet-soft">{CS_PROGRAM.title}</Link>
        <p className="text-sm text-mute mt-1.5 line-clamp-3">{CS_PROGRAM.subtitle}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-4 text-xs text-mute">
          {facts.map((f) => <div key={f.icon} className="flex items-center gap-1.5 min-w-0"><Icon name={f.icon} className="text-[16px] text-dim shrink-0" /><span className="truncate">{f.t}</span></div>)}
        </div>
        <div className="mt-auto pt-5">
          <Link to={`/catalog/${CS_PROGRAM_ID}`} className="btn-primary w-full">Открыть программу <Icon name="arrow_forward" className="text-[18px]" /></Link>
        </div>
      </div>
    </article>
  )
}

/** Страница программы: описание и 7 шагов-курсов по порядку прохождения. */
export function ProgramOverview() {
  const [about, setAbout] = useState(false)
  const st = programStats()
  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/catalog" className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Каталог</Link>
      <div className="card overflow-hidden">
        <ProgramCover className="h-44 md:h-56" />
        <div className="p-5 md:p-7 -mt-16 relative">
          <div className="label text-teal-soft">Computer Science · {st.courses} курсов · ≈{st.weeks} недель</div>
          <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">{CS_PROGRAM.title}</h1>
          <p className="text-mute mt-1 max-w-3xl">{CS_PROGRAM.subtitle}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-5">
            {[['view_module', st.modules, 'модулей'], ['hub', st.concepts, 'понятий'], ['science', st.labs, 'лабораторий'], ['assignment', st.projects, 'проектов'], ['update', st.updates, 'обновлений «было → стало»'], ['menu_book', Object.keys(BOOKS).length, 'книг-источников']].map(([icon, n, l]) => (
              <div key={l as string} className="rounded-lg border border-line bg-[#0A0E16] p-3">
                <Icon name={icon as string} className="text-violet-soft text-[18px]" />
                <div className="text-xl font-bold mt-1">{n}</div>
                <div className="text-[11px] text-dim leading-tight">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <StartCourse courseId={CS_PROGRAM.courses[0].id} label={`Начать с шага 1: ${CS_PROGRAM.courses[0].code}`} />
            <button onClick={() => setAbout((a) => !a)} className="btn-secondary" aria-expanded={about}>О программе <Icon name={about ? 'expand_less' : 'expand_more'} className="text-[18px]" /></button>
          </div>
          {about && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 pop">
              <div>
                <div className="label mb-2">Книги-источники</div>
                <ul className="space-y-1 text-sm text-mute">{Object.values(BOOKS).map((b) => <li key={b} className="flex gap-2"><Icon name="menu_book" className="text-[16px] text-violet-soft shrink-0 mt-0.5" />{b}</li>)}</ul>
              </div>
              <div>
                <div className="label mb-2">Движки лабораторий · готово {Object.values(ENGINES).filter((e) => e.ready).length} из {Object.keys(ENGINES).length}</div>
                <div className="flex flex-wrap gap-1.5">{Object.values(ENGINES).map((e) => <span key={e.label} className={`chip ${e.ready ? 'bg-teal/15 text-teal-soft' : 'bg-s2 text-dim'}`}><Icon name={e.icon} className="text-[14px]" />{e.label}</span>)}</div>
                <p className="text-xs text-dim mt-3">Уроки пишутся модуль за модулем. В каждом есть ссылка на главу книги и обновления «было → стало».</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold mt-8 mb-3">Шаги программы</h2>
      <ol className="space-y-3">
        {CS_PROGRAM.courses.map((c, i) => {
          const concepts = c.modules.reduce((a, m) => a + m.concepts.length, 0)
          const labs = c.modules.reduce((a, m) => a + m.labs.length, 0)
          return (
            <li key={c.id}>
              <Link to={`/catalog/${c.id}`} className="card card-hover p-4 md:p-5 flex gap-4 items-start">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-gradient-to-br from-[#312E81] to-[#0F766E] grid place-items-center font-mono font-bold text-white/90 shrink-0">{c.code}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-violet-soft">{trackById(c.id)?.playable ? <span className="chip bg-teal/15 text-teal-soft !py-0 mr-2 font-sans">уроки готовы</span> : null}Шаг {i + 1} из {CS_PROGRAM.courses.length}{c.requires.length ? ` · после ${c.requires.map((r) => CS_PROGRAM.courses.find((x) => x.id === r)!.code).join(', ')}` : ''}</div>
                  <div className="font-bold text-lg leading-snug mt-0.5">{c.title}</div>
                  <p className="text-sm text-mute mt-1 line-clamp-2">{c.subtitle}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-mute">
                    <span className="flex items-center gap-1.5"><Icon name="view_module" className="text-[16px] text-dim" />{c.modules.length} модулей</span>
                    <span className="flex items-center gap-1.5"><Icon name="hub" className="text-[16px] text-dim" />{concepts} понятий</span>
                    <span className="flex items-center gap-1.5"><Icon name="science" className="text-[16px] text-dim" />{labs} лабораторий</span>
                    <span className="flex items-center gap-1.5"><Icon name="calendar_month" className="text-[16px] text-dim" />≈{c.weeks} нед</span>
                  </div>
                </div>
                <Icon name="chevron_right" className="text-dim self-center hidden sm:block" />
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
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
    <div className="max-w-5xl mx-auto">
      <Link to={`/catalog/${CS_PROGRAM_ID}`} className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />Программа Computer Science</Link>
      <div className="font-mono text-xs text-violet-soft">{CS_PROGRAM.title} · шаг {idx + 1} из {CS_PROGRAM.courses.length} · {c.code} · ≈{c.weeks} недель · {c.modules.length} модулей</div>
      <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-1">{c.title}</h1>
      <p className="text-mute mt-1 max-w-3xl">{c.subtitle}</p>
      <div className="mt-4"><StartCourse courseId={c.id} /></div>
      {c.id === 'cs1-nand2tetris' && <Cs1Tower />}

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
        {prev ? <Link to={`/catalog/${prev.id}`} className="btn-secondary"><Icon name="arrow_back" className="text-[18px]" />{prev.code}</Link> : <Link to={`/catalog/${CS_PROGRAM_ID}`} className="btn-secondary"><Icon name="arrow_back" className="text-[18px]" />Все шаги</Link>}
        {next && <Link to={`/catalog/${next.id}`} className="btn-primary">{next.code}: {next.title}<Icon name="arrow_forward" className="text-[18px]" /></Link>}
      </div>
    </div>
  )
}
