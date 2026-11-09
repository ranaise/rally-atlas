import { useEffect, useMemo, useRef, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { scaleLinear } from '@visx/scale'
import { interpolateBlues } from 'd3-scale-chromatic'
import { formatNumber, frequency, pct, rallyCohort, shortName, terminalOutcomes, type ShotRecord } from './data'
import { playerMix, rallyHistogram, sequenceMix, shotTransitions } from './metrics'
import { type PlayerPair } from './Court'
import { Empty, PlayerFields, Select, Tip } from './ui'

const count = formatNumber
const maxRows = 8
const axisStyle = { fill: '#525b56', fontSize: 11, fontFamily: 'inherit' }

function readableInk(background: string) {
  const channels = background.match(/\d+/g)?.map(value => {
    const channel = Number(value) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  if (!channels) return '#111'
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
  return luminance > .179 ? '#000' : '#fff'
}

function ChartTitle({ title, description }: { title: string; description: string }) {
  return <header className="chart-title"><h3>{title}</h3><p>{description}</p></header>
}

function MoreRows({ expanded, setExpanded, total }: {
  expanded: boolean; setExpanded: (value: boolean) => void; total: number
}) {
  if (total <= maxRows) return null
  return <button type="button" className="text-button" aria-expanded={expanded}
    onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer shot types' : `Show all ${total} shot types`}</button>
}

function PlayerChart({ shots, selected, pair }: { shots: ShotRecord[]; selected: ShotRecord[]; pair: PlayerPair }) {
  const [expanded, setExpanded] = useState(false)
  const { aTotal, bTotal, rows } = useMemo(() => playerMix(shots, pair.left, pair.right), [shots, pair.left, pair.right])
  const combined = frequency(selected)
  const maximum = Math.max(10, ...rows.flatMap(row => [aTotal ? 100 * row.a / aTotal : 0, bTotal ? 100 * row.b / bTotal : 0]))
  const end = Math.min(100, Math.ceil(maximum / (maximum <= 30 ? 5 : 10)) * (maximum <= 30 ? 5 : 10))
  const scale = scaleLinear({ domain: [0, end], range: [0, 100] })
  const ticks = [0, end / 4, end / 2, end * 3 / 4, end]
  return <>
    <ChartTitle title="Shot selection by player" description="Compare shot shares for the two players below under the same match, set and shot filters." />
    {pair.players.length < 2 ? <Empty>This selection has fewer than two eligible players.</Empty> :
      <>
        <PlayerFields {...pair} context="Shot selection comparison players" />
        {!rows.length ? <Empty>No classified strokes for these players and filters.</Empty> :
          <>
            <div className="chart-legend">
              <span><i className="series-dot first" />{shortName(pair.left)} · {count(aTotal)} strokes</span>
              <span><i className="series-dot second" />{shortName(pair.right)} · {count(bTotal)} strokes</span>
            </div>
            {(!aTotal || !bTotal) && <p className="annotation">One player has no matching strokes. Only the available series is plotted.</p>}
            <div className="dot-chart" role="group" aria-label="Shot shares by player">
              <div className="dot-axis">
                <span>Shot type</span><div className="tick-row">{ticks.map(tick => <span key={tick}>{tick}%</span>)}</div>
                <span>Shares</span>
              </div>
              {rows.slice(0, expanded ? undefined : maxRows).map(row => {
                const ax = aTotal ? scale(100 * row.a / aTotal) : 0
                const bx = bTotal ? scale(100 * row.b / bTotal) : 0
                const description = `${row.label}: ${shortName(pair.left)} ${row.a} of ${aTotal} (${pct(row.a, aTotal)}), ${shortName(pair.right)} ${row.b} of ${bTotal} (${pct(row.b, bTotal)})`
                return <div className="dot-row" key={row.label}>
                  <strong>{row.label}</strong>
                  <Tip label={description}><button className="dot-track" aria-label={description}>
                    <span className="plot-grid">{ticks.map(tick => <i key={tick} />)}</span>
                    {!!aTotal && !!bTotal && <i className="dumbbell-line" style={{ left: `${Math.min(ax, bx)}%`, width: `${Math.abs(ax - bx)}%` }} />}
                    {!!aTotal && <i className="plot-dot first" style={{ left: `${ax}%` }} />}
                    {!!bTotal && <i className="plot-dot second" style={{ left: `${bx}%` }} />}
                  </button></Tip>
                  <span className="dot-values mono"><b>{pct(row.a, aTotal)}</b><b>{pct(row.b, bTotal)}</b></span>
                </div>
              })}
            </div>
            <MoreRows expanded={expanded} setExpanded={setExpanded} total={rows.length} />
          </>}
      </>}
    {combined.length > 0 && <details className="totals-disclosure"><summary>Shot totals for the main selection</summary>
      <table className="totals-table"><thead><tr><th>Shot type</th><th>Strokes</th><th>Share</th></tr></thead>
        <tbody>{combined.map(([label, n]) => <tr key={label}><th scope="row">{label}</th><td>{count(n)}</td><td>{pct(n, selected.length)}</td></tr>)}</tbody>
      </table>
    </details>}
  </>
}

function Histogram({ shots }: { shots: ShotRecord[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const histogram = useMemo(() => rallyHistogram(rallyCohort(shots)), [shots])
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const { bins, mean, median, total, upper } = histogram
  const plotLeft = 38
  const plotRight = width - 14
  const plotTop = 30
  const plotBottom = 193
  const x = scaleLinear({ domain: [.5, upper + .5], range: [plotLeft, plotRight] })
  const y = scaleLinear({ domain: [0, Math.max(1, ...bins.map(item => item.count))], range: [plotBottom, plotTop], nice: true })
  const labels = bins.filter((_, i) => width > 560 || i % 2 === 0)
  return <>
    <ChartTitle title="Rally length distribution" description="Includes rallies with at least one classified stroke that matches the filters. The study’s rally total also includes replayable rallies without a classified stroke." />
    <div className="histogram" ref={ref}>
      {!total || mean === undefined || median === undefined ? <Empty>No rallies match these filters.</Empty> : <>
        <div className="histogram-meta chart-legend">
          <span><b>{count(total)}</b> rallies</span>
          <span><i className="mean-key" />Mean {mean.toFixed(1)} strokes</span>
          <span><i className="median-key" />Median {Number(median.toFixed(1))} strokes</span>
        </div>
        <svg width={width} height="243" role="group" aria-label="Histogram of recorded rally lengths">
          <text x={plotLeft} y="16" className="svg-axis-label">Rallies</text>
          {y.ticks(4).filter(Number.isInteger).map(tick => <line key={tick} x1={plotLeft} x2={plotRight} y1={y(tick)} y2={y(tick)} className="chart-grid-line" />)}
          <AxisLeft left={plotLeft} scale={y} tickValues={y.ticks(4).filter(Number.isInteger)} tickLabelProps={axisStyle} hideAxisLine hideTicks tickFormat={value => String(value)} />
          <AxisBottom top={plotBottom} scale={x} tickValues={[1, ...labels.map(item => item.end)]} tickFormat={value => String(value)}
            tickLabelProps={axisStyle} stroke="#8c968c" tickStroke="#8c968c" />
          {bins.map(({ start, end, count: n }) => {
            const label = `${start}–${end} strokes: ${count(n)} rallies (${pct(n, total)})`
            return <Tip key={start} label={label}><rect tabIndex={0} role="img" aria-label={label} className={n ? 'hist-bin' : 'hist-bin hist-zero'}
              x={x(start - .5) + 1} y={n ? y(n) : plotBottom - 5} width={Math.max(1, x(end + .5) - x(start - .5) - 2)} height={n ? plotBottom - y(n) : 5} /></Tip>
          })}
          <line x1={x(mean)} x2={x(mean)} y1={plotTop} y2={plotBottom} className="mean-line" />
          <line x1={x(median)} x2={x(median)} y1={plotTop} y2={plotBottom} className="median-line" />
          <text x={(plotLeft + plotRight) / 2} y="234" textAnchor="middle" className="svg-axis-label">Recorded strokes per rally</text>
        </svg>
        <p className="annotation">Each bar covers five consecutive lengths. Unclassified slots still count toward rally length.</p>
        <details className="totals-disclosure"><summary>Rally counts by length</summary>
          <table className="totals-table"><thead><tr><th scope="col">Recorded strokes</th><th scope="col">Rallies</th><th scope="col">Share</th></tr></thead>
            <tbody>{bins.map(({ start, end, count: n }) => <tr key={start}>
              <th scope="row">{start}–{end}</th><td>{count(n)}</td><td>{pct(n, total)}</td>
            </tr>)}</tbody>
          </table>
        </details>
      </>}
    </div>
  </>
}

function SequenceChart({ shots, types }: { shots: ShotRecord[]; types: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState('position')
  const [previous, setPrevious] = useState('')
  const positions = useMemo(() => sequenceMix(shots), [shots])
  const transitions = useMemo(() => shotTransitions(shots, types), [shots, types])
  const group = transitions.find(item => item.label === previous) ?? transitions[0]
  const columns = mode === 'position' ? positions : group ? [group] : []
  const rows = mode === 'position' ? frequency(shots).map(([label]) => label) : [...(group?.counts.keys() ?? [])]
  return <>
    <ChartTitle title="Shot sequence" description="See how the shot mix changes by stroke number, or inspect which shots follow a selected type." />
    <div className="sequence-options">
      <Select label="Sequence view" value={mode} onChange={setMode}><option value="position">Stroke position</option><option value="next">Next shot</option></Select>
      {mode === 'next' && group && <Select label="Previous shot" value={group.label} onChange={setPrevious}>
        {transitions.map(item => <option key={item.label}>{item.label}</option>)}
      </Select>}
    </div>
    {!rows.length ? <Empty>{mode === 'next' ? 'No consecutive classified pairs match the filters.' : 'No classified strokes match the filters.'}</Empty> : <>
      <p className="annotation matrix-note">{mode === 'position'
        ? 'Percentages are calculated within each stroke-position column. The count below each heading is its denominator.'
        : 'Each pair comes from consecutive slots in the same rally. Both shots must be classified. The filters apply to the next shot.'}</p>
      <table className="matrix" aria-label={mode === 'position' ? 'Shot mix by stroke position' : 'Next shot frequencies'}>
        <thead><tr><th scope="col">{mode === 'position' ? 'Shot type' : 'Next shot'}</th>{columns.map(column =>
          <th scope="col" key={column.label}>{column.label}<small>n={count(column.total)}</small></th>)}</tr></thead>
        <tbody>{rows.slice(0, expanded ? undefined : maxRows).map(label => <tr key={label}>
          <th scope="row">{label}</th>
          {columns.map(column => {
            const n = column.counts.get(label) ?? 0
            const share = column.total ? n / column.total : 0
            const background = interpolateBlues(share * .9)
            const detail = `${label} · ${column.label}: ${count(n)} of ${count(column.total)} (${pct(n, column.total)})`
            return <td key={column.label}><Tip label={detail}><button className="matrix-cell" aria-label={detail}
              style={{ background: column.total ? background : 'transparent', color: readableInk(background) }}>
              {column.total ? pct(n, column.total) : '·'}
            </button></Tip></td>
          })}
        </tr>)}</tbody>
      </table>
      <div className="matrix-legend chart-legend"><span>Share within column</span>{[0, .25, .5, .75, 1].map(n =>
        <span key={n}><i style={{ background: interpolateBlues(n * .9) }} />{n * 100}%</span>)}</div>
      <MoreRows expanded={expanded} setExpanded={setExpanded} total={rows.length} />
    </>}
  </>
}

function OutcomesChart({ shots }: { shots: ShotRecord[] }) {
  const [group, setGroup] = useState('type')
  const [expanded, setExpanded] = useState(false)
  const outcomes = useMemo(() => terminalOutcomes(shots), [shots])
  const rows = group === 'type' ? outcomes.types : outcomes.zones
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const ticks = [0, 25, 50, 75, 100]
  return <>
    <ChartTitle title="Who won after the final stroke?" description="Share of rallies won by the last hitter, grouped by final shot type or destination depth." />
    <div className="sequence-options"><Select label="Group final strokes by" value={group} onChange={setGroup}>
      <option value="type">Shot type</option><option value="zone">Court zone</option>
    </Select></div>
    {!total ? <Empty>No matching final strokes have the required outcome data.</Empty> : <>
      <div className="chart-legend"><span><b>{count(total)}</b> eligible rallies</span><span><i className="outcome-key" />20 or more rallies</span><span><i className="outcome-key small" />Fewer than 20 rallies</span></div>
      <div className="dot-chart outcome-chart" role="group" aria-label="Last hitter win share">
        <div className="dot-axis"><span>{group === 'type' ? 'Final shot' : 'Destination'}</span>
          <div className="tick-row">{ticks.map(tick => <span key={tick}>{tick}%</span>)}</div><span>Wins / total</span>
        </div>
        {rows.slice(0, expanded ? undefined : maxRows).map(({ label, won, total }) => {
          const share = pct(won, total)
          const detail = `${label}: last hitter won ${won} of ${total} rallies (${share})${total < 20 ? '. Small sample.' : ''}`
          return <div className="dot-row" key={label}>
            <strong>{label}</strong>
            <Tip label={detail}><button className="dot-track" aria-label={detail}>
              <span className="plot-grid">{ticks.map(tick => <i key={tick} />)}</span>
              <i className={`plot-dot outcome-mark${total < 20 ? ' small' : ''}`} style={{ left: `${100 * won / total}%` }} />
            </button></Tip>
            <span className="dot-values mono"><b>{share}</b><span>{won}/{total}</span></span>
          </div>
        })}
      </div>
      <MoreRows expanded={expanded} setExpanded={setExpanded} total={rows.length} />
      <p className="annotation">Includes classified final strokes with a known winner{group === 'zone' ? ' and a recorded destination' : ''}. The last hitter can win or lose through several kinds of endings, including faults. These shares describe the recorded endings. Small groups can change sharply with one rally.</p>
    </>}
  </>
}

export function Fingerprint({ shots, comparison, pair, types }: {
  shots: ShotRecord[]; comparison: ShotRecord[]; pair: PlayerPair; types: string[]
}) {
  return <section id="fingerprint" className="section">
    <header className="section-heading tactics-heading">
      <div><h2>Tactical patterns</h2><p>Compare shot choices, rally lengths, sequences and final strokes.</p></div>
      <a href="#explorer">Change match filters</a>
    </header>
    <Tabs.Root defaultValue="players" className="tactics">
      <Tabs.List className="view-tabs" aria-label="Tactical views">
        <Tabs.Trigger value="players">Shot selection</Tabs.Trigger><Tabs.Trigger value="length">Rally lengths</Tabs.Trigger>
        <Tabs.Trigger value="sequence">Shot sequence</Tabs.Trigger><Tabs.Trigger value="outcomes">Rally outcomes</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content className="chart-body" value="players"><PlayerChart shots={comparison} selected={shots} pair={pair} /></Tabs.Content>
      <Tabs.Content className="chart-body" value="length"><Histogram shots={shots} /></Tabs.Content>
      <Tabs.Content className="chart-body" value="sequence"><SequenceChart shots={shots} types={types} /></Tabs.Content>
      <Tabs.Content className="chart-body" value="outcomes"><OutcomesChart shots={shots} /></Tabs.Content>
    </Tabs.Root>
  </section>
}


