import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { interpolateYlGnBu } from 'd3-scale-chromatic'
import { bands, court, courtZone, formatNumber, matchName, pct, placement, playerCoverage, type Point, type ShotRecord } from './data'
import { densityBins, densityDomain, grid } from './metrics'
import { Empty, PlayerFields, Select } from './ui'

const { length, width, alley, service, longService } = court
const net = length / 2
const pointPageSize = 350
const colorSteps = 6

function cellColor(share: number, maximum: number) {
  if (!share) return '#eef1e7'
  const step = Math.min(colorSteps, Math.ceil(share / maximum * colorSteps))
  return interpolateYlGnBu(.15 + .78 * step / colorSteps)
}

export function Court({ label, children, overlay, replay = false }: {
  label: string; children?: ReactNode; overlay?: ReactNode; replay?: boolean
}) {
  return <div className={replay ? 'court-frame replay-frame' : 'court-frame'}>
    <div className="court-ends" aria-hidden="true"><span>Camera near end</span><span>Net</span><span>Camera far end</span></div>
    <svg className="court-svg" viewBox="-20 -22 1380 654" role="group" aria-label={label}>
      <rect className="court-surface" width={length} height={width} />
      {children}
      <g className="court-lines" aria-hidden="true" pointerEvents="none">
        <rect width={length} height={width} className="court-faint" />
        {!replay && <rect y={alley} width={length} height={width - alley * 2} className="singles-halo" />}
        <rect y={alley} width={length} height={width - alley * 2} />
        <path d={`M${net - service} 0V${width} M${net + service} 0V${width} M0 ${width / 2}H${net - service} M${net + service} ${width / 2}H${length}`} />
        <path className="court-faint" d={`M${longService} 0V${width} M${length - longService} 0V${width}`} />
        <path className="court-net" d={`M${net} -12V${width + 12}`} />
        <circle className="net-post" cx={net} cy="-12" r="5" />
        <circle className="net-post" cx={net} cy={width + 12} r="5" />
      </g>
      {overlay}
    </svg>
    {!replay && <div className="court-ends court-distance" aria-hidden="true"><span>0 m</span><span>6.7 m</span><span>13.4 m</span></div>}
  </div>
}

function DensityLegend({ maximum }: { maximum: number }) {
  const value = (n: number) => `${Number((n * 100).toFixed(2))}%`
  return <div className="density-legend" aria-label={`Density scale from 0 to ${value(maximum)} of in-court destinations per cell`}>
    <div><strong className="legend-title">Share of in-court destinations</strong>
      <span className="legend-area">Equal-area cells · about 0.72 m² each</span></div>
    <div>
      <div className="legend-swatches">
        {Array.from({ length: colorSteps }, (_, i) =>
          <i key={i} style={{ background: cellColor(maximum * (i + .5) / colorSteps, maximum) }} />)}
      </div>
      <div className="legend-values mono"><span>0%</span><span>{value(maximum / 2)}</span><span>{value(maximum)}</span></div>
    </div>
    <span className="legend-zero"><i />No destinations</span>
  </div>
}

