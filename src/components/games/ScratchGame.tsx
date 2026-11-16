import { useState } from 'react'
import { casino, type GameProps } from '../../lib/casino'
import { errorMessage } from '../../lib/errors'
import type { SymbolId } from '../../lib/slots'
import { SlotSymbol } from '../SlotSymbol'

const COST = 5 // display copy of cost in scratch_buy (0033_casino.sql)
type Card = { balance: number; cells: SymbolId[]; prize: number }

/** Scratch cards: pay 5 coins, scratch nine tiles, three of a kind wins. The card is rolled in the database; scratching only reveals it. */
export default function ScratchGame({ balance, setBalance }: GameProps) {
  const [card, setCard] = useState<Card | null>(null)
  const [open, setOpen] = useState<boolean[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finished = !!card && open.every(Boolean)
  const win = card && card.prize > 0 ? card.cells.find((c) => card.cells.filter((x) => x === c).length === 3) : undefined

  async function buy() {
    setBusy(true)
    setError(null)
    try {
      const c = await casino<Card>('scratch_buy')
      setCard(c)
      setOpen(Array(9).fill(false))
      setBalance(c.balance - c.prize) // the cost is gone now; the prize shows up once it's scratched
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function reveal(i: number) {
    if (!card || open[i]) return
    const next = open.map((o, j) => o || j === i)
    setOpen(next)
    if (next.every(Boolean)) setBalance(card.balance)
  }

  function revealAll() {
    if (!card) return
    setOpen(Array(9).fill(true))
    setBalance(card.balance)
  }

  return (
    <div className="cg">
      <p className="cg-rules">
        {COST} coins a card. Match <b>three</b> of the same to win: cherry 10, bell 15, BAR 25, diamond 50, seven 100, star 250.
      </p>
      <div className={`cg-scratch${finished && card!.prize > 0 ? ' won' : ''}`} role="group" aria-label="Scratch card">
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`cg-tile${open[i] ? ' open' : ''}${open[i] && win && card?.cells[i] === win ? ' hit' : ''}`}
            onClick={() => reveal(i)}
            disabled={!card || open[i]}
            aria-label={open[i] && card ? card.cells[i] : 'Scratch tile'}
          >
            {open[i] && card ? <SlotSymbol id={card.cells[i]} /> : <span className="cg-foil">{card ? '?' : ''}</span>}
          </button>
        ))}
      </div>
      <div className="cg-result" aria-live="polite">
        {finished && card && (card.prize > 0 ? <b className="gold-text">Three {win}s! +{card.prize} coins</b> : <span className="muted">No match. Better luck next card.</span>)}
        {card && !finished && <span className="muted">Click the tiles to scratch them.</span>}
      </div>
      <div className="cg-actions">
        {card && !finished && (
          <button className="secondary" onClick={revealAll}>
            Scratch all
          </button>
        )}
        {(!card || finished) && (
          <button className="spend sm" onClick={buy} disabled={busy || (balance ?? 0) < COST}>
            {card ? 'Another card' : 'Buy a card'} · {COST} coins
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
