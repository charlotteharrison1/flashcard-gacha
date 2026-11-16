import { useRef, useState } from 'react'
import { casino, type GameProps } from '../../lib/casino'
import { errorMessage } from '../../lib/errors'
import { motionReduced } from '../../lib/anim'
import BetBox from './BetBox'

type Spin = { balance: number; number: number; colour: 'red' | 'black' | 'green'; win: boolean; bet: number; payout: number }
type Kind = 'red' | 'black' | 'number'

// The wheel's pockets in real European order, so the picture matches what's on a real table.
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const colourOf = (n: number) => (n === 0 ? '#1f9d55' : REDS.has(n) ? '#d6362b' : '#161b22')
const SLICE = 360 / ORDER.length
const WHEEL = `conic-gradient(from ${-SLICE / 2}deg, ${ORDER.map((n, i) => `${colourOf(n)} ${i * SLICE}deg ${(i + 1) * SLICE}deg`).join(', ')})`
const SPIN_MS = 3600

/** Roulette on a one-zero wheel. Red or black pays 2x; a single number pays 36x. After a red/black win you can ride the winnings: double or nothing, again and again. */
export default function RouletteGame({ balance, setBalance }: GameProps) {
  const [bet, setBet] = useState(10)
  const [kind, setKind] = useState<Kind>('red')
  const [pick, setPick] = useState(17)
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [last, setLast] = useState<Spin | null>(null)
  const [round, setRound] = useState(0) // 1 = first spin; each ride adds one
  const [error, setError] = useState<string | null>(null)
  const angleRef = useRef(0)

  async function spin(stake: number, k: Kind, ride: boolean) {
    setSpinning(true)
    setError(null)
    try {
      const r = await casino<Spin>('roulette_spin', { p_bet: stake, p_kind: k, p_pick: k === 'number' ? pick : null })
      // turn the wheel so the winning pocket ends under the pointer at the top
      const centre = ORDER.indexOf(r.number) * SLICE
      const now = ((angleRef.current % 360) + 360) % 360
      angleRef.current += ((360 - centre - now + 360) % 360) + 360 * 5
      setAngle(angleRef.current)
      setBalance(r.balance - r.payout) // the stake is gone; the payout lands when the wheel stops
      await new Promise((res) => setTimeout(res, motionReduced() ? 0 : SPIN_MS))
      setBalance(r.balance)
      setLast(r)
      setRound(ride ? round + 1 : 1)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSpinning(false)
    }
  }

  const canRide = !!last && last.win && kind !== 'number'
  const potNext = last ? last.payout * 2 : 0

  return (
    <div className="cg">
      <div className="cg-wheel-wrap">
        <span className="cg-pointer" aria-hidden="true" />
        <div className="cg-wheel" style={{ background: WHEEL, transform: `rotate(${angle}deg)`, transition: spinning && !motionReduced() ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : 'none' }} aria-hidden="true" />
        <div className={`cg-hub ${last && !spinning ? last.colour : ''}`}>{last && !spinning ? last.number : '·'}</div>
      </div>

      <div className="cg-result" aria-live="polite">
        {last && !spinning && (last.win ? <b className="gold-text">{last.number} {last.colour}: you win {last.payout}!{round > 1 ? ` (round ${round})` : ''}</b> : <span className="muted">{last.number} {last.colour}. You lose {last.bet}.</span>)}
      </div>

      {canRide && !spinning ? (
        <div className="cg-ride">
          <p>
            Round {round + 1}: let {last!.payout} ride on {kind} to win <b>{potNext}</b> ({2 ** (round + 1)}× your first bet), or lose it all.
          </p>
          <div className="cg-actions">
            <button className="spend sm" onClick={() => spin(last!.payout, kind, true)} disabled={(balance ?? 0) < last!.payout}>
              Double or nothing
            </button>
            <button className="secondary" onClick={() => setLast(null)}>
              Take it
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="cg-choices" role="radiogroup" aria-label="Bet on">
            <button role="radio" aria-checked={kind === 'red'} className={`cg-choice red${kind === 'red' ? ' on' : ''}`} onClick={() => setKind('red')} disabled={spinning}>
              Red · 2×
            </button>
            <button role="radio" aria-checked={kind === 'black'} className={`cg-choice black${kind === 'black' ? ' on' : ''}`} onClick={() => setKind('black')} disabled={spinning}>
              Black · 2×
            </button>
            <button role="radio" aria-checked={kind === 'number'} className={`cg-choice num${kind === 'number' ? ' on' : ''}`} onClick={() => setKind('number')} disabled={spinning}>
              Number · 36×
            </button>
            {kind === 'number' && (
              <input type="number" min={0} max={36} value={pick} aria-label="Lucky number" disabled={spinning} onChange={(e) => setPick(Math.max(0, Math.min(36, Math.floor(Number(e.target.value)) || 0)))} />
            )}
          </div>
          <BetBox balance={balance} bet={bet} setBet={setBet} disabled={spinning} />
          <div className="cg-actions">
            <button className="spend sm" onClick={() => spin(bet, kind, false)} disabled={spinning || bet < 1 || (balance ?? 0) < bet}>
              {spinning ? 'Spinning…' : `Spin · ${bet} coins`}
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
