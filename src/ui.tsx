import { useId, type ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

export function Shuttle({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="m4 4 20 6-10 10L4 4Zm5 2 8 11m-1-9 4 6m-6 6 4 4c5 5 12-2 7-7l-4-4" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
  </svg>
}

export function Select({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode
}) {
  const id = useId()
  return <div className="field">
    <label className="mono" htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>{children}</select>
  </div>
}

export function SectionHeading({ title, description }: {
  title: string; description: string
}) {
  return <header className="section-heading">
    <h2>{title}</h2>
    <p>{description}</p>
  </header>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

export function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return <Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={6} collisionPadding={8}>
      {label}<Tooltip.Arrow className="tooltip-arrow" />
    </Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root>
}

export function PlayerFields({ players, left, right, onLeft, onRight, context }: {
  players: string[]; left: string; right: string; onLeft: (name: string) => void;
  onRight: (name: string) => void; context: string
}) {
  return <div className="comparison-fields" role="group" aria-label={context}>
    <Select label="First player" value={left} onChange={onLeft}>
      {players.filter(name => name !== right).map(name => <option key={name}>{name}</option>)}
    </Select>
    <Select label="Second player" value={right} onChange={onRight}>
      {players.filter(name => name !== left).map(name => <option key={name}>{name}</option>)}
    </Select>
  </div>
}
