import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as Tooltip from '@radix-ui/react-tooltip'
import '@fontsource-variable/newsreader/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import { Fingerprint } from './Analysis'
import { Scouting } from './Scouting'
import { PlacementCourt } from './Court'
import { Replay } from './Replay'
import { catalog, defaultFilters, formatNumber, matchName, selectShots, type Dataset, type Filters } from './data'
import { SectionHeading, Select, Shuttle } from './ui'
import './style.css'

const datasetURL = `${import.meta.env.BASE_URL}data/shuttleset.json`
const upstream = 'https://github.com/wywyWang/CoachAI-Projects/tree/45517f7d4cb936b03f3eabf939cc7959d39226fe/ShuttleSet'

function Masthead() {
  return <header className="masthead" id="top">
    <div className="container masthead-inner">
      <a className="wordmark" href="#top" aria-label="Rally Atlas home"><Shuttle /><span>Rally Atlas</span></a>
      <nav aria-label="Sections">
        <a href="#explorer">Placement</a><a href="#microscope">Replay</a><a href="#fingerprint">Tactics</a><a href="#findings">Scouting</a><a href="#method">Methods</a>
      </nav>
      <a className="edition" href="#method">ShuttleSet study</a>
    </div>
  </header>
}

function Methodology({ data, rallies, shots }: { data: Dataset; rallies: number; shots: number }) {
  const dates = data.matches.map(match => match.date).sort()
  return <section id="method" className="section">
    <SectionHeading title="Data and methodology" description="Eight men’s singles matches featuring Anthony Sinisuka Ginting or Jonatan Christie." />
    <div className="methods-grid">
      <div>
        <h3>Match coverage</h3>
        <p className="annotation">{dates[0]} to {dates.at(-1)} · {formatNumber(rallies)} rallies · {formatNumber(shots)} classified strokes</p>
        <ol className="match-list">
          {data.matches.map(match => <li key={match.id}>
            <span className="mono">#{match.id}</span>
            <div><b>{match.players.join(' vs ')}</b><span>{match.event} · {match.round} · {match.date}</span></div>
          </li>)}
        </ol>
      </div>
      <div className="method-notes">
        <h3>Coordinates and density</h3>
        <p>Camera coordinates were projected onto a 13.40 × 6.10 m court using ShuttleSet’s match calibrations. The singles boundary is 5.18 m wide. The same camera ends stay fixed across rallies, including when players switch sides. Equal-area density cells show shares of in-court destinations. A destination may be an interception, net contact or a terminal landing.</p>
        <h3>Strokes and outcomes</h3>
        <p>Rallies are identified by match, set and rally number. Rally winners come from ShuttleSet’s rally outcome label. We excluded {data.quality.all_flagged_rallies} fully flagged rallies and left {data.quality.unknown_winner_rallies} outcomes unknown. Replay preserves {data.quality.flagged_or_unclassified_slots} uncertain stroke slots. Shot analyses use classified strokes.</p>
        <h3>Scope and source</h3>
        <p>These results describe a selected sample. Player comparisons may reflect different opponents and match conditions. Data from Wang, Huang, Ik and Peng, ShuttleSet (KDD 2023).</p>
        <div className="source-links"><a href={upstream}>Dataset</a><a href="https://arxiv.org/abs/2306.04948">Research paper</a><a href={`${import.meta.env.BASE_URL}data/SHUTTLESET-LICENSE.txt`}>Data license</a></div>
      </div>
    </div>
  </section>
}

