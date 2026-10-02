import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { INITIAL_REELS, randomFill, type Result, type SymbolId } from '../lib/slots'
import { SlotSymbol } from './SlotSymbol'
import Lever from './Lever'

/** `fast` spins (from a 10-coin batch) play at a fraction of the time and skip the slow-crawl tension. */
export type Spin = { id: number; from: SymbolId[]; final: SymbolId[]; fast?: boolean }
/** idle -> (coin) loading -> loaded -> (lever) spinning -> done. `done` returns to armed while pulls remain. */
export type SlotPhase = 'idle' | 'loading' | 'loaded' | 'spinning' | 'done'

// --- Reel timing (tweak these) ----------------------------------------------
const STOPS = [3000, 4100, 5200] // ms until each reel has fully stopped, left to right
const DECEL = 1500 // ms each reel spends slowing down
const TENSION_STOP = 7600 // third reel takes longer when the first two match...
const TENSION_DECEL = 2600 // ...and crawls into place
const WINDUP_MS = 250 // small backwards dip before the reel takes off
const ACCEL_MS = 600
const SETTLE_MS = 350 // overshoot bounce back onto the symbol
const V = 13 // cruising speed, in symbols per second (not scaled, so fast spins don't strobe)
const WINDUP_CELLS = 0.35
const OVERSHOOT = 0.22
const FAST = 0.3 // time scale for spins from a 10-coin batch: ~1.6s per spin instead of ~5s

const EASE_IN = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)' // quad-in: average speed = V/2
const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)' // cubic-out: average speed = V/3

// -----------------------------------------------------------------------------

type ReelPlan = { strip: SymbolId[]; frames: Keyframe[]; duration: number }

const one = () => randomFill(1)[0]

/**
 * A reel is a tall strip of symbols scrolled with one transform animation:
 * wind-up, accelerate, cruise, decelerate, overshoot, settle. The strip is built forwards
 * (index 0 = spare cell for the wind-up, 1 = where the reel was, last-1 = target, last = spare
 * for the overshoot) and rendered reversed so symbols travel downwards like a real reel.
 * `k` scales every phase in time (1 = normal, FAST = quick).
 */
function buildReel(from: SymbolId, target: SymbolId, duration: number, decel: number, k: number): ReelPlan {
  const windup = WINDUP_MS * k
  const accel = ACCEL_MS * k
  const settle = SETTLE_MS * k
  const cruiseMs = Math.max(0, duration - windup - accel - decel - settle)
  const start = 1
  const afterWindup = start - WINDUP_CELLS
  const afterAccel = afterWindup + (V * accel) / 2000
  const afterCruise = afterAccel + (V * cruiseMs) / 1000
  const last = Math.max(start + 3, Math.round(afterCruise + (V * decel) / 3000 - OVERSHOOT))

  const strip = [one(), from, ...randomFill(last - 2), target, one()]
  const len = strip.length
  // Percent is relative to the strip's own height, so it stays correct if the window is resized.
  const y = (cell: number) => `translateY(${-((len - 1 - cell) / len) * 100}%)`
  const at = (ms: number) => ms / duration

  const frames: Keyframe[] = [
    { offset: 0, transform: y(start), easing: 'ease-out' },
    { offset: at(windup), transform: y(afterWindup), easing: EASE_IN },
    { offset: at(windup + accel), transform: y(afterAccel), easing: 'linear' },
    { offset: at(windup + accel + cruiseMs), transform: y(afterCruise), easing: EASE_OUT },
    { offset: at(duration - settle), transform: y(last + OVERSHOOT), easing: 'ease-in-out' },
    { offset: 1, transform: y(last) },
  ]
  return { strip: strip.reverse(), frames, duration }
}

type Props = {
  spin: Spin | null
  phase: SlotPhase
  outcome: Result | null
  /** A loaded pull is waiting and the lever will fire it. */
  armed: boolean
  /** Loaded pulls not yet played. */
  remaining: number
  /** How many coins are being inserted right now (drives the coin-drop animation). */
  inserting: number
  /** Bumps each time the player tries the lever without a coin, to wiggle the coin slot. */
  nudge: number
  canInsert: boolean
  onLanded: (id: number) => void
  onCoin: () => void
  onPull: () => void
  onBlocked: () => void
}

