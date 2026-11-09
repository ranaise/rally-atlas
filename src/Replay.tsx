import { useEffect, useRef, useState } from 'react'
import { Court, ReplayMarks, withinFrame } from './Court'
import { matchName, shortName, type Dataset, type Match, type Rally } from './data'
import { SectionHeading, Select, Tip } from './ui'

function RallyPlayback({ match, setNumber, rally, types }: { match: Match; setNumber: number; rally: Rally; types: string[] }) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('1')
  const timeline = useRef<HTMLOListElement>(null)
  const last = rally.s.length - 1
  const [side, type, destination, hitter, receiver] = rally.s[step]
  const following = rally.s[step + 1]
  useEffect(() => {
    if (!playing || step === last) return
    const timer = window.setTimeout(() => {
      setStep(step + 1)
      if (step + 1 === last) setPlaying(false)
    }, 900 / Number(speed))
    return () => window.clearTimeout(timer)
  }, [playing, step, last, speed])
  useEffect(() => {
    const strip = timeline.current
    const active = strip?.children[step]
    if (!strip || !active) return
    const bounds = strip.getBoundingClientRect()
    const current = active.getBoundingClientRect()
    if (current.right > bounds.right) strip.scrollLeft += current.right - bounds.right
    if (current.left < bounds.left) strip.scrollLeft -= bounds.left - current.left
  }, [step])

  function move(next: number) {
    setPlaying(false)
    setStep(next)
  }

  function togglePlay() {
    if (playing) setPlaying(false)
    else if (last > 0) {
      if (step === last) setStep(0)
      setPlaying(true)
    }
  }

  const winner = rally.w === null ? 'Unrecorded' : match.players[rally.w]
  const missingPositions = [
    (!hitter || !withinFrame(hitter)) && 'hitter',
    (!receiver || !withinFrame(receiver)) && 'receiver',
  ].filter(Boolean)
  return <>
    <div className="replay-layout">
      <div className="replay-court">
        <div className="figure-kicker"><strong>Set {setNumber}, rally {rally.n}</strong>
          <span className="mono frame-count">Stroke {step + 1} of {last + 1}</span></div>
        <div className="court-stage">
          <Court label="Current stroke positions" replay overlay={<ReplayMarks destination={destination} hitter={hitter} receiver={receiver}
            history={rally.s.slice(Math.max(0, step - 3), step).map(stroke => stroke[2])} />} />
          {type === null && <div className="court-empty">The current stroke has no reliable position marks.</div>}
        </div>
        <div className="chart-legend replay-legend">
          <span><i className="legend-hitter" />Hitter</span><span><i className="legend-receiver" />Receiver</span>
          <span><i className="legend-destination" />Destination</span><span><i className="legend-history" />Previous destinations</span>
        </div>
      </div>
      <aside className="replay-aside">
        <p className="section-label">Current stroke</p>
        <h3>{type === null ? 'Unresolved stroke' : types[type]}</h3>
        <p><strong>{match.players[side]}</strong> <span className="annotation">hitting</span></p>
        {(!destination || !withinFrame(destination)) && <p className="annotation">
          {destination ? 'The destination is outside the diagram.' : 'No reliable destination is available.'}
        </p>}
        {missingPositions.length > 0 && <p className="annotation">Position markers unavailable in this frame: {missingPositions.join(' and ')}.</p>}
        <dl className="outcome">
          <div><dt>Receiver</dt><dd>{match.players[side === 0 ? 1 : 0]}</dd></div>
          <div><dt>Next stroke</dt><dd>{following ? `${shortName(match.players[following[0]])}: ${following[1] === null ? 'Unresolved stroke' : types[following[1]]}` : 'End of rally'}</dd></div>
          <div><dt>Rally winner</dt><dd>{winner}</dd></div>
          <div><dt>Score in source annotation</dt><dd>{shortName(match.players[0])} {rally.score[0]}–{rally.score[1]} {shortName(match.players[1])}</dd></div>
        </dl>
      </aside>
    </div>
    <div className="playback">
      <div className="playback-buttons">
        <button className="secondary-button" onClick={() => move(step - 1)} disabled={step === 0}>Previous</button>
        <button className="primary-button" onClick={togglePlay} disabled={last === 0}>{playing ? 'Pause' : 'Play'}</button>
        <button className="secondary-button" onClick={() => move(step + 1)} disabled={step === last}>Next</button>
      </div>
      <label className="scrubber"><span>Stroke {step + 1} of {last + 1}</span>
        <input aria-label="Stroke position" type="range" min="1" max={last + 1} value={step + 1} disabled={last === 0}
          onChange={event => move(Number(event.target.value) - 1)} />
      </label>
      <Select label="Speed" value={speed} onChange={setSpeed}>
        <option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
      </Select>
    </div>
    <ol className="stroke-strip" aria-label="Shot timeline" ref={timeline}>
      {rally.s.map(([player, strokeType], i) => {
        const name = strokeType === null ? 'Unresolved' : types[strokeType]
        const label = `Stroke ${i + 1}: ${shortName(match.players[player])}, ${name}`
        return <li key={i}><Tip label={label}><button className={player === 0 ? 'first-stroke' : 'second-stroke'}
          onClick={() => move(i)} aria-current={i === step ? 'step' : undefined} aria-label={label}>
          <span className="mono">{i + 1} · {shortName(match.players[player])}</span><b>{name}</b>
        </button></Tip></li>
      })}
    </ol>
  </>
}

export function Replay({ data }: { data: Dataset }) {
  const [matchId, setMatch] = useState(15)
  const [setNumber, setSetNumber] = useState(1)
  const [rallyNumber, setRally] = useState(1)
  const match = data.matches.find(m => m.id === matchId) ?? data.matches[0]
  const set = match.sets.find(s => s.n === setNumber) ?? match.sets[0]
  const rally = set.rallies.find(r => r.n === rallyNumber) ?? set.rallies[0]
  return <section id="microscope" className="section">
    <SectionHeading title="Rally replay" description="Follow the recorded strokes and see who hits next." />
    <div className="filter-bar replay-filters" role="group" aria-label="Replay filters">
      <Select label="Replay match" value={String(match.id)} onChange={value => {
        setMatch(Number(value)); setSetNumber(1); setRally(1)
      }}>
        {data.matches.map(m => <option key={m.id} value={m.id}>{matchName(m)} · {m.event} · {m.round}</option>)}
      </Select>
      <Select label="Replay set" value={String(set.n)} onChange={value => { setSetNumber(Number(value)); setRally(1) }}>
        {match.sets.map(s => <option key={s.n} value={s.n}>Set {s.n}</option>)}
      </Select>
      <Select label="Rally" value={String(rally.n)} onChange={value => setRally(Number(value))}>
        {set.rallies.map(r => <option key={r.n} value={r.n}>Rally {r.n} · {r.s.length} strokes</option>)}
      </Select>
    </div>
    <RallyPlayback key={`${match.id}-${set.n}-${rally.n}`} match={match} setNumber={set.n} rally={rally} types={data.types} />
    <p className="annotation figure-note">Player positions are recorded at contact. The faint marks show up to three previous destinations. Playback advances at a fixed pace.</p>
  </section>
}

