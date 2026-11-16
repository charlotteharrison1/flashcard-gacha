import { useEffect, useRef, useState } from 'react'
import SlotsGame from './SlotsGame'
import ScratchGame from './games/ScratchGame'
import RouletteGame from './games/RouletteGame'
import DiceGame from './games/DiceGame'
import MinesGame from './games/MinesGame'
import BlackjackGame from './games/BlackjackGame'
import { SlotSymbol } from './SlotSymbol'

// More games go here as they're built. Each takes the coin balance and a way to update it.
const GAMES = [
  { id: 'slots', label: 'Slots', Game: SlotsGame },
  { id: 'scratch', label: 'Scratch cards', Game: ScratchGame },
  { id: 'roulette', label: 'Roulette', Game: RouletteGame },
  { id: 'dice', label: 'Dice', Game: DiceGame },
  { id: 'mines', label: 'Mines', Game: MinesGame },
  { id: 'blackjack', label: 'Blackjack', Game: BlackjackGame },
] as const

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
        </div>
        <div className="poison-body pull-main">{GAMES.map(({ id, Game }) => game === id && <Game key={id} balance={balance} setBalance={setBalance} />)}</div>
      </div>
    </div>
  )
}
