export type Point = [x: number, y: number]
export type Side = 0 | 1
export type Stroke = [
  player: Side,
  type: number | null,
  destination: Point | null,
  hitter: Point | null,
  receiver: Point | null,
]
export type Rally = { n: number; w: Side | null; score: [number, number]; s: Stroke[] }
export type Match = {
  id: number
  date: string
  event: string
  round: string
  players: [string, string]
  sets: { n: number; rallies: Rally[] }[]
}
export type Dataset = { types: string[]; matches: Match[]; quality: Record<string, number> }
export type RallyRecord = { id: string; match: Match; set: number; rally: Rally }
export type ShotRecord = { origin: RallyRecord; stroke: Stroke; number: number; player: string; type: string }
export type Filters = { match: string; set: string; player: string; type: string }

export const defaultFilters: Filters = { match: '', set: '', player: '', type: '' }
export const court = { length: 1340, width: 610, alley: 46, service: 198, longService: 76 }
export const bands = [
  { label: 'Forecourt', start: 0, end: 198 },
  { label: 'Midcourt', start: 198, end: 434 },
  { label: 'Rear court', start: 434, end: 670 },
] as const
export const phases = ['1–4', '5–10', '11+']
export const shortName = (name: string) => ({
  'Anthony Sinisuka Ginting': 'Ginting',
  'Jonatan Christie': 'Christie',
  'Chou Tien Chen': 'Chou',
  'Anders Antonsen': 'Antonsen',
  'Viktor Axelsen': 'Axelsen',
  'Rasmus Gemke': 'Gemke',
  'Lee Zii Jia': 'Lee',
}[name] ?? name)
export const matchName = (match: Match) => match.players.map(shortName).join(' vs ')
export const pct = (n: number, total: number) => total ? `${(100 * n / total).toFixed(1)}%` : 'N/A'
export const formatNumber = (n: number) => n.toLocaleString('en-US')

export function catalog(data: Dataset) {
  const rallies = data.matches.flatMap(match => match.sets.flatMap(set =>
    set.rallies.map(rally => ({ id: `${match.id}-${set.n}-${rally.n}`, match, set: set.n, rally }))))
  const shots = rallies.flatMap(origin => origin.rally.s.flatMap((stroke, i) =>
    stroke[1] === null ? [] : [{
      origin, stroke, number: i + 1, player: origin.match.players[stroke[0]], type: data.types[stroke[1]],
    }]))
  return { rallies, shots }
}

export function selectShots(shots: ShotRecord[], filters: Filters) {
  return shots.filter(shot =>
    (!filters.match || String(shot.origin.match.id) === filters.match) &&
    (!filters.set || String(shot.origin.set) === filters.set) &&
    (!filters.player || shot.player === filters.player) &&
    (!filters.type || shot.type === filters.type))
}

export function rallyCohort(shots: ShotRecord[]) {
  return [...new Map(shots.map(shot => [shot.origin.id, shot.origin])).values()]
}

export function winnerOf({ match, rally }: RallyRecord) {
  return rally.w === null ? null : match.players[rally.w]
}

export function courtZone(point: Point | null) {
  if (!point) return null
  const [x, y] = point
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > court.length || y < court.alley || y > court.width - court.alley) return null
  const distance = Math.abs(x - court.length / 2)
  const depth = distance < bands[0].end ? 0 : distance < bands[1].end ? 1 : 2
  return { depth, end: x < court.length / 2 ? 0 : 1 }
}

export function placement(shots: ShotRecord[]) {
  const zones = [[0, 0, 0], [0, 0, 0]]
  const inside: ShotRecord[] = []
  let outside = 0
  let missing = 0
  for (const shot of shots) {
    const point = shot.stroke[2]
    const zone = courtZone(point)
    if (zone) {
      zones[zone.end][zone.depth]++
      inside.push(shot)
    } else if (point) outside++
    else missing++
  }
  return { zones, inside, outside, missing }
}

export function frequency(shots: ShotRecord[]) {
  const counts = new Map<string, number>()
  for (const shot of shots) counts.set(shot.type, (counts.get(shot.type) ?? 0) + 1)
  return [...counts].sort(([a, n], [b, m]) => m - n || a.localeCompare(b))
}

export function playerCoverage(shots: ShotRecord[], player: string) {
  const matches = new Map(shots.filter(shot => shot.player === player).map(shot => [shot.origin.match.id, shot.origin.match]))
  const opponents = [...new Set([...matches.values()].flatMap(match => match.players.filter(name => name !== player)))].sort()
  return { matches: matches.size, opponents }
}

export function rallyLengths(rallies: RallyRecord[]) {
  const buckets = [0, 0, 0, 0, 0]
  for (const { rally } of rallies) {
    const length = rally.s.length
    buckets[length <= 5 ? 0 : length <= 10 ? 1 : length <= 15 ? 2 : length <= 20 ? 3 : 4]++
  }
  return buckets
}

export function byPhase(shots: ShotRecord[]) {
  const groups: ShotRecord[][] = [[], [], []]
  for (const shot of shots) groups[shot.number <= 4 ? 0 : shot.number <= 10 ? 1 : 2].push(shot)
  return groups.map(group => ({ total: group.length, counts: new Map(frequency(group)) }))
}

export function terminalOutcomes(shots: ShotRecord[]) {
  const byType = new Map<string, { label: string; total: number; won: number }>()
  const byZone = new Map<string, { label: string; total: number; won: number }>()
  for (const shot of shots) {
    if (shot.number !== shot.origin.rally.s.length) continue
    const winner = winnerOf(shot.origin)
    if (!winner) continue
    const won = Number(shot.player === winner)
    const type = byType.get(shot.type) ?? { label: shot.type, total: 0, won: 0 }
    byType.set(shot.type, { ...type, total: type.total + 1, won: type.won + won })
    if (!shot.stroke[2]) continue
    const zone = courtZone(shot.stroke[2])
    const label = zone ? bands[zone.depth].label : 'Outside singles lines'
    const depth = byZone.get(label) ?? { label, total: 0, won: 0 }
    byZone.set(label, { ...depth, total: depth.total + 1, won: depth.won + won })
  }
  return {
    types: [...byType.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)),
    zones: [...bands.map(band => band.label), 'Outside singles lines'].flatMap(label => byZone.get(label) ?? []),
  }
}
