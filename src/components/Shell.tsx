import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { trackById } from '../data'
import { useStore } from '../store'
import { Icon } from './ui'

const GROUPS = [
  { title: 'Обучение', items: [
    { to: '/', icon: 'home', label: 'Сегодня', end: true },
    { to: '/catalog', icon: 'explore', label: 'Каталог треков' },
    { to: '/track', icon: 'hub', label: 'Древо знаний' },
    { to: '/labs', icon: 'science', label: 'Лаборатории' },
    { to: '/deep', icon: 'center_focus_strong', label: 'Deep Study' },
  ] },
  { title: 'Память', items: [
    { to: '/cards', icon: 'style', label: 'Флеш-карты' },
    { to: '/notes', icon: 'edit_note', label: 'Конспекты' },
  ] },
  { title: 'Прогресс', items: [
    { to: '/plan', icon: 'event_note', label: 'План и фокус' },
    { to: '/analytics', icon: 'monitoring', label: 'Аналитика' },
    { to: '/history', icon: 'workspace_premium', label: 'Портфолио' },
  ] },
]
const MOBILE = [
  { to: '/', icon: 'home', label: 'Сегодня', end: true },
  { to: '/catalog', icon: 'explore', label: 'Треки' },
  { to: '/track', icon: 'hub', label: 'Древо' },
  { to: '/cards', icon: 'style', label: 'Карты' },
]

export default function Shell() {
  const s = useStore()
  const due = s.dueCards().length
  const loc = useLocation()
  const [more, setMore] = useState(false)
  const active = trackById(s.activeTrack)
  useEffect(() => { window.scrollTo(0, 0); setMore(false) }, [loc.pathname])

  const link = (n: { to: string; icon: string; label: string; end?: boolean }) => (
    <NavLink key={n.to} to={n.to} end={n.end}
      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive || (n.to === '/track' && loc.pathname.startsWith('/track')) ? 'bg-violet/15 text-violet-soft' : 'text-mute hover:text-ink hover:bg-s1'}`}>
      <Icon name={n.icon} className="text-[20px]" />
      <span className="flex-1">{n.label}</span>
      {n.to === '/cards' && due > 0 && <span className="chip bg-amber/15 text-amber-soft !py-0.5">{due}</span>}
    </NavLink>
  )

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-[#0A0E16] sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-teal grid place-items-center font-extrabold text-sm">N</div>
          <div>
            <div className="font-extrabold leading-tight">NextGenLearn</div>
            <div className="text-[10px] font-bold tracking-[0.12em] text-teal-soft">NGL · PROTOTYPE</div>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="label !text-dim px-3 mb-1">{g.title}</div>
              <div className="space-y-0.5">{g.items.map(link)}</div>
            </div>
          ))}
        </nav>
        <div className="p-4 shrink-0">
          {active && (
            <Link to={`/track/${active.id}`} className="card p-3 block hover:border-violet/40">
              <div className="label mb-1.5">Текущий трек</div>
              <div className="text-sm font-semibold leading-snug">{active.title}</div>
              <div className="mt-2 h-1.5 rounded-full bg-s2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${s.trackProgress}%` }} />
              </div>
              <div className="text-xs text-dim mt-1.5">{s.trackProgress}% пройдено</div>
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 h-14 md:h-16 border-b border-line bg-canvas/85 backdrop-blur-md flex items-center gap-3 px-4 md:px-8">
          <Link to="/" className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet to-teal grid place-items-center font-extrabold text-xs">N</div>
            <span className="font-extrabold">NGL</span>
          </Link>
          <Link to="/catalog" className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-lg bg-[#0F172A] border border-line px-3 py-2 text-sm text-dim hover:border-s3">
            <Icon name="search" className="text-[18px]" /> Найти трек или тему…
          </Link>
          <div className="flex-1 md:hidden" />
          <div className="chip bg-amber/10 border border-amber/30 text-amber-soft" title="Дней подряд"><Icon name="local_fire_department" fill className="text-[15px]" />{s.streak} дн</div>
          <div className="chip bg-violet/10 border border-violet/30 text-violet-soft"><Icon name="bolt" fill className="text-[15px]" />{s.xp} XP</div>
          <Link to="/profile" className="flex items-center gap-2 pl-1 sm:pl-2">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-[10px] text-teal-soft font-bold tracking-wider">УРОВЕНЬ {s.level}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-soft to-violet grid place-items-center text-sm font-bold text-[#1000a9]">{s.name[0]}</div>
          </Link>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-12 max-w-[1280px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Мобильная навигация */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-[#0A0E16]/95 backdrop-blur-md grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {MOBILE.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${isActive || (n.to === '/track' && loc.pathname.startsWith('/track')) ? 'text-violet-soft' : 'text-dim'}`}>
            <Icon name={n.icon} className="text-[22px]" />
            {n.label}
            {n.to === '/cards' && due > 0 && <span className="absolute top-1.5 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-amber" />}
          </NavLink>
        ))}
        <button onClick={() => setMore((m) => !m)} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${more ? 'text-violet-soft' : 'text-dim'}`}>
          <Icon name="menu" className="text-[22px]" />Ещё
        </button>
      </nav>
      {more && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setMore(false)}>
          <div className="absolute bottom-[60px] inset-x-0 rounded-t-xl border-t border-line bg-s1 p-4 grid grid-cols-3 gap-2 pop" onClick={(e) => e.stopPropagation()}>
            {[...GROUPS.flatMap((g) => g.items), { to: '/profile', icon: 'person', label: 'Профиль' }, { to: '/settings/fsrs', icon: 'tune', label: 'Настройки FSRS' }]
              .filter((n) => !MOBILE.some((m) => m.to === n.to))
              .map((n) => (
                <Link key={n.to} to={n.to} className="flex flex-col items-center gap-1 rounded-lg p-3 text-xs text-mute hover:bg-s2 text-center">
                  <Icon name={n.icon} className="text-[24px] text-violet-soft" />{n.label}
                </Link>
              ))}
          </div>
        </div>
      )}

      {s.toast && (
        <div className="fixed z-50 bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 pop w-max max-w-[calc(100vw-32px)]">
          <div className="flex items-center gap-2 rounded-xl border border-teal/40 bg-[rgba(17,24,39,0.92)] backdrop-blur-md px-4 py-3 text-sm shadow-glow-teal">
            <Icon name="check_circle" fill className="text-teal-soft text-[20px]" />{s.toast}
          </div>
        </div>
      )}
    </div>
  )
}
