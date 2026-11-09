import { useMemo } from 'react'
import { formatNumber, frequency, pct, placement, shortName, type ShotRecord } from './data'
import { densityBins, playerMix, sequenceMix } from './metrics'
import type { PlayerPair } from './Court'
import { Empty, SectionHeading } from './ui'

const count = formatNumber

function topGap(shots: ShotRecord[], left: string, right: string) {
  const mix = playerMix(shots, left, right)
  if (!mix.aTotal || !mix.bTotal) return null
  const ranked = mix.rows.map(row => ({ ...row, gap: 100 * (row.a / mix.aTotal - row.b / mix.bTotal) }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.label.localeCompare(b.label))
  return ranked[0] ? { ...ranked[0], aTotal: mix.aTotal, bTotal: mix.bTotal } : null
}

export function Scouting({ shots, comparison, pair, selectedType }: {
  shots: ShotRecord[]; comparison: ShotRecord[]; pair: PlayerPair; selectedType: string
}) {
  const top = useMemo(() => frequency(shots)[0], [shots])
  const sequence = useMemo(() => sequenceMix(shots), [shots])
  const { inCourt, peak } = useMemo(() => {
    const { inside } = placement(shots)
    const cells = densityBins(inside.map(shot => shot.stroke[2]!))
    const peak = cells.reduce((best, cell) => cell.count > best.count ? cell : best)
    return { inCourt: inside.length, peak }
  }, [shots])
  const gap = useMemo(() => selectedType ? null : topGap(comparison, pair.left, pair.right),
    [comparison, pair.left, pair.right, selectedType])
  const early = sequence[1]
  const later = sequence[4]
  const metres = (n: number) => (n / 100).toFixed(2)

  return <section id="findings" className="section findings">
    <SectionHeading title="Scouting insights" description="Use these observations to choose rallies to review before a match." />
    {!top ? <Empty>No findings for this selection. Try a different combination of filters.</Empty> :
      <div className="findings-list">
        <article><h3>Which shots recur?</h3><div>
          {selectedType ? <p>Choose all shot types to see which shots recur most often.</p> : <>
            <p>{top[0]} was the most frequent shot in the selection. It accounted for <strong>{pct(top[1], shots.length)}</strong> ({count(top[1])} of {count(shots.length)} classified strokes).</p>
            <p className="annotation">Open Shot selection in <a href="#fingerprint">Tactical patterns</a> to check the shot totals before choosing exchanges to replay. Opponents in the sample can affect the mix.</p>
          </>}
        </div></article>
        <article><h3>Where do destinations cluster?</h3><div>
          {inCourt ? <>
            <p>The busiest <a href="#explorer">court cell</a> held <strong>{pct(peak.count, inCourt)}</strong> ({count(peak.count)} of {count(inCourt)} in-court destinations). It spans {metres(peak.x)}–{metres(peak.x + peak.width)} m along the court and {metres(peak.y)}–{metres(peak.y + peak.height)} m across.</p>
            <p className="annotation">Review strokes in that area to see how the shuttle arrived there. The map uses fixed camera ends and can include interceptions.</p>
          </> : <p>No in-court destinations are available in this selection.</p>}
        </div></article>
        <article><h3>Does shot choice change as rallies develop?</h3><div>
          {selectedType ? <p>Choose all shot types to compare the mix across stroke positions.</p> :
            early.total && later.total ? <>
              <p>{top[0]} accounted for <strong>{pct(early.counts.get(top[0]) ?? 0, early.total)}</strong> of second strokes ({count(early.counts.get(top[0]) ?? 0)} of {count(early.total)}) and <strong>{pct(later.counts.get(top[0]) ?? 0, later.total)}</strong> of strokes 8–12 ({count(later.counts.get(top[0]) ?? 0)} of {count(later.total)}).</p>
              <p className="annotation">Open Shot sequence in <a href="#fingerprint">Tactical patterns</a> to compare opening and mid-rally exchanges. Only rallies that reach a later position can contribute there.</p>
            </> : <p>This comparison needs classified strokes at position 2 and positions 8–12.</p>}
        </div></article>
        <article><h3>How do two players differ?</h3><div>
          {selectedType ? <p>Choose all shot types to compare the two players’ shot shares.</p> :
            gap ? <>
              <p>{gap.label} had the largest difference in shot share for the <a href="#fingerprint">comparison pair</a>. {shortName(pair.left)} played it on <strong>{pct(gap.a, gap.aTotal)}</strong> of selected strokes ({count(gap.a)} of {count(gap.aTotal)}), compared with <strong>{pct(gap.b, gap.bTotal)}</strong> for {shortName(pair.right)} ({count(gap.b)} of {count(gap.bTotal)}).</p>
              <p className="annotation">Compare examples of this shot before scouting either player. {Math.min(gap.aTotal, gap.bTotal) < 20 ? 'One player has fewer than 20 strokes in this selection. ' : ''}The match and opponent coverage can differ between players.</p>
            </> : <p>Both comparison players need classified strokes under the selected match and set filters.</p>}
        </div></article>
      </div>}
  </section>
}
