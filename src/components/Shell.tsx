import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from '../store'
import { Icon } from './ui'

const NAV = [
  { to: '/', icon: 'home', label: 'Сегодня', end: true },
  { to: '/new', icon: 'auto_awesome', label: 'Новая тема' },
  { to: '/track', icon: 'hub', label: 'Древо знаний' },
  { to: '/labs', icon: 'science', label: 'Лаборатории' },
  { to: '/review', icon: 'style', label: 'Повторение' },
  { to: '/plan', icon: 'event_note', label: 'План и фокус' },
]

export default function Shell() {
  const s = useStore()
  const due = s.dueCards().length
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  return (
    <div className="min-h-screen md:flex">
      {/* Боковая панель (десктоп) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-[#0A0E16] sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-5 h-16">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-teal grid place-items-center font-extrabold text-sm">N</div>
          <div>
            <div className="font-extrabold leading-tight">NextGenLearn</div>
            <div className="text-[10px] font-bold tracking-[0.12em] text-teal-soft">NGL · PROTOTYPE</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-violet/15 text-violet-soft' : 'text-mute hover:text-ink hover:bg-s1'}`}>
              <Icon name={n.icon} className="text-[20px]" />
              <span className="flex-1">{n.label}</span>
              {n.to === '/review' && due > 0 && <span className="chip bg-amber/15 text-amber-soft !py-0.5">{due}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-4">
          <div className="card p-3">
            <div className="label mb-2">Текущий трек</div>
            <div className="text-sm font-semibold leading-snug">Сетевые протоколы с нуля</div>
            <div className="mt-2 h-1.5 rounded-full bg-s2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet to-teal" style={{ width: `${s.trackProgress}%` }} />
            </div>
            <div className="text-xs text-dim mt-1.5">{s.trackProgress}% пройдено</div>
          </div>
          <button onClick={() => { s.reset(); s.notify('Прогресс демо сброшен') }} className="btn-ghost w-full mt-2 !text-xs !py-2">
            <Icon name="restart_alt" className="text-[16px]" /> Сбросить демо
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Верхняя панель */}
        <header className="sticky top-0 z-20 h-14 md:h-16 border-b border-line bg-canvas/85 backdrop-blur-md flex items-center gap-3 px-4 md:px-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet to-teal grid place-items-center font-extrabold text-xs">N</div>
            <span className="font-extrabold">NGL</span>
          </div>
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-lg bg-[#0F172A] border border-line px-3 py-2 text-sm text-dim">
            <Icon name="search" className="text-[18px]" /> Поиск по понятиям, урокам, карточкам…
          </div>
          <div className="flex-1 md:hidden" />
          <div className="chip bg-amber/10 border border-amber/30 text-amber-soft"><Icon name="local_fire_department" fill className="text-[15px]" />{s.streak} дн</div>
          <div className="chip bg-violet/10 border border-violet/30 text-violet-soft"><Icon name="bolt" fill className="text-[15px]" />{s.xp} XP</div>
          <div className="hidden sm:flex items-center gap-2 pl-2">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-[10px] text-teal-soft font-bold tracking-wider">ИССЛЕДОВАТЕЛЬ · УР. {1 + Math.floor(s.xp / 250)}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-soft to-violet grid place-items-center text-sm font-bold text-[#1000a9]">{s.name[0]}</div>
          </div>
        </header>

        <main className="px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-12 max-w-[1280px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Нижняя навигация (мобильная) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-[#0A0E16]/95 backdrop-blur-md grid grid-cols-5">
        {NAV.filter((n) => n.to !== '/new').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold ${isActive ? 'text-violet-soft' : 'text-dim'}`}>
            <Icon name={n.icon} className="text-[22px]" />
            {n.label.split(' ')[0]}
            {n.to === '/review' && due > 0 && <span className="absolute top-1.5 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-amber" />}
          </NavLink>
        ))}
      </nav>

      {s.toast && (
        <div className="fixed z-50 bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 pop">
          <div className="flex items-center gap-2 rounded-xl border border-teal/40 bg-[rgba(17,24,39,0.92)] backdrop-blur-md px-4 py-3 text-sm shadow-glow-teal">
            <Icon name="check_circle" fill className="text-teal-soft text-[20px]" />{s.toast}
          </div>
        </div>
      )}
    </div>
  )
}
