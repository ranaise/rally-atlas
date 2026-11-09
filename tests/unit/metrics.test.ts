import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalog, courtZone, pct, placement, rallyCohort, type Dataset } from '../../src/data'
import { densityBins, densityDomain, grid, playerMix, rallyHistogram, sequenceMix, shotTransitions } from '../../src/metrics'

const data = JSON.parse(readFileSync(new URL('../../public/data/shuttleset.json', import.meta.url), 'utf8')) as Dataset
const { shots } = catalog(data)

describe('shot placement', () => {
  it('bins the whole singles area once, including end lines and the net split', () => {
    const cells = densityBins([[0, 46], [1340, 564], [670, 305], [-1, 305], [400, 565], [NaN, 305]])
    expect(cells).toHaveLength(96)
    expect(cells.reduce((n, cell) => n + cell.count, 0)).toBe(3)
    expect(cells[0].count).toBe(1)
    expect(cells.at(-1)?.count).toBe(1)
    expect(cells[8 * grid.rows + 3].count).toBe(1)
    expect(cells.reduce((area, cell) => area + cell.width * cell.height, 0)).toBeCloseTo(1340 * 518)
    expect(courtZone([305, Infinity])).toBeNull()
  })

  it('reconciles all destinations and normalizes comparison players independently on one domain', () => {
    const inCourt = placement(shots).inside
    const groups = [
      inCourt,
      inCourt.filter(shot => shot.player === 'Anthony Sinisuka Ginting'),
      inCourt.filter(shot => shot.player === 'Jonatan Christie'),
    ]
    expect(groups.map(group => group.length)).toEqual([6726, 2016, 1365])
    const [all, left, right] = groups.map(group => densityBins(group.map(shot => shot.stroke[2]!)))
    for (const [i, cells] of [all, left, right].entries()) {
      expect(cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(groups[i].length)
      expect(cells.reduce((sum, cell) => sum + cell.share, 0)).toBeCloseTo(1)
    }
    expect(densityDomain([left, right])).toBe(.05)
    expect(densityDomain([densityBins([])])).toBe(.01)
  })
})

describe('tactical views', () => {
  it('uses each player’s classified total as their own percentage denominator', () => {
    const { aTotal, bTotal, rows } = playerMix(shots, 'Anthony Sinisuka Ginting', 'Jonatan Christie')
    expect([aTotal, bTotal]).toEqual([2077, 1405])
    expect(rows.reduce((sum, row) => sum + row.a, 0)).toBe(aTotal)
    expect(rows.reduce((sum, row) => sum + row.b, 0)).toBe(bTotal)
    const nets = rows.find(row => row.label === 'Net shot')!
    expect(pct(nets.a, aTotal)).toBe(pct(shots.filter(shot => shot.type === 'Net shot' && shot.player === 'Anthony Sinisuka Ginting').length, 2077))
    expect(playerMix(shots, 'Missing player', 'Jonatan Christie').aTotal).toBe(0)
  })

  it('uses equal five-stroke bins and includes recorded but unclassified slots in lengths', () => {
    const histogram = rallyHistogram(rallyCohort(shots))
    expect(histogram.total).toBe(712)
    expect(histogram.bins.map(bin => bin.count)).toEqual([239, 213, 124, 69, 27, 22, 7, 3, 3, 4, 1])
    expect(histogram.mean).toBeCloseTo(10.176966)
    expect(histogram.median).toBe(8)
    expect(histogram.bins.every(bin => bin.end - bin.start === 4)).toBe(true)
    expect(rallyHistogram([]).median).toBeUndefined()
  })

  it('counts positions by recorded slot and transitions only across adjacent classified slots', () => {
    const columns = sequenceMix(shots)
    expect(columns.reduce((sum, column) => sum + column.total, 0)).toBe(6961)
    for (const column of columns) expect([...column.counts.values()].reduce((sum, n) => sum + n, 0)).toBe(column.total)
    const transitions = shotTransitions(shots, data.types)
    expect(transitions.reduce((sum, group) => sum + group.total, 0)).toBe(6249)
    expect(transitions[0]).toMatchObject({ label: 'Net shot', total: 1245 })
    const opener = shots.filter(shot => shot.origin.id === '15-1-1')
    expect(shotTransitions(opener.filter(shot => shot.number === 2), data.types)[0]?.label).toBe('Short service')
    expect(shotTransitions([opener[0]], data.types)).toEqual([])
    expect(shotTransitions(shots.filter(shot => shot.origin.id === '24-3-25' && shot.number === 2), data.types)).toEqual([])
  })
})
