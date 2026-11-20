import { useState } from 'react'
import type { CardDraft } from '../../shared/tutor'
import { aiErrorText, useAi } from '../ai/AiContext'
import { trackOfNode } from '../data'
import { useStore } from '../store'
import { Icon } from './ui'

/** «Карточки из конспекта»: наставник предлагает карточки, ученик выбирает, какие взять. */
export default function AiCardsButton({ nodeId, topic, text }: { nodeId: string; topic: string; text: string }) {
  const ai = useAi()
  const s = useStore()
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<CardDraft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const make = async () => {
    setBusy(true); setError(null); setDrafts(null)
    try {
      const cards = await ai.channel.cards(ai.learner(), { topic, text })
      setDrafts(cards)
      if (!cards.length) setError('Из этого конспекта не получилось карточек — допиши пару мыслей.')
    } catch (e) { setError(aiErrorText(e)) } finally { setBusy(false) }
  }
  const add = (c: CardDraft) => {
    s.addUserCard({ front: c.front, back: c.back, trackId: trackOfNode(nodeId)?.id ?? s.activeTrack, nodeId })
    setDrafts((d) => d?.filter((x) => x !== c) ?? null)
  }
  return (
    <div className="mt-2">
      <button onClick={make} disabled={busy || text.trim().length < 20} className="btn-ghost w-full !py-2 text-violet-soft">
        <Icon name="auto_awesome" className="text-[18px]" />{busy ? 'Наставник составляет карточки…' : 'Карточки из конспекта (ИИ)'}
      </button>
      {error && <div className="text-xs text-amber-soft mt-1">{error}</div>}
      {drafts && drafts.length > 0 && (
        <ul className="mt-2 space-y-2 pop">
          {drafts.map((c, i) => (
            <li key={i} className="rounded-lg border border-line p-2.5 text-sm">
              <div className="font-medium">{c.front}</div>
              <div className="text-mute text-xs mt-0.5">{c.back}</div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => add(c)} className="btn-secondary !py-1 !px-2 text-xs"><Icon name="add" className="text-[16px]" />В колоду</button>
                <button onClick={() => setDrafts((d) => d?.filter((x) => x !== c) ?? null)} className="btn-ghost !py-1 !px-2 text-xs">Пропустить</button>
              </div>
            </li>
          ))}
          <li className="text-[11px] text-dim">Источник: {ai.channel.label}</li>
        </ul>
      )}
    </div>
  )
}