function DensityCourt({ label, cells, maximum, total, onInspect }: {
  label: string; cells: ReturnType<typeof densityBins>; maximum: number; total: number; onInspect: (label: string) => void
}) {
  const [active, setActive] = useState(0)
  function navigate(event: KeyboardEvent<SVGRectElement>, column: number, row: number) {
    const change = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!change) return
    event.preventDefault()
    const x = Math.max(0, Math.min(grid.columns - 1, column + change[0]))
    const y = Math.max(0, Math.min(grid.rows - 1, row + change[1]))
    event.currentTarget.ownerSVGElement?.querySelector<SVGRectElement>(`[data-cell="${x * grid.rows + y}"]`)?.focus()
  }
  return <div className="court-stage">
    <Court label={label}>
      {total > 0 && cells.map((cell, i) => {
        const detail = `${label}: ${cell.count} of ${formatNumber(total)} (${pct(cell.count, total)}). ${(cell.x / 100).toFixed(2)}–${((cell.x + cell.width) / 100).toFixed(2)} m along the court, ${(cell.y / 100).toFixed(2)}–${((cell.y + cell.height) / 100).toFixed(2)} m across.`
        return <rect className="density-cell" key={i} data-cell={i} x={cell.x} y={cell.y} width={cell.width} height={cell.height}
          fill={cellColor(cell.share, maximum)} role="img" aria-label={detail} tabIndex={i === active ? 0 : -1}
          onPointerEnter={() => onInspect(detail)} onClick={() => onInspect(detail)}
          onFocus={() => { setActive(i); onInspect(detail) }} onKeyDown={event => navigate(event, cell.column, cell.row)} />
      })}
    </Court>
    {!total && <div className="court-empty">No in-court destinations</div>}
  </div>
}

function ZoneLayer({ zones, total, onInspect }: { zones: number[][]; total: number; onInspect: (label: string) => void }) {
  const maximum = Math.max(1, ...zones.flat())
  return zones.flatMap((counts, end) => counts.map((count, index) => {
    const band = bands[index]
    const x = end ? net + band.start : net - band.end
    const w = band.end - band.start
    const label = `${end ? 'Far' : 'Near'} ${band.label.toLowerCase()}: ${formatNumber(count)} of ${formatNumber(total)} (${pct(count, total)})`
    return <g key={`${end}-${index}`} className="zone-mark" tabIndex={0} role="img" aria-label={label}
      onPointerEnter={() => onInspect(label)} onFocus={() => onInspect(label)} onClick={() => onInspect(label)}>
      <rect x={x} y={alley} width={w} height={width - alley * 2} fill={interpolateYlGnBu(.13 + .42 * count / maximum)} />
      <text x={x + w / 2} y={width / 2} className="zone-value">{pct(count, total)}</text>
      <text x={x + w / 2} y={width / 2 + 36} className="zone-name">{band.label}</text>
    </g>
  }))
}

function shotLabel(shot: ShotRecord) {
  const [x, y] = shot.stroke[2]!
  return `${shot.player} · ${shot.type} · ${matchName(shot.origin.match)} · Set ${shot.origin.set}, rally ${shot.origin.rally.n}, stroke ${shot.number} · (${(x / 100).toFixed(2)}, ${(y / 100).toFixed(2)}) m`
}

function PointCourt({ inside, onInspect }: { inside: ShotRecord[]; onInspect: (label: string) => void }) {
  const [requestedPage, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(inside.length / pointPageSize))
  const page = Math.min(requestedPage, pageCount - 1)
  const start = page * pointPageSize
  const records = inside.slice(start, start + pointPageSize)
  return <>
    <div className="court-stage">
      <Court label="Individual shot destinations" overlay={<g className="point-layer">
        {records.map(shot => {
          const [cx, cy] = shot.stroke[2]!
          const inspect = () => onInspect(shotLabel(shot))
          return <circle key={`${shot.origin.id}-${shot.number}`} cx={cx} cy={cy} r={records.length > 120 ? 8 : 12}
            onPointerEnter={inspect} onClick={inspect} />
        })}
      </g>} />
      {!records.length && <div className="court-empty">No in-court destinations</div>}
    </div>
    {inside.length > 0 && <div className="point-controls">
      <div className="point-paging">
        <button className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous points</button>
        <span className="mono">{formatNumber(start + 1)}–{formatNumber(start + records.length)} of {formatNumber(inside.length)}</span>
        <button className="secondary-button" disabled={page + 1 === pageCount} onClick={() => setPage(page + 1)}>Next points</button>
      </div>
      <details><summary>Inspect a stroke record</summary>
        <Select label="In-court stroke record" value="" onChange={value => onInspect(shotLabel(records[Number(value)]))}>
          <option value="" disabled>Choose a stroke</option>
          {records.map((shot, i) => <option value={i} key={`${shot.origin.id}-${shot.number}`}>{shotLabel(shot)}</option>)}
        </Select>
      </details>
    </div>}
  </>
}

