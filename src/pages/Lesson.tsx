import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { lessonById, nodeById, trackOfNode, type LessonBlock } from '../data'
import { useStore } from '../store'
import { Bar, Icon, Md } from '../components/ui'
import { useMentorTopic } from '../ai/AiContext'
import { AnalogyBlock, CodeBlock, FeynmanBlock, LayersBlock, NumericBlock, OrderBlock, QuizBlock, TermsBlock, TruthBlock } from '../components/blocks'
import EvolutionBlock from '../components/EvolutionBlock'

const needsAction = (b: LessonBlock) => b.type === 'quiz' || b.type === 'order' || b.type === 'feynman' || b.type === 'numeric' || b.type === 'truth'
const PASS = 0.7

export default function LessonPage() {
  const { id = '' } = useParams()
  const s = useStore()
  const node = nodeById(id)
  const lesson = lessonById(id)
  const track = trackOfNode(id)
  const [shown, setShown] = useState(1)
  const [solved, setSolved] = useState<Record<number, boolean>>({})
  const [firstTry, setFirstTry] = useState(0)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [note, setNote] = useState(s.notes[id] ?? '')
  const endRef = useRef<HTMLDivElement>(null)
  const material = lesson ? lesson.blocks.map((b) => (b.type === 'text' || b.type === 'analogy' ? b.md : b.type === 'terms' ? b.items.map((t) => `${t.term} — ${t.def}`).join('; ') : '')).filter(Boolean).join('\n') : ''
  useMentorTopic(node ? { title: node.title, summary: node.short, material } : null)

  useEffect(() => { setShown(1); setSolved({}); setFinished(false); setFailed(false); setFirstTry(0); setNote(s.notes[id] ?? '') }, [id, attempt]) // eslint-disable-line
  useEffect(() => { if (shown > 1) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [shown, finished])

  if (!node) return <div className="text-mute">Узел не найден. <Link to="/track" className="text-violet-soft">К древу</Link></div>

  if (!lesson) return <DraftLesson id={id} />

  const blocks = lesson.blocks
  const last = blocks[shown - 1]
  const canNext = !needsAction(last) || solved[shown - 1]
  const progress = Math.round(((finished ? blocks.length : shown - 1) / blocks.length) * 100)
  const actionCount = blocks.filter(needsAction).length

  const finish = () => {
    if (node.exam && firstTry / Math.max(1, actionCount) < PASS) { setFailed(true); return }
    s.completeLesson(id, { firstTry, total: actionCount })
    s.addCards(lesson.cardIds)
    s.saveNote(id, note)
    setFinished(true)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <article className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-dim mb-3">
          <Link to={`/track/${track?.id ?? ''}`} className="hover:text-ink flex items-center gap-1"><Icon name="arrow_back" className="text-[16px]" />{track?.title ?? 'Древо'}</Link>
          <span>/</span><span>{node.title}</span>
        </div>
        <div className="label text-teal-soft">{node.exam ? 'Экзамен модуля' : 'Урок'} · {node.minutes} мин · +{node.xp} XP</div>
        <h1 className="text-2xl md:text-[32px] md:leading-10 font-extrabold tracking-tight mt-2">{lesson.title}</h1>
        {lesson.sources && lesson.sources.length > 0 && <div className="mt-2 text-xs text-dim flex items-start gap-1.5"><Icon name="menu_book" className="text-[15px] shrink-0" /><span>По книгам: {lesson.sources.join('; ')}</span></div>}
        <div className="mt-4 mb-8"><Bar value={progress} /></div>

        <div className="space-y-6">
          {blocks.slice(0, shown).map((b, i) => (
            <div key={`${attempt}-${i}`} className="pop">
              {b.type === 'text' && <p className="text-[16px] leading-[1.75] text-ink/90"><Md text={b.md} /></p>}
              {b.type === 'analogy' && <AnalogyBlock title={b.title} md={b.md} />}
              {b.type === 'widget' && b.widget === 'layers' && <LayersBlock />}
              {b.type === 'quiz' && <QuizBlock {...b} onDone={(ok) => { setSolved((x) => ({ ...x, [i]: true })); if (ok) setFirstTry((n) => n + 1) }} />}
              {b.type === 'order' && <OrderBlock {...b} onDone={() => { setSolved((x) => ({ ...x, [i]: true })); setFirstTry((n) => n + 1) }} />}
              {b.type === 'feynman' && <FeynmanBlock {...b} topic={node.title} onDone={(text) => { setSolved((x) => ({ ...x, [i]: true })); setFirstTry((n) => n + 1); setNote((n) => (n ? n + '\n\n' : '') + `Своими словами: ${text}`) }} />}
              {b.type === 'terms' && <TermsBlock items={b.items} />}
              {b.type === 'evolution' && <EvolutionBlock e={b} />}
              {b.type === 'code' && <CodeBlock title={b.title} code={b.code} />}
              {b.type === 'numeric' && <NumericBlock {...b} onDone={(ok) => { setSolved((x) => ({ ...x, [i]: true })); if (ok) setFirstTry((n) => n + 1) }} />}
              {b.type === 'truth' && <TruthBlock {...b} onDone={(ok) => { setSolved((x) => ({ ...x, [i]: true })); if (ok) setFirstTry((n) => n + 1) }} />}
            </div>
          ))}
        </div>

        <div ref={endRef} className="mt-8">
          {failed && (
            <div className="card p-6 pop text-center border-amber/40">
              <div className="w-14 h-14 rounded-full bg-amber/15 grid place-items-center mx-auto"><Icon name="replay" className="text-amber-soft text-[32px]" /></div>
              <h2 className="text-xl font-bold mt-3">Пока не сдан</h2>
              <p className="text-mute mt-2">С первой попытки верно {firstTry} из {actionCount}. Нужно не меньше {Math.ceil(actionCount * PASS)}. Повтори уроки модуля — особенно темы, где ошибся, — и попробуй снова.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
                <button onClick={() => setAttempt((a) => a + 1)} className="btn-primary"><Icon name="restart_alt" className="text-[18px]" />Сдать заново</button>
                <Link to={`/track/${track?.id ?? ''}`} className="btn-secondary"><Icon name="hub" className="text-[18px]" />К урокам модуля</Link>
              </div>
            </div>
          )}
          {!finished && !failed && (shown < blocks.length ? (
            <button onClick={() => setShown((n) => n + 1)} disabled={!canNext} className="btn-primary !px-6">
              {canNext ? 'Дальше' : 'Выполни задание выше'} <Icon name="arrow_downward" className="text-[18px]" />
            </button>
          ) : (
            <button onClick={finish} disabled={!canNext} className="btn-teal !px-6"><Icon name="task_alt" className="text-[18px]" />{node.exam ? 'Завершить экзамен' : 'Завершить урок'}</button>
          ))}

          {finished && (
            <div className="card p-6 shadow-glow-teal pop text-center">
              <div className="w-14 h-14 rounded-full bg-teal/15 grid place-items-center mx-auto"><Icon name="workspace_premium" fill className="text-teal-soft text-[32px]" /></div>
              <h2 className="text-xl font-bold mt-3">{node.exam ? 'Экзамен сдан!' : 'Урок пройден!'}</h2>
              <div className="grid grid-cols-3 gap-3 mt-5 max-w-md mx-auto">
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-violet-soft">+{node.xp}</div><div className="text-[11px] text-dim">XP</div></div>
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-teal-soft">{firstTry}/{actionCount}</div><div className="text-[11px] text-dim">с первой попытки</div></div>
                <div className="rounded-lg bg-s2/60 p-3"><div className="text-xl font-bold text-amber-soft">+{lesson.cardIds.length}</div><div className="text-[11px] text-dim">карточек в колоду</div></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
                {node.lab && <Link to={`/lab/${node.lab}`} className="btn-primary"><Icon name="science" className="text-[18px]" />Закрепить в лаборатории</Link>}
                <Link to={`/track/${track?.id ?? ''}`} className="btn-secondary"><Icon name="hub" className="text-[18px]" />Что открылось в древе</Link>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Боковая колонка */}
      <aside className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="card p-4">
          <div className="label mb-3">План урока</div>
          <ol className="space-y-2">
            {blocks.map((b, i) => {
              const state = i < shown - 1 || finished ? 'done' : i === shown - 1 ? 'now' : 'next'
              const label = ({ text: 'Объяснение', analogy: 'Аналогия', widget: 'Интерактивная схема', quiz: 'Вопрос', order: 'Упорядочивание', feynman: 'Объясни сам', terms: 'Словарик', evolution: 'Было → стало', numeric: 'Задача', truth: 'Таблица истинности', code: 'Пример' } as const)[b.type]
              return (
                <li key={i} className={`flex items-center gap-2 text-sm ${state === 'next' ? 'text-dim' : state === 'now' ? 'text-ink font-semibold' : 'text-mute'}`}>
                  <Icon name={state === 'done' ? 'check_circle' : state === 'now' ? 'radio_button_checked' : 'radio_button_unchecked'} fill={state === 'done'}
                    className={`text-[18px] ${state === 'done' ? 'text-teal-soft' : state === 'now' ? 'text-violet-soft' : ''}`} />
                  {label}
                </li>
              )
            })}
          </ol>
        </div>
        <div className="card p-4">
          <div className="label mb-2 flex items-center gap-1.5"><Icon name="edit_note" className="text-[16px]" />Мой конспект</div>
          <textarea className="input min-h-[120px] !text-[13px]" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => s.saveNote(id, note)} placeholder="Записывай мысли по ходу урока…" />
        </div>
        <div className="card p-4">
          <div className="label mb-2">Карточки этого урока</div>
          {lesson.cardIds.length === 0 && <p className="text-sm text-dim">В экзамене карточек нет.</p>}
          <ul className="space-y-1.5 text-sm text-mute">
            {lesson.cardIds.map((c) => <li key={c} className="flex gap-2"><Icon name="style" className="text-[16px] text-amber-soft mt-0.5" />{s.cardDef(c)?.front}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  )
}

/** Узлы без нарисованного урока: показываем, что сгенерирует ИИ. */
function DraftLesson({ id }: { id: string }) {
  const s = useStore()
  const node = nodeById(id)!
  const st = s.status(id)
  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/track/${trackOfNode(id)?.id ?? ''}`} className="text-xs text-dim hover:text-ink flex items-center gap-1 mb-3"><Icon name="arrow_back" className="text-[16px]" />{trackOfNode(id)?.title ?? 'Древо'}</Link>
      <div className="label text-amber-soft">Черновик урока</div>
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">{node.title}</h1>
      <p className="text-mute mt-2">{node.short}</p>
      <div className="card p-5 mt-6">
        <div className="flex gap-3">
          <Icon name="auto_awesome" className="text-violet-soft text-[24px]" />
          <div>
            <div className="font-semibold">Этот урок в прототипе ещё не нарисован</div>
            <p className="text-sm text-mute mt-1">В рабочей версии ИИ соберёт его из тех же блоков: объяснение → аналогия → интерактив → проверки → «объясни сам» → карточки. Полностью готовые уроки отмечены в древе знаний без пометки «черновик».</p>
          </div>
        </div>
        {st === 'locked' ? (
          <div className="mt-5 text-sm text-dim flex items-center gap-2"><Icon name="lock" className="text-[18px]" />Узел закрыт — сначала освой предыдущие понятия.</div>
        ) : st === 'done' ? (
          <div className="mt-5 text-sm text-teal-soft flex items-center gap-2"><Icon name="check_circle" fill className="text-[18px]" />Отмечен как пройденный.</div>
        ) : (
          <button onClick={() => { s.completeLesson(id); s.notify(`«${node.title}» отмечен пройденным · +${node.xp} XP`) }} className="btn-secondary mt-5">
            <Icon name="fast_forward" className="text-[18px]" />Отметить пройденным (для демо)
          </button>
        )}
      </div>
    </div>
  )
}
