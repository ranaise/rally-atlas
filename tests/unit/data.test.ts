import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { byPhase, catalog, courtZone, defaultFilters, frequency, pct, placement, rallyCohort, rallyLengths, selectShots, terminalOutcomes, winnerOf, type Dataset } from '../../src/data'

const data = JSON.parse(readFileSync(new URL('../../public/data/shuttleset.json', import.meta.url), 'utf8')) as Dataset
const { rallies, shots } = catalog(data)

describe('ShuttleSet sample', () => {
  it('uses composite rally keys and preserves source stroke order', () => {
    expect(data.matches.map(match => match.id)).toEqual([11, 14, 15, 16, 24, 26, 27, 39])
    expect(data.matches.flatMap(match => match.sets)).toHaveLength(22)
    expect(rallies).toHaveLength(713)
    expect(new Set(rallies.map(rally => rally.id)).size).toBe(713)
    const fixed = rallies.find(rally => rally.id === '24-3-25')!
    expect(fixed.rally.s).toHaveLength(14)
    expect(fixed.rally.s[0][1]).toBeNull()
    expect(data.types[fixed.rally.s[13][1]!]).toBe('Smash')
  })

  it('keeps unresolved slots separate from classified stroke totals', () => {
    expect(shots).toHaveLength(6961)
    expect(rallies.reduce((sum, row) => sum + row.rally.s.length, 0)).toBe(7247)
    expect(data.quality.source_rows).toBe(7277)
    expect(data.quality.flagged_or_unclassified_slots).toBe(286)
    expect(rallyCohort(shots)).toHaveLength(712)
    expect(rallies.find(row => row.id === '39-2-27')?.rally.s[0][1]).toBeNull()
  })

  it('maps A/B using each match and uses the rally outcome instead of the match outcome', () => {
    const opener = rallies.find(row => row.id === '15-1-1')!
    const reverse = rallies.find(row => row.id === '27-1-1')!
    expect(opener.match.players).toEqual(['Anthony Sinisuka Ginting', 'Anders Antonsen'])
    expect(reverse.match.players).toEqual(['Viktor Axelsen', 'Anthony Sinisuka Ginting'])
    expect(shots.find(shot => shot.origin === opener)?.player).toBe('Anthony Sinisuka Ginting')
    expect(winnerOf(opener)).toBe('Anthony Sinisuka Ginting')
    const aRallyWonByB = rallies.find(row => row.match.id === 15 && row.rally.w === 1)!
    expect(winnerOf(aRallyWonByB)).toBe('Anders Antonsen')
    expect(rallies.filter(row => winnerOf(row) === null)).toHaveLength(3)
  })
})

describe('analytical denominators and filters', () => {
  it('intersects all filters and counts each matching rally once', () => {
    const selected = selectShots(shots, { match: '15', set: '1', type: 'Smash', player: 'Anthony Sinisuka Ginting' })
    expect(selected.length).toBeGreaterThan(0)
    expect(selected.every(s => s.origin.match.id === 15 && s.origin.set === 1 && s.type === 'Smash' && s.player === 'Anthony Sinisuka Ginting')).toBe(true)
    expect(rallyLengths(rallyCohort(selected)).reduce((a, b) => a + b, 0)).toBe(new Set(selected.map(s => s.origin.id)).size)
    expect(selectShots(shots, defaultFilters)).toHaveLength(6961)
  })

  it('reconciles shot frequencies and sequence totals', () => {
    expect(frequency(shots).slice(0, 3)).toEqual([['Net shot', 1342], ['Lob', 1043], ['Return net', 732]])
    expect(frequency(shots).reduce((sum, [, count]) => sum + count, 0)).toBe(6961)
    expect(byPhase(shots).reduce((sum, phase) => sum + phase.total, 0)).toBe(6961)
    expect(rallyLengths(rallies)).toEqual([240, 213, 124, 69, 67])
    expect(pct(1342, shots.length)).toBe('19.3%')
  })

  it('uses only the actual final slot and known winner for terminal comparisons', () => {
    const { types, zones } = terminalOutcomes(shots)
    expect(types[0]).toEqual({ label: 'Smash', total: 118, won: 75 })
    expect(types.reduce((sum, row) => sum + row.total, 0)).toBe(709)
    expect(zones.at(-1)).toEqual({ label: 'Outside singles lines', total: 231, won: 1 })
    const smashes = selectShots(shots, { ...defaultFilters, type: 'Smash' })
    expect(terminalOutcomes(smashes).types).toEqual([types[0]])
  })

  it('keeps missing and outside coordinates out of zone shares', () => {
    expect(courtZone([0, 46])).toEqual({ depth: 2, end: 0 })
    expect(courtZone([1340, 564])).toEqual({ depth: 2, end: 1 })
    expect(courtZone([670, 305])).toEqual({ depth: 0, end: 1 })
    expect(courtZone([472, 305])).toEqual({ depth: 1, end: 0 })
    expect(courtZone([670, 45])).toBeNull()
    expect(courtZone(null)).toBeNull()
    const spatial = placement(shots)
    expect(spatial.inside).toHaveLength(6726)
    expect(spatial.outside).toBe(234)
    expect(spatial.missing).toBe(1)
    expect(spatial.zones.flat().reduce((sum, n) => sum + n, 0)).toBe(6726)
  })

  it('handles empty selections without phantom percentages or rallies', () => {
    const none = selectShots(shots, { ...defaultFilters, match: '16', set: '3' })
    expect(none).toEqual([])
    expect(pct(0, 0)).toBe('N/A')
    expect(rallyCohort(none)).toEqual([])
    expect(placement(none).inside).toEqual([])
    expect(terminalOutcomes(none)).toEqual({ types: [], zones: [] })
  })
})
