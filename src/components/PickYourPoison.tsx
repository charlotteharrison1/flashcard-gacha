import { useEffect, useRef, useState } from 'react'
import SlotsGame from './SlotsGame'
import { SlotSymbol } from './SlotSymbol'

// More games go here as they're built.
const GAMES = [{ id: 'slots', label: 'Slots' }] as const

type Props = { balance: number | null; setBalance: (balance: number) => void; onClose: () => void }

/** A window over the study screen where earned coins can be spent on gambling games. Today: just the slots. */
export default function PickYourPoison({ balance, setBalance, onClose }: Props) {
  const [game, setGame] = useState<(typeof GAMES)[number]['id']>('slots')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="poison-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="poison" role="dialog" aria-modal="true" aria-labelledby="poison-title">
        <div className="poison-head">
          <h2 id="poison-title">Pick your poison</h2>
          <span className="poison-coins" aria-label={`${balance ?? 0} coins`}>
            <SlotSymbol id="coin" />
            {balance ?? '–'}
          </span>
          <button ref={closeRef} className="secondary poison-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="poison-games" role="tablist" aria-label="Games">
          {GAMES.map((g) => (
            <button key={g.id} role="tab" aria-selected={game === g.id} className={`poison-tab${game === g.id ? ' active' : ''}`} onClick={() => setGame(g.id)}>
              {g.label}
            </button>
          ))}
          <span className="poison-soon">More games soon</span>
        </div>
        <div className="poison-body pull-main">{game === 'slots' && <SlotsGame balance={balance} setBalance={setBalance} />}</div>
      </div>
    </div>
  )
}
