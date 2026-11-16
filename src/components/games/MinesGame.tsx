import { useEffect, useState } from 'react'
import { casino, minesMult, type GameProps, type MinesView } from '../../lib/casino'
import { errorMessage } from '../../lib/errors'
import { SlotSymbol } from '../SlotSymbol'
import BetBox from './BetBox'

const MINE_OPTIONS = [1, 3, 5, 10, 15, 24]

/** Mines: a 5x5 board hides some mines. Every safe tile you open raises your multiplier; cash out whenever you like, or hit a mine and lose the bet. */
export default function MinesGame({ balance, setBalance }: GameProps) {
  const [bet, setBet] = useState(10)
  const [mines, setMines] = useState(3)
  const [game, setGame] = useState<MinesView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // pick up a game left open (the window was closed mid-round)
  useEffect(() => {
    casino<MinesView | null>('mines_state')
      .then((g) => {
        if (g) setGame(g)
      })
      .catch(() => {}) // the games not being installed shows up when you try to play
  }, [])

  async function run(fn: string, args?: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const g = await casino<MinesView>(fn, args)
      setGame(g)
      setBalance(g.balance)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const live = game?.status === 'active'
  const over = !!game && !live
  const k = game?.revealed.length ?? 0
  const next = game ? minesMult(game.mines_count, k + 1) : 0

  return (
    <div className="cg">
      {!live && (
        <>
          <p className="cg-rules">Pick how many mines hide on the board. More mines, bigger multipliers, and a quicker end.</p>
          <div className="cg-choices" role="radiogroup" aria-label="Number of mines">
            {MINE_OPTIONS.map((m) => (
              <button key={m} role="radio" aria-checked={mines === m} className={`cg-choice${mines === m ? ' on' : ''}`} onClick={() => setMines(m)} disabled={busy}>
                {m} {m === 1 ? 'mine' : 'mines'}
              </button>
            ))}
          </div>
          <BetBox balance={balance} bet={bet} setBet={setBet} disabled={busy} />
        </>
      )}

      <div className="cg-mines" role="group" aria-label="Mine board">
        {Array.from({ length: 25 }, (_, i) => {
          const open = game?.revealed.includes(i)
          const isMine = over && game?.mines?.includes(i)
          return (
            <button
              key={i}
              type="button"
              className={`cg-mine${open ? ' safe' : ''}${isMine ? ' bomb' : ''}${over && game?.hit === i ? ' boom' : ''}`}
              disabled={!live || busy || open}
              onClick={() => run('mines_reveal', { p_cell: i })}
              aria-label={open ? 'Safe tile' : isMine ? 'Mine' : 'Hidden tile'}
            >
              {open ? <SlotSymbol id="diamond" /> : isMine ? <SlotSymbol id="ball" /> : null}
            </button>
          )
        })}
      </div>

      <div className="cg-result" aria-live="polite">
        {live && (
          <span>
            {k === 0 ? 'Open a tile' : <b className="gold-text">×{game!.multiplier.toFixed(2)} · {game!.payout} coins</b>} · Next tile ×{next.toFixed(2)}
          </span>
        )}
        {game?.status === 'lost' && <span className="muted">Boom. You lose {game.bet}.</span>}
        {(game?.status === 'cashed' || game?.status === 'cleared') && <b className="gold-text">{game.status === 'cleared' ? 'Board cleared! ' : ''}Cashed out {game.payout} coins (×{game.multiplier.toFixed(2)})</b>}
      </div>

      <div className="cg-actions">
        {live ? (
          <button className="spend sm" onClick={() => run('mines_cashout')} disabled={busy || k === 0}>
            Cash out · {game!.payout}
          </button>
        ) : (
          <button className="spend sm" onClick={() => run('mines_start', { p_bet: bet, p_mines: mines })} disabled={busy || bet < 1 || (balance ?? 0) < bet}>
            {over ? 'Play again' : 'Start'} · {bet} coins
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