export default function SlotMachine({
  spin,
  phase,
  outcome,
  armed,
  remaining,
  inserting,
  nudge,
  canInsert,
  onLanded,
  onCoin,
  onPull,
  onBlocked,
}: Props) {
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const tension = !!spin && !spin.fast && spin.final[0] === spin.final[1]

  const reels = useMemo<ReelPlan[] | null>(() => {
    if (!spin) return null
    const k = spin.fast ? FAST : 1
    const crawl = !spin.fast && spin.final[0] === spin.final[1]
    return spin.final.map((target, i) => {
      const slow = crawl && i === 2
      return buildReel(spin.from[i], target, (slow ? TENSION_STOP : STOPS[i]) * k, (slow ? TENSION_DECEL : DECEL) * k, k)
    })
  }, [spin])

  const strips: SymbolId[][] = reels ? reels.map((r) => r.strip) : INITIAL_REELS.map((s) => [s])

  // Only `transform` is animated, so it runs on the GPU and stays smooth.
  useLayoutEffect(() => {
    if (!spin || !reels) return
    let cancelled = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const finished = stripRefs.current.map((el, i) => {
      if (!el || !reels[i]) return Promise.resolve()
      el.getAnimations().forEach((a) => a.cancel())
      const { frames, duration } = reels[i]
      return el.animate(reduceMotion ? [frames[frames.length - 1]] : frames, {
        duration: reduceMotion ? 1 : duration,
        fill: 'forwards',
      }).finished
    })

    Promise.all(finished).then(
      () => {
        if (!cancelled) onLanded(spin.id)
      },
      () => {}, // animation cancelled by a newer spin
    )
    return () => {
      cancelled = true
    }
  }, [spin, reels, onLanded])

  const cls = [
    'slot',
    phase === 'spinning' ? 'spinning' : '',
    phase === 'spinning' && tension ? 'tension' : '',
    phase === 'done' && outcome === 'gold' ? 'win-gold' : '',
    phase === 'done' && outcome === 'silver' ? 'win-silver' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const coinLabel = phase === 'loading' ? 'Inserting…' : phase === 'spinning' ? 'Spinning' : armed ? `${remaining} loaded` : ''
  const drops = Math.min(inserting, 5)

  return (
    <div className="machine">
      <div className={cls} style={{ '--tension-delay': `${STOPS[1]}ms` } as CSSProperties}>
        <div className="slot-title">Lucky Pull</div>
        <div className="bulbs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="bulb" />
          ))}
        </div>
        <div className="slot-window" role="img" aria-label="Slot machine reels">
          {strips.map((strip, i) => (
            <div className="reel" key={i}>
              <div
                className="reel-strip"
                ref={(el) => {
                  stripRefs.current[i] = el
                }}
              >
                {strip.map((id, j) => (
                  <div className="reel-cell" key={j}>
                    <SlotSymbol id={id} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={`coin-panel${nudge ? ' nudge' : ''}`} key={nudge}>
          <button
            className={`coin-slot${armed ? ' ready' : ''}${phase === 'loading' || phase === 'spinning' ? ' busy' : ''}`}
            onClick={onCoin}
            disabled={!canInsert}
            aria-label="Insert 1 coin to load a pull"
          >
            <span className="coin-lamp" aria-hidden="true" />
            <span className="coin-slit" aria-hidden="true" />
            <span className="coin-label">{coinLabel}</span>
            {phase === 'loading' &&
              Array.from({ length: drops }, (_, i) => (
                <span
                  key={i}
                  className="coin-drop"
                  aria-hidden="true"
                  style={{ left: `calc(50% + ${(i - (drops - 1) / 2) * 16}px)`, animationDelay: `${i * 90}ms` }}
                />
              ))}
          </button>
        </div>
      </div>

      <Lever armed={armed} phase={phase} onPull={onPull} onBlocked={onBlocked} />
    </div>
  )
}
