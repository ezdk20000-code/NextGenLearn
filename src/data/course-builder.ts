import type { CardDef, GraphNode, LabDef, Lesson, Tier, Track } from './types'
import type { CsLabSpec, CsModule } from './cs0/types'

/** Строит трек курса программы CS: карта «змейкой» по модулям, уроки, карточки, лаборатории. */
export function buildCourseTrack(t: Omit<Track, 'nodes' | 'lessons' | 'cards' | 'labs' | 'map' | 'playable' | 'hidden'>, modules: CsModule[], labSpecs: CsLabSpec[]): Track {
  const mods = modules.filter((m) => m.lessons.length)
  const ROW = 108
  const HEIGHT = 70 + ROW * (mods.length - 1) + 90
  const nodes: GraphNode[] = []
  const lessons: Record<string, Lesson> = {}
  const cards: CardDef[] = []
  let prev: string | null = null
  mods.forEach((m, mi) => {
    const y = HEIGHT - 70 - mi * ROW
    m.lessons.forEach((l, li) => {
      const k = mi % 2 === 0 ? li : m.lessons.length - 1 - li
      const x = 190 + (k * 680) / Math.max(1, m.lessons.length - 1)
      const lab = labSpecs.find((b) => b.node === l.id)
      nodes.push({ id: l.id, title: l.node, short: l.short, tier: Math.min(mi, 4) as Tier, x, y, requires: prev ? [prev] : [], minutes: l.minutes, xp: l.xp, lab: lab?.id, group: m.label, exam: l.exam })
      const cardIds = l.cards.map((_, n) => `${l.id}-c${n + 1}`)
      l.cards.forEach(([front, back], n) => cards.push({ id: cardIds[n], nodeId: l.id, trackId: t.id, front, back }))
      lessons[l.id] = { nodeId: l.id, title: l.title, blocks: l.blocks, cardIds, covers: l.covers, sources: l.sources }
      prev = l.id
    })
  })
  const labs: LabDef[] = labSpecs.filter((b) => lessons[b.node]).map((b) => ({ id: b.id, nodeId: b.node, icon: b.icon, title: b.title, desc: b.desc, skills: b.skills, minutes: b.minutes, primitive: b.primitive }))
  return { ...t, playable: true, hidden: true, nodes, lessons, cards, labs, map: { height: HEIGHT, rows: mods.map((m, mi) => ({ label: m.label, y: HEIGHT - 70 - mi * ROW })) } }
}