export type PlayerPair = {
  players: string[]; left: string; right: string; onLeft: (name: string) => void; onRight: (name: string) => void
}

function PlacementSummary({ spatial, shots, coverage, peak }: {
  spatial: ReturnType<typeof placement>; shots: ShotRecord[]; coverage: string; peak: number | null
}) {
  return <aside className="court-aside">
    <h3>Placement by depth</h3>
    <p className="sample-count"><strong className="placement-total">{formatNumber(spatial.inside.length)}</strong> in court</p>
    <p className="annotation">{formatNumber(shots.length)} selected strokes · {coverage}</p>
    <dl className="depth-list">
      {bands.map((band, i) => {
        const count = spatial.zones[0][i] + spatial.zones[1][i]
        return <div key={band.label} className="depth-row">
          <dt>{band.label}</dt><dd><span className="mono">{formatNumber(count)}</span><b className="mono">{pct(count, spatial.inside.length)}</b></dd>
        </div>
      })}
    </dl>
    <p className="annotation">{formatNumber(spatial.outside)} outside singles lines · {formatNumber(spatial.missing)} missing a destination</p>
    {peak !== null && spatial.inside.length > 0 && <div className="peak-cell">
      <strong>Densest cell</strong>
      <p><b>{pct(peak, spatial.inside.length)}</b> of in-court destinations ({formatNumber(peak)} of {formatNumber(spatial.inside.length)}).</p>
    </div>}
  </aside>
}

function ComparisonCourts({ shots, pair }: { shots: ShotRecord[]; pair: PlayerPair }) {
  const [detail, setDetail] = useState<{ shots: ShotRecord[]; pair: string; text: string } | null>(null)
  const { left, right } = pair
  const panels = useMemo(() => [left, right].map(name => {
    const selected = shots.filter(shot => shot.player === name)
    const spatial = placement(selected)
    return { name, selected, spatial, cells: densityBins(spatial.inside.map(shot => shot.stroke[2]!)) }
  }), [shots, left, right])
  if (pair.players.length < 2) return <Empty>This selection has fewer than two eligible players.</Empty>
  const maximum = densityDomain(panels.map(panel => panel.cells))
  const key = `${left}/${right}`
  return <>
    <PlayerFields {...pair} context="Placement comparison players" />
    <p className="annotation">Both courts use the same color scale. Each cell is a share of that player’s in-court destinations. The players below are compared under the same match, set and shot filters.</p>
    <div className="court-comparison">
      {panels.map(({ name, selected, spatial, cells }) => {
        const { matches, opponents } = playerCoverage(selected, name)
        return <figure key={name} className="comparison-court">
          <figcaption><strong>{name}</strong><span>{formatNumber(spatial.inside.length)} in court of {formatNumber(selected.length)} strokes · {matches} {matches === 1 ? 'match' : 'matches'}</span></figcaption>
          {opponents.length > 0 && <p className="annotation comparison-opponents">Opponents in these records: {opponents.join(', ')}</p>}
          <DensityCourt label={name} cells={cells} maximum={maximum} total={spatial.inside.length}
            onInspect={text => setDetail({ shots, pair: key, text })} />
        </figure>
      })}
    </div>
    <DensityLegend maximum={maximum} />
    <p className="annotation">Opponent coverage can differ. A placement difference may reflect match context as well as player preference.</p>
    <p className="inspection" aria-live="polite">{detail?.shots === shots && detail.pair === key ? detail.text : 'Point to a cell, or focus the court and use the arrow keys.'}</p>
  </>
}

