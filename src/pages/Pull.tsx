import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PULL_COST, useEarnings } from '../lib/earnings'
import { INITIAL_REELS, isSpendResult, reelsFor, type Result, type SymbolId, type Winnings } from '../lib/slots'
import Earnings from '../components/Earnings'
import Badge from '../components/Badge'
import Confetti from '../components/Confetti'
import SlotMachine, { type SlotPhase, type Spin } from '../components/SlotMachine'

type Pending = { id: number; result: Result; final: SymbolId[] }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function Pull() {
  const { balance, setBalance, error: loadError } = useEarnings()
  const [winnings, setWinnings] = useState<Winnings | null>(null)
  const [phase, setPhase] = useState<SlotPhase>('idle')
  const [spin, setSpin] = useState<Spin | null>(null)
  const [outcome, setOutcome] = useState<Result | null>(null)
  const [nudge, setNudge] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<Pending | null>(null)
  const spinCount = useRef(0)

  useEffect(() => {
    supabase.rpc('get_winnings').then(({ data }) => {
      if (data) setWinnings(data as Winnings)
    })
  }, [])

  const canAfford = (balance ?? 0) >= PULL_COST
  const canLoad = (phase === 'idle' || phase === 'done') && canAfford

  // Step 1: the coin. Pays for the pull and rolls the result in the database; nothing is revealed until the lever is pulled.
  async function loadCoin() {
    if (!canLoad) return
    setPhase('loading')
    setError(null)
    setOutcome(null)
    // Minimum wait so the coin-drop animation always gets to play.
    const [{ data, error }] = await Promise.all([supabase.rpc('spend_pull'), wait(600)])
    if (error || !isSpendResult(data)) {
      setError(error?.message ?? 'Pull failed. Have you run supabase/migrations/0003_slots.sql?')
      setPhase('idle')
      return
    }
    const id = ++spinCount.current
    pending.current = { id, result: data.result, final: reelsFor(data.result) }
    setBalance(data.balance) // the coin is gone as soon as it's in the slot
    setPhase('loaded')
  }

  // Step 2: the lever. Plays the reels for the result that's already been rolled.
  const pullLever = useCallback(() => {
    const p = pending.current
    if (!p) return
    setSpin((prev) => ({ id: p.id, from: prev ? prev.final : INITIAL_REELS, final: p.final }))
    setPhase('spinning')
  }, [])

  // Lever tried without a coin: wiggle the coin slot.
  const blocked = useCallback(() => setNudge((n) => n + 1), [])

  // Winnings and the result banner update only once the reels have actually stopped.
  const handleLanded = useCallback((id: number) => {
    const p = pending.current
    if (!p || p.id !== id) return
    setOutcome(p.result)
    setWinnings((w) =>
      w && {
        pulls: w.pulls + 1,
        silver: w.silver + (p.result === 'silver' ? 1 : 0),
        gold: w.gold + (p.result === 'gold' ? 1 : 0),
      },
    )
    setPhase('done')
  }, [])

  const noCoinHint = nudge > 0 && (phase === 'idle' || phase === 'done')

  return (
    <div className="pull">
      <p>
        <Link to="/">← Decks</Link>
      </p>
      <h2>Pull</h2>
      <div className="wallet">
        <Earnings compact balance={balance} />
      </div>

      {loadError && (
        <p className="error">
          Couldn't load earnings: {loadError}. Have you run <code>supabase/migrations/0002_pulls.sql</code> and{' '}
          <code>0003_slots.sql</code>?
        </p>
      )}

      {outcome === 'gold' && <Confetti key={spin?.id} count={130} />}
      {outcome === 'silver' && <Confetti key={spin?.id} count={45} />}

      <SlotMachine
        spin={spin}
        phase={phase}
        outcome={outcome}
        nudge={nudge}
        canInsert={canLoad}
        onLanded={handleLanded}
        onCoin={loadCoin}
        onPull={pullLever}
        onBlocked={blocked}
      />

      <div className="slot-result" aria-live="polite">
        {phase === 'loading' && <span className="muted">Inserting coin…</span>}
        {phase === 'loaded' && <span className="gold-text">Coin loaded. Drag the lever down!</span>}
        {phase === 'spinning' && <span className="muted">Spinning…</span>}
        {noCoinHint && <span className="muted">Insert a coin first.</span>}
        {phase === 'done' && outcome === 'gold' && (
          <>
            <Badge tier="gold" className="badge badge-sm" />
            <span className="gold-text">Gold badge!</span>
          </>
        )}
        {phase === 'done' && outcome === 'silver' && (
          <>
            <Badge tier="silver" className="badge badge-sm" />
            <span className="silver-text">Silver badge!</span>
          </>
        )}
        {phase === 'done' && outcome === 'nothing' && !noCoinHint && <span className="muted">Nothing this time.</span>}
      </div>

      <div className="pull-actions">
        <button className="spend" onClick={loadCoin} disabled={!canLoad}>
          Spend
        </button>
        <p className="muted">
          {balance === null
            ? ' '
            : canAfford
              ? `Costs ${PULL_COST} earnings. Same as clicking the coin slot.`
              : `Costs ${PULL_COST}. Earn ${PULL_COST - balance} more by studying.`}
        </p>
        <p className="muted odds">Odds per pull: gold 1% · silver 9% · nothing 90%</p>
        {error && <p className="error">{error}</p>}
      </div>

      <section className="panel">
        <h3>Winnings</h3>
        <div className="winnings">
          <div className="win">
            <Badge tier="gold" />
            <span className="win-count">{winnings?.gold ?? '–'}</span>
            <span className="win-label">Gold</span>
          </div>
          <div className="win">
            <Badge tier="silver" />
            <span className="win-count">{winnings?.silver ?? '–'}</span>
            <span className="win-label">Silver</span>
          </div>
          <div className="win">
            <span className="win-count">{winnings?.pulls ?? '–'}</span>
            <span className="win-label">Total pulls</span>
          </div>
        </div>
      </section>
    </div>
  )
}
