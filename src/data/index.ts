import { NETWORKS } from './networks'
import { NEGOTIATION } from './negotiation'
import { DRAFT_TRACKS } from './catalog'
import { CS0_TRACK } from './cs0'
import type { CardDef, GraphNode, LabDef, Lesson, Track } from './types'

export * from './types'

export const TRACKS: Track[] = [NETWORKS, NEGOTIATION, ...DRAFT_TRACKS, CS0_TRACK]
/** Треки для каталога: курсы программы CS показываются внутри программы */
export const CATALOG_TRACKS = TRACKS.filter((t) => !t.hidden)
export const PLAYABLE = TRACKS.filter((t) => t.playable)

const nodeIndex = new Map<string, { node: GraphNode; track: Track }>()
PLAYABLE.forEach((t) => t.nodes.forEach((n) => nodeIndex.set(n.id, { node: n, track: t })))

export const trackById = (id: string) => TRACKS.find((t) => t.id === id)
export const nodeById = (id: string): GraphNode | undefined => nodeIndex.get(id)?.node
export const trackOfNode = (id: string): Track | undefined => nodeIndex.get(id)?.track
export const lessonById = (nodeId: string): Lesson | undefined => trackOfNode(nodeId)?.lessons[nodeId]
export const ALL_LABS: (LabDef & { trackId: string })[] = PLAYABLE.flatMap((t) => t.labs.map((l) => ({ ...l, trackId: t.id })))
export const labById = (id: string) => ALL_LABS.find((l) => l.id === id)
export const BUILTIN_CARDS: CardDef[] = PLAYABLE.flatMap((t) => t.cards)