export function PlacementCourt({ shots, coverage, comparison, pair, scopeKey }: {
  shots: ShotRecord[]; coverage: string; comparison: ShotRecord[]; pair: PlayerPair; scopeKey: string
}) {
  const [view, setView] = useState('density')
  const [inspected, setInspected] = useState<{ scope: ShotRecord[]; text: string } | null>(null)
  const spatial = useMemo(() => placement(shots), [shots])
  const cells = useMemo(() => densityBins(spatial.inside.map(shot => shot.stroke[2]!)), [spatial])
  const maximum = densityDomain([cells])
  const inspect = (text: string) => setInspected({ scope: shots, text })
  const hint = view === 'density' ? 'Point to a cell, or focus the court and use the arrow keys.'
    : view === 'zones' ? 'Point to a zone or focus it to read its count and share.'
      : 'Point to a destination or choose a stroke record.'
  return <Tabs.Root className="placement-viz" value={view} onValueChange={value => { setView(value); setInspected(null) }}>
    <Tabs.List className="view-tabs" aria-label="Shot placement views">
      <Tabs.Trigger value="density">Density</Tabs.Trigger><Tabs.Trigger value="zones">Court zones</Tabs.Trigger>
      <Tabs.Trigger value="points">Points</Tabs.Trigger><Tabs.Trigger value="compare">Compare players</Tabs.Trigger>
    </Tabs.List>
    {['density', 'zones', 'points'].map(mode => <Tabs.Content value={mode} key={mode}>
      <div className="placement-layout">
        <div className="placement-main">
          <div className="figure-kicker"><strong>Singles court</strong><span className="mono">13.40 × 5.18 m</span></div>
          {mode === 'density' && <><DensityCourt label="Shot destination density" cells={cells} maximum={maximum} total={spatial.inside.length} onInspect={inspect} /><DensityLegend maximum={maximum} /></>}
          {mode === 'zones' && <div className="court-stage"><Court label="Shot destination zones">
            {spatial.inside.length > 0 && <ZoneLayer zones={spatial.zones} total={spatial.inside.length} onInspect={inspect} />}
          </Court>{!spatial.inside.length && <div className="court-empty">No in-court destinations</div>}</div>}
          {mode === 'points' && <PointCourt key={scopeKey} inside={spatial.inside} onInspect={inspect} />}
          <p className="inspection" aria-live="polite">{inspected?.scope === shots ? inspected.text : hint}</p>
        </div>
        <PlacementSummary spatial={spatial} shots={shots} coverage={coverage} peak={mode === 'density' ? Math.max(...cells.map(cell => cell.count)) : null} />
      </div>
    </Tabs.Content>)}
    <Tabs.Content value="compare"><div className="comparison-body"><ComparisonCourts shots={comparison} pair={pair} /></div></Tabs.Content>
  </Tabs.Root>
}

export function withinFrame([x, y]: Point) {
  return x >= -20 && x <= length + 20 && y >= -22 && y <= width + 22
}

export function ReplayMarks({ destination, hitter, receiver, history }: {
  destination: Point | null; hitter: Point | null; receiver: Point | null; history: (Point | null)[]
}) {
  return <>
    {history.map((point, i) => point && withinFrame(point) &&
      <circle key={i} cx={point[0]} cy={point[1]} r="12" className="mark-history"><title>Previous recorded destination</title></circle>)}
    {hitter && withinFrame(hitter) && <circle cx={hitter[0]} cy={hitter[1]} r="16" className="mark-hitter"><title>Hitter position</title></circle>}
    {receiver && withinFrame(receiver) && <rect x={receiver[0] - 13} y={receiver[1] - 13} width="26" height="26" className="mark-receiver"><title>Receiver position</title></rect>}
    {destination && withinFrame(destination) && <g transform={`translate(${destination[0]} ${destination[1]})`}>
      <title>Shuttle destination{courtZone(destination) ? '' : ' outside singles lines'}</title>
      <path d="M0 -20 20 0 0 20 -20 0Z" className="mark-destination" />
    </g>}
  </>
}

