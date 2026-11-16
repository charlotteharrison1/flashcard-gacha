import { useCallback, useRef, useState, type Ref } from 'react'
import { supabase } from '../lib/supabase'
import { BULK_PULLS, PULL_COST } from '../lib/earnings'
import { INITIAL_REELS, isSpendResult, reelsFor, type Result, type SymbolId } from '../lib/slots'
import Badge from './Badge'
import SlotMachine, { type SlotPhase, type Spin } from './SlotMachine'
import BigSpinOverlay, { type BigSpinItem } from './BigSpinOverlay'

type Pending = { id: number; result: Result; final: SymbolId[]; fast: boolean }
type Props = {
  balance: number | null
  setBalance: (balance: number) => void
  /** Called once per finished pull (or batch), so the caller can keep its own tallies. */
  onResults?: (results: Result[]) => void
  stageRef?: Ref<HTMLDivElement>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * The slot machine game: coins in, lever, reels, result banner. It's shared by the Pull page and by "Pick your poison"
 * while studying. The caller owns the coin balance.
 */
export default function SlotsGame({ balance, setBalance, onResults, stageRef }: Props) {
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

  // The overlay has finished its 30-reel reveal.
  function finishBigSpin(items: BigSpinItem[]) {
    onResults?.(items.map((i) => i.result))
    setOutcome(items.some((i) => i.result === 'gold') ? 'gold' : items.some((i) => i.result === 'silver') ? 'silver' : 'nothing')
    setBigSpin(null)
    bulk.current = false
    setPhase('done')
  }

  // The result banner (and the caller's tallies) update only once the reels have actually stopped.
  const handleLanded = useCallback(
    (id: number) => {
      const p = current.current
      if (!p || p.id !== id) return
      setOutcome(p.result)
      onResults?.([p.result])
      setPhase('done')
    },
    [onResults],
  )

  return (
    <>
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
            1 pull · {PULL_COST} coins
          </button>
          <button className="spend sm" onClick={() => loadCoins(BULK_PULLS)} disabled={!canLoad(BULK_PULLS)}>
            {BULK_PULLS} pulls · {PULL_COST * BULK_PULLS} coins
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="slot-result" aria-live="polite">
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
    </>
  )
}
