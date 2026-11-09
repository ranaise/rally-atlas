import { bin, max, mean, median, range } from 'd3-array'
import { court, courtZone, frequency, type Point, type RallyRecord, type ShotRecord } from './data'

export const grid = { columns: 16, rows: 6 }
const across = (court.width - 2 * court.alley) / grid.rows
const along = court.length / grid.columns
const xEdges = range(1, grid.columns).map(i => i * along)
const yEdges = range(1, grid.rows).map(i => court.alley + i * across)
const xBins = bin<Point, number>().value(point => point[0]).domain([0, court.length]).thresholds(xEdges)
const yBins = bin<Point, number>().value(point => point[1]).domain([court.alley, court.width - court.alley]).thresholds(yEdges)

export function densityBins(points: Point[]) {
  const valid = points.filter(point => courtZone(point))
  return xBins(valid).flatMap((column, i) => yBins(column).map((cell, j) => ({
    column: i, row: j, x: i * along, y: court.alley + j * across, width: along, height: across,
    count: cell.length, share: valid.length ? cell.length / valid.length : 0,
  })))
}

export function densityDomain(groups: ReturnType<typeof densityBins>[]) {
  const peak = max(groups.flat(), cell => cell.share) ?? 0
  return Math.max(.01, Math.ceil(peak * 100) / 100)
}

export function playerMix(shots: ShotRecord[], left: string, right: string) {
  const leftShots = shots.filter(shot => shot.player === left)
  const rightShots = shots.filter(shot => shot.player === right)
  const a = new Map(frequency(leftShots))
  const b = new Map(frequency(rightShots))
  return {
    aTotal: leftShots.length, bTotal: rightShots.length,
    rows: frequency([...leftShots, ...rightShots]).map(([label]) => ({
      label, a: a.get(label) ?? 0, b: b.get(label) ?? 0,
    })),
  }
}

export function rallyHistogram(rallies: RallyRecord[]) {
  const lengths = rallies.map(({ rally }) => rally.s.length)
  const upper = Math.max(5, Math.ceil((max(lengths) ?? 0) / 5) * 5)
  // Integer observations 1 through 5 belong to [0.5, 5.5), and so on.
  const bins = bin<number, number>().domain([.5, upper + .5]).thresholds(range(5.5, upper + .5, 5))(lengths)
    .map(group => ({ start: group.x0! + .5, end: group.x1! - .5, count: group.length }))
  return { bins, total: lengths.length, upper, mean: mean(lengths), median: median(lengths) }
}

export const strokeRanges = [
  { end: 1, label: '1' }, { end: 2, label: '2' }, { end: 4, label: '3–4' },
  { end: 7, label: '5–7' }, { end: 12, label: '8–12' }, { end: 20, label: '13–20' },
  { end: Infinity, label: '21+' },
]

export function sequenceMix(shots: ShotRecord[]) {
  const groups = strokeRanges.map(() => [] as ShotRecord[])
  for (const shot of shots) groups[strokeRanges.findIndex(group => shot.number <= group.end)].push(shot)
  return groups.map((group, index) => ({
    label: strokeRanges[index].label, total: group.length, counts: new Map(frequency(group)),
  }))
}

export function shotTransitions(shots: ShotRecord[], types: string[]) {
  const groups = new Map<string, ShotRecord[]>()
  for (const shot of shots) {
    const previous = shot.origin.rally.s[shot.number - 2]?.[1]
    if (previous === null || previous === undefined) continue
    const label = types[previous]
    const group = groups.get(label)
    if (group) group.push(shot)
    else groups.set(label, [shot])
  }
  return [...groups].map(([label, group]) => ({ label, total: group.length, counts: new Map(frequency(group)) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}
