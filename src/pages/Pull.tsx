import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BULK_PULLS, PULL_COST, useEarnings } from '../lib/earnings'
import { INITIAL_REELS, isSpendResult, reelsFor, type Result, type SymbolId, type Winnings } from '../lib/slots'
import Earnings from '../components/Earnings'
import Badge from '../components/Badge'
import { SlotSymbol } from '../components/SlotSymbol'
import SlotMachine, { type SlotPhase, type Spin } from '../components/SlotMachine'
import BigSpinOverlay, { type BigSpinItem } from '../components/BigSpinOverlay'

type Pending = { id: number; result: Result; final: SymbolId[]; fast: boolean }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function Pull() {
  const { balance, setBalance, error: loadError } = useEarnings()
  const [winnings, setWinnings] = useState<Winnings | null>(null)
  const [phase, setPhase] = useState<SlotPhase>('idle')
  const [spin, setSpin] = useState<Spin | null>(null)
  const [outcome, setOutcome] = useState<Result | null>(null)
  const [remaining, setRemaining] = useState(0) // loaded pulls the lever hasn't played yet
  const [inserting, setInserting] = useState(1)
  const [bigSpin, setBigSpin] = useState<BigSpinItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queue = useRef<Pending[]>([]) // pulls paid for and rolled, waiting for the lever
  const current = useRef<Pending | null>(null) // the pull whose reels are spinning
  const bulk = useRef(false) // a 10-coin batch: one lever drag reveals all of it at once
  const spinCount = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)

  // The page background is a burst of lines pointing at the machine; tell the CSS how far down the page the machine is.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const place = () => {
      const r = stage.getBoundingClientRect()
      document.body.style.setProperty('--burst-y', `${Math.round(r.top + window.scrollY + r.height / 2)}px`)
    }
    place()
    window.addEventListener('resize', place)
    const resizeObserver = new ResizeObserver(place) // the page above the machine can change height (errors, wrapping)
    resizeObserver.observe(document.body)
    return () => {
      window.removeEventListener('resize', place)
      resizeObserver.disconnect()
      document.body.style.removeProperty('--burst-y')
    }
  }, [])

  useEffect(() => {
    supabase.rpc('get_winnings').then(({ data }) => {
      if (data) setWinnings(data as Winnings)
    })
  }, [])

  const idleish = phase === 'idle' || phase === 'done'
  const canLoad = (n: number) => idleish && remaining === 0 && (balance ?? 0) >= PULL_COST * n
  const armed = remaining > 0 && (phase === 'loaded' || phase === 'done')

  // Step 1: coins. Pays for the pulls and rolls every result in the database; nothing is revealed until the lever is pulled.
  async function loadCoins(count: number) {
    if (!canLoad(count)) return
    setPhase('loading')
    setInserting(count)
    setError(null)
    setOutcome(null)
    // Minimum wait so the coin-drop animation always gets to play.
    const [{ data, error }] = await Promise.all([supabase.rpc('spend_pulls', { p_count: count }), wait(count > 1 ? 1000 : 600)])
    if (error || !isSpendResult(data)) {
      setError(error?.message ?? 'Pull failed. Have you run supabase/migrations/0004_bulk_pulls.sql?')
      setPhase('idle')
      return
    }
    queue.current = data.results.map((result) => ({ id: ++spinCount.current, result, final: reelsFor(result), fast: count > 1 }))
    bulk.current = count > 1
    setRemaining(queue.current.length)
    setBalance(data.balance) // the coins are gone as soon as they're in the slot
    setPhase('loaded')
  }

  // Step 2: the lever. A single pull plays its reels normally; a 10-coin batch expands
  // to fill the screen and spins every pull in the batch at the same time.
  const pullLever = useCallback(() => {
    if (bulk.current) {
      const items: BigSpinItem[] = queue.current.map((p) => ({ id: p.id, final: p.final, result: p.result }))
      queue.current = []
      setRemaining(0)
      setPhase('spinning')
      setBigSpin(items)
      return
    }
    const next = queue.current.shift()
    if (!next) return
    current.current = next
    setRemaining(queue.current.length)
    setSpin((prev) => ({ id: next.id, from: prev ? prev.final : INITIAL_REELS, final: next.final, fast: next.fast }))
    setPhase('spinning')
  }, [])

  // The overlay has finished its 30-reel reveal: fold every result into winnings at once.
  function finishBigSpin(items: BigSpinItem[]) {
    setWinnings(
      (w) =>
        w && {
          pulls: w.pulls + items.length,
          silver: w.silver + items.filter((i) => i.result === 'silver').length,
          gold: w.gold + items.filter((i) => i.result === 'gold').length,
        },
    )
    const anyGold = items.some((i) => i.result === 'gold')
    const anySilver = items.some((i) => i.result === 'silver')
    setOutcome(anyGold ? 'gold' : anySilver ? 'silver' : 'nothing')
    setBigSpin(null)
    bulk.current = false
    setPhase('done')
  }

  // Lever tried without a coin: wiggle the coin slot.

  // Winnings and the result banner update only once the reels have actually stopped.
  const handleLanded = useCallback((id: number) => {
    const p = current.current
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

  const broke = balance !== null && balance < PULL_COST

  return (
    <div className="pull">
      <Link to="/" className="button spend keep-earning">
        <span className="keep-arrow">
          <SlotSymbol id="arrow" />
        </span>
        <span>Keep earning</span>
      </Link>
      <div className="wallet earn-panel">
        <Earnings compact balance={balance} />
      </div>

      {loadError && (
        <p className="error">
          Couldn't load earnings: {loadError}. Have you run <code>supabase/migrations/0002_pulls.sql</code>,{' '}
          <code>0003_slots.sql</code> and <code>0004_bulk_pulls.sql</code>?
        </p>
      )}

      {bigSpin && <BigSpinOverlay items={bigSpin} onDone={() => finishBigSpin(bigSpin)} />}

      <div ref={stageRef}>
        <SlotMachine
          spin={spin}
          phase={phase}
          outcome={outcome}
          armed={armed}
          remaining={remaining}
          inserting={inserting}
          canInsert={canLoad(1)}
          onLanded={handleLanded}
          onCoin={() => loadCoins(1)}
          onPull={pullLever}
        />
      </div>

      <div className="pull-actions">
        <div className="buttons">
          <button className="spend sm" onClick={() => loadCoins(1)} disabled={!canLoad(1)}>
            Insert 1 coin
          </button>
          <button className="spend sm" onClick={() => loadCoins(BULK_PULLS)} disabled={!canLoad(BULK_PULLS)}>
            Insert {BULK_PULLS} coins
          </button>
        </div>
        {broke && <p className="muted">Out of coins. Earn more by studying.</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="slot-result" aria-live="polite">
        {phase === 'loading' && <span className="muted">Inserting {plural(inserting, 'coin')}…</span>}
        {phase === 'spinning' && <span className="muted">Spinning…</span>}
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
        {phase === 'done' && outcome === 'nothing' && <span className="muted">Nothing this time.</span>}
        {armed && <span className="gold-text">{plural(remaining, 'pull')} loaded. Drag the lever down!</span>}
      </div>

      <section className="panel winnings-panel">
        <h3>
          <SlotSymbol id="star" />
          Winnings
          <SlotSymbol id="star" />
        </h3>
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
            <span className="win-icon">
              <SlotSymbol id="coin" />
            </span>
            <span className="win-count">{winnings?.pulls ?? '–'}</span>
            <span className="win-label">Total pulls</span>
          </div>
        </div>
      </section>
    </div>
  )
}
