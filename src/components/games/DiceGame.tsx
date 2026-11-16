import { useState } from 'react'
import { casino, type GameProps } from '../../lib/casino'
import { errorMessage } from '../../lib/errors'
import { motionReduced } from '../../lib/anim'
import BetBox from './BetBox'

type Roll = { balance: number; roll: number; win: boolean; bet: number; payout: number; chance: number }

/** Dice: roll 1-100 and bet it lands over or under a target you choose. The rarer the roll, the bigger the payout. After a win, ride it: double or nothing. */
export default function DiceGame({ balance, setBalance }: GameProps) {
  const [bet, setBet] = useState(10)
  const [over, setOver] = useState(false)
  const [target, setTarget] = useState(50)
  const [shown, setShown] = useState<number | null>(null) // the number on the die (it flickers while rolling)
  const [rolling, setRolling] = useState(false)
  const [last, setLast] = useState<Roll | null>(null)
  const [round, setRound] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // "Under N" wins on a roll below N; "over N" wins on a roll above N. Keep the chance between 2% and 95%.
  const lo = over ? 5 : 3
  const hi = over ? 98 : 96
  const t = Math.min(hi, Math.max(lo, target))
  const chance = over ? 100 - t : t - 1
  const mult = 97 / chance

  async function roll(stake: number, double: boolean) {
    setRolling(true)
    setError(null)
    try {
      const r = await casino<Roll>('dice_roll', { p_bet: stake, p_over: over, p_target: t, p_double: double })
      setBalance(r.balance - r.payout)
      if (!motionReduced()) {
        for (let i = 0; i < 12; i++) {
          setShown(1 + Math.floor(Math.random() * 100))
          await new Promise((res) => setTimeout(res, 60 + i * 12))
        }
      }
      setShown(r.roll)
      setBalance(r.balance)
      setLast(r)
      setRound(double ? round + 1 : 1)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRolling(false)
    }
  }

  const canRide = !!last && last.win && !rolling

  return (
    <div className="cg">
      <div className="cg-die" aria-live="polite">
        <span className={`cg-die-face${last && !rolling ? (last.win ? ' win' : ' lose') : ''}`}>{shown ?? '?'}</span>
      </div>
      <div className="cg-track" aria-hidden="true">
        <span className="cg-zone" style={over ? { left: `${t}%`, right: 0 } : { left: 0, width: `${t - 1}%` }} />
        {shown !== null && <span className="cg-marker" style={{ left: `${shown}%` }} />}
      </div>

      <div className="cg-result" aria-live="polite">
        {last && !rolling && (last.win ? <b className="gold-text">Rolled {last.roll}: you win {last.payout}!{round > 1 ? ` (round ${round})` : ''}</b> : <span className="muted">Rolled {last.roll}. You lose {last.bet}.</span>)}
      </div>

      {canRide ? (
        <div className="cg-ride">
          <p>
            {round > 1 ? `Round ${round + 1}` : 'Double or nothing'}: a 48% shot at <b>{last!.payout * 2}</b> ({2 ** (round + 1)}× your first bet).
          </p>
          <div className="cg-actions">
            <button className="spend sm" onClick={() => roll(last!.payout, true)} disabled={(balance ?? 0) < last!.payout}>
              Double or nothing
            </button>
            <button className="secondary" onClick={() => setLast(null)}>
              Take it
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="cg-choices" role="radiogroup" aria-label="Over or under">
            <button role="radio" aria-checked={!over} className={`cg-choice${!over ? ' on' : ''}`} onClick={() => setOver(false)} disabled={rolling}>
              Under
            </button>
            <button role="radio" aria-checked={over} className={`cg-choice${over ? ' on' : ''}`} onClick={() => setOver(true)} disabled={rolling}>
              Over
            </button>
          </div>
          <label className="cg-slider">
            <span>
              {over ? 'Over' : 'Under'} <b>{t}</b>
            </span>
            <input type="range" min={lo} max={hi} value={t} onChange={(e) => setTarget(Number(e.target.value))} disabled={rolling} aria-label="Target" />
          </label>
          <p className="cg-odds">
            {chance}% chance · pays <b>{mult.toFixed(2)}×</b>
          </p>
          <BetBox balance={balance} bet={bet} setBet={setBet} disabled={rolling} />
          <div className="cg-actions">
            <button className="spend sm" onClick={() => roll(bet, false)} disabled={rolling || bet < 1 || (balance ?? 0) < bet}>
              {rolling ? 'Rolling…' : `Roll · ${bet} coins`}
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
