import { useEffect, useState } from 'react'
import { casino, type BjResult, type BjView, type GameProps } from '../../lib/casino'
import { errorMessage } from '../../lib/errors'
import BetBox from './BetBox'
import PlayingCard from './PlayingCard'

const MESSAGES: Record<BjResult, string> = {
  blackjack: 'Blackjack! Pays 3 to 2.',
  win: 'You win!',
  push: 'Push. Your bet comes back.',
  lose: 'Dealer wins.',
  bust: 'Bust. You went over 21.',
}

/** Blackjack against the dealer: one fresh deck a hand, blackjack pays 3:2, the dealer hits on soft 17. Hit, stand or double down (no splitting). */
export default function BlackjackGame({ balance, setBalance }: GameProps) {
  const [bet, setBet] = useState(10)
  const [hand, setHand] = useState<BjView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // pick up a hand left open (the window was closed mid-hand)
  useEffect(() => {
    casino<BjView | null>('bj_state')
      .then((h) => {
        if (h) setHand(h)
      })
      .catch(() => {})
  }, [])

  async function run(fn: string, args?: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const h = await casino<BjView>(fn, args)
      setHand(h)
      setBalance(h.balance)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const live = !!hand && hand.result === null
  const canDouble = live && hand.can_double && (balance ?? 0) >= hand.bet

  return (
    <div className="cg">
      {hand ? (
        <div className="cg-table">
          <div className="cg-hand">
            <span className="cg-who">
              Dealer {hand.dealer_total !== null && <b>{hand.dealer_total}</b>}
            </span>
            <div className="cg-cards">
              {hand.dealer.map((c, i) => (
                <PlayingCard key={i} n={c} />
              ))}
              {live && <PlayingCard n={null} />}
            </div>
          </div>
          <div className="cg-hand">
            <span className="cg-who">
              You <b>{hand.player_total}</b> · bet {hand.bet}
            </span>
            <div className="cg-cards">
              {hand.player.map((c, i) => (
                <PlayingCard key={i} n={c} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="cg-rules">Beat the dealer without going over 21. Blackjack pays 3 to 2. The dealer hits on soft 17. You can double down on your first two cards.</p>
      )}

      <div className="cg-result" aria-live="polite">
        {hand?.result && (
          <b className={hand.payout > hand.bet ? 'gold-text' : hand.result === 'push' ? '' : 'muted'}>
            {MESSAGES[hand.result]} {hand.payout > 0 ? `(+${hand.payout - hand.bet})` : `(−${hand.bet})`}
          </b>
        )}
      </div>

      {live ? (
        <div className="cg-actions">
          <button className="spend sm" onClick={() => run('bj_act', { p_action: 'hit' })} disabled={busy}>
            Hit
          </button>
          <button className="spend sm" onClick={() => run('bj_act', { p_action: 'stand' })} disabled={busy}>
            Stand
          </button>
          <button className="secondary" onClick={() => run('bj_act', { p_action: 'double' })} disabled={busy || !canDouble}>
            Double
          </button>
        </div>
      ) : (
        <>
          <BetBox balance={balance} bet={bet} setBet={setBet} disabled={busy} />
          <div className="cg-actions">
            <button className="spend sm" onClick={() => run('bj_deal', { p_bet: bet })} disabled={busy || bet < 1 || (balance ?? 0) < bet}>
              {hand ? 'Deal again' : 'Deal'} · {bet} coins
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