function App({ data }: { data: Dataset }) {
  const [filters, setFilters] = useState(defaultFilters)
  const [leftChoice, setLeft] = useState('Anthony Sinisuka Ginting')
  const [rightChoice, setRight] = useState('Jonatan Christie')
  const { rallies, shots } = useMemo(() => catalog(data), [data])
  const selected = useMemo(() => selectShots(shots, filters), [shots, filters])
  const { match: matchFilter, set: setFilterValue, type: typeFilter } = filters
  const comparison = useMemo(() => selectShots(shots, {
    match: matchFilter, set: setFilterValue, type: typeFilter, player: '',
  }), [shots, matchFilter, setFilterValue, typeFilter])
  const match = data.matches.find(m => String(m.id) === filters.match)
  const players = [...new Set((match ? [match] : data.matches).flatMap(m => m.players))].sort()
  const sets = [...new Set((match ? [match] : data.matches).flatMap(m => m.sets.map(s => s.n)))].sort()
  const left = players.includes(leftChoice) ? leftChoice : players.find(player => player !== rightChoice) ?? players[0]
  const right = players.includes(rightChoice) && rightChoice !== left ? rightChoice : players.find(player => player !== left) ?? ''
  const pair = { players, left, right, onLeft: setLeft, onRight: setRight }
  const represented = new Set(selected.map(shot => shot.origin.match.id)).size
  const coverage = represented === 1 ? '1 match' : `${represented} matches`
  const setFilter = (key: keyof Filters, value: string) => setFilters(previous => {
    const next = { ...previous, [key]: value }
    if (key === 'match') {
      const nextMatch = data.matches.find(m => String(m.id) === value)
      if (nextMatch && !nextMatch.players.includes(next.player)) next.player = ''
      if (nextMatch && !nextMatch.sets.some(set => String(set.n) === next.set)) next.set = ''
    }
    return next
  })

  return <Tooltip.Provider delayDuration={160}>
    <a className="skip-link" href="#main">Skip to content</a>
    <Masthead />
    <main className="container" id="main">
      <section className="intro" aria-labelledby="site-title">
        <div><h1 id="site-title">Rally Atlas</h1><p>Shot placement and rally patterns in professional badminton singles.</p></div>
        <div className="intro-meta">
          <a href="#method">ShuttleSet match sample</a>
          <span>{data.matches.length} matches · {formatNumber(rallies.length)} rallies · {formatNumber(shots.length)} classified strokes</span>
        </div>
      </section>
      <section id="explorer" className="section explorer">
        <SectionHeading title="Shot placement" description="Where do recorded shuttle destinations cluster? Filter the sample or compare two players." />
        <div className="filter-bar" role="group" aria-label="Match filters">
          <Select label="Match" value={filters.match} onChange={value => setFilter('match', value)}>
            <option value="">All matches</option>
            {data.matches.map(m => <option value={m.id} key={m.id}>{matchName(m)} · {m.event} · {m.round}</option>)}
          </Select>
          <Select label="Player" value={filters.player} onChange={value => setFilter('player', value)}>
            <option value="">All players</option>
            {players.map(player => <option key={player}>{player}</option>)}
          </Select>
          <Select label="Shot type" value={filters.type} onChange={value => setFilter('type', value)}>
            <option value="">All shot types</option>
            {data.types.map(type => <option key={type}>{type}</option>)}
          </Select>
          <Select label="Set" value={filters.set} onChange={value => setFilter('set', value)}>
            <option value="">All sets</option>
            {sets.map(set => <option key={set} value={set}>Set {set}</option>)}
          </Select>
          <button className="secondary-button reset" onClick={() => setFilters(defaultFilters)}>Reset filters</button>
        </div>
        <PlacementCourt shots={selected} coverage={coverage} comparison={comparison} pair={pair} scopeKey={JSON.stringify(filters)} />
        <p className="annotation figure-note">Camera ends stay fixed when players switch sides. Destinations include interceptions and terminal contacts.</p>
      </section>
      <Replay data={data} />
      <Fingerprint shots={selected} comparison={comparison} pair={pair} types={data.types} />
      <Scouting shots={selected} comparison={comparison} pair={pair} selectedType={filters.type} />
      <Methodology data={data} rallies={rallies.length} shots={shots.length} />
    </main>
    <footer className="site-footer">
      <div className="container footer-inner">
        <a className="wordmark" href="#top"><Shuttle /> Rally Atlas</a>
        <p>Rally Atlas Team · Telkom University, Indonesia</p>
        <span>AQX Sports Analytics Data Bowl 4.0</span>
      </div>
    </footer>
  </Tooltip.Provider>
}

const root = createRoot(document.getElementById('root')!)
root.render(<main className="container status"><h1>Rally Atlas</h1><p role="status">Loading match data…</p></main>)
fetch(datasetURL)
  .then(response => {
    if (!response.ok) throw new Error(`Dataset returned HTTP ${response.status}`)
    return response.json() as Promise<Dataset>
  })
  .then(data => root.render(<StrictMode><App data={data} /></StrictMode>))
  .catch(() => root.render(<main className="container status">
    <h1>Rally Atlas</h1><p role="alert">The match data could not be loaded.</p>
    <button className="primary-button" onClick={() => window.location.reload()}>Reload page</button>
  </main>))

