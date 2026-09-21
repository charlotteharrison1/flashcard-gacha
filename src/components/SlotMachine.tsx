import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { INITIAL_REELS, randomFill, type Result, type SymbolId } from '../lib/slots'
import { SlotSymbol } from './SlotSymbol'

export type Spin = { id: number; from: SymbolId[]; final: SymbolId[] }
/** idle -> (coin) loading -> loaded -> (lever) spinning -> done */
export type SlotPhase = 'idle' | 'loading' | 'loaded' | 'spinning' | 'done'

// --- Reel timing (tweak these) ----------------------------------------------
const STOPS = [3000, 4100, 5200] // ms until each reel has fully stopped, left to right
const DECEL = 1500 // ms each reel spends slowing down
const TENSION_STOP = 7600 // third reel takes longer when the first two match...
const TENSION_DECEL = 2600 // ...and crawls into place
const WINDUP_MS = 250 // small backwards dip before the reel takes off
const ACCEL_MS = 600
const SETTLE_MS = 350 // overshoot bounce back onto the symbol
const V = 13 // cruising speed, in symbols per second
const WINDUP_CELLS = 0.35
const OVERSHOOT = 0.22

const EASE_IN = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)' // quad-in: average speed = V/2
const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)' // cubic-out: average speed = V/3

// --- Lever (degrees; 0 = pointing right, positive = swinging down) -----------
const LEVER_REST = -55
const LEVER_END = 50
const LEVER_PULL_AT = 32 // drag past this and the pull fires
const SPRING = 'cubic-bezier(0.3, 1.5, 0.5, 1)'
// -----------------------------------------------------------------------------

type ReelPlan = { strip: SymbolId[]; frames: Keyframe[]; duration: number }

const one = () => randomFill(1)[0]

/**
 * A reel is a tall strip of symbols scrolled with one transform animation:
 * wind-up, accelerate, cruise, decelerate, overshoot, settle. The strip is built forwards
 * (index 0 = spare cell for the wind-up, 1 = where the reel was, last-1 = target, last = spare
 * for the overshoot) and rendered reversed so symbols travel downwards like a real reel.
 */
function buildReel(from: SymbolId, target: SymbolId, duration: number, decel: number): ReelPlan {
  const cruiseMs = Math.max(0, duration - WINDUP_MS - ACCEL_MS - decel - SETTLE_MS)
  const start = 1
  const afterWindup = start - WINDUP_CELLS
  const afterAccel = afterWindup + (V * ACCEL_MS) / 2000
  const afterCruise = afterAccel + (V * cruiseMs) / 1000
  const last = Math.max(start + 3, Math.round(afterCruise + (V * decel) / 3000 - OVERSHOOT))

  const strip = [one(), from, ...randomFill(last - 2), target, one()]
  const len = strip.length
  // Percent is relative to the strip's own height, so it stays correct if the window is resized.
  const y = (cell: number) => `translateY(${-((len - 1 - cell) / len) * 100}%)`
  const at = (ms: number) => ms / duration

  const frames: Keyframe[] = [
    { offset: 0, transform: y(start), easing: 'ease-out' },
    { offset: at(WINDUP_MS), transform: y(afterWindup), easing: EASE_IN },
    { offset: at(WINDUP_MS + ACCEL_MS), transform: y(afterAccel), easing: 'linear' },
    { offset: at(WINDUP_MS + ACCEL_MS + cruiseMs), transform: y(afterCruise), easing: EASE_OUT },
    { offset: at(duration - SETTLE_MS), transform: y(last + OVERSHOOT), easing: 'ease-in-out' },
    { offset: 1, transform: y(last) },
  ]
  return { strip: strip.reverse(), frames, duration }
}

type Props = {
  spin: Spin | null
  phase: SlotPhase
  outcome: Result | null
  /** Bumps each time the player tries the lever without a coin, to wiggle the coin slot. */
  nudge: number
  canInsert: boolean
  onLanded: (id: number) => void
  onCoin: () => void
  onPull: () => void
  onBlocked: () => void
}

export default function SlotMachine({ spin, phase, outcome, nudge, canInsert, onLanded, onCoin, onPull, onBlocked }: Props) {
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const armRef = useRef<HTMLDivElement>(null)
  const pivotRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, pulled: false })
  const timers = useRef<number[]>([])
  const armed = phase === 'loaded'
  const tension = !!spin && spin.final[0] === spin.final[1]

  const reels = useMemo<ReelPlan[] | null>(() => {
    if (!spin) return null
    return spin.final.map((target, i) => {
      const slow = spin.final[0] === spin.final[1] && i === 2
      return buildReel(spin.from[i], target, slow ? TENSION_STOP : STOPS[i], slow ? TENSION_DECEL : DECEL)
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

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  // --- Lever: the arm follows the pointer around the pivot; dragging far enough fires the pull ---
  function setAngle(deg: number, ms = 0, easing = 'linear') {
    const arm = armRef.current
    if (!arm) return
    arm.style.transition = ms ? `transform ${ms}ms ${easing}` : 'none'
    arm.style.transform = `rotate(${deg}deg)`
  }
  const snapBack = () => setAngle(LEVER_REST, 500, SPRING)
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  function pull() {
    drag.current.pulled = true
    setAngle(LEVER_END, 120, 'ease-out')
    onPull()
    later(snapBack, 260)
  }

  function denied() {
    onBlocked()
    setAngle(LEVER_REST + 14, 90, 'ease-out') // a dead "clunk": the lever won't go down without a coin
    later(snapBack, 140)
  }

  function onLeverDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!armed) return denied()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { active: true, pulled: false }
  }

  function onLeverMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active || drag.current.pulled || !pivotRef.current) return
    const p = pivotRef.current.getBoundingClientRect()
    const angle = (Math.atan2(e.clientY - (p.top + p.height / 2), e.clientX - (p.left + p.width / 2)) * 180) / Math.PI
    // Pointer wandered back over the cabinet: treat the lever as let go.
    const clamped = Math.abs(angle) > 100 ? LEVER_REST : Math.max(LEVER_REST, Math.min(LEVER_END, angle))
    setAngle(clamped)
    if (clamped >= LEVER_PULL_AT) pull()
  }

  function onLeverUp() {
    if (!drag.current.active) return
    const pulled = drag.current.pulled
    drag.current.active = false
    if (!pulled) snapBack()
  }

  function onLeverKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return
    e.preventDefault()
    if (armed) pull()
    else denied()
  }

  const cls = [
    'slot',
    phase === 'spinning' ? 'spinning' : '',
    phase === 'spinning' && tension ? 'tension' : '',
    phase === 'done' && outcome === 'gold' ? 'win-gold' : '',
    phase === 'done' && outcome === 'silver' ? 'win-silver' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const coinLabel =
    phase === 'loaded' ? 'Ready' : phase === 'loading' ? 'Inserting…' : phase === 'spinning' ? 'Spinning' : canInsert ? 'Insert coin' : 'No coins'

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
            className={`coin-slot${phase === 'loaded' ? ' ready' : ''}${phase === 'loading' || phase === 'spinning' ? ' busy' : ''}`}
            onClick={onCoin}
            disabled={!canInsert}
            aria-label="Insert a coin to load a pull"
          >
            <span className="coin-lamp" aria-hidden="true" />
            <span className="coin-slit" aria-hidden="true" />
            <span className="coin-label">{coinLabel}</span>
            {phase === 'loading' && <span className="coin-drop" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className={`lever${armed ? ' armed' : ''}`}>
        <div className="lever-mount" ref={pivotRef} aria-hidden="true" />
        <div className="lever-arm" ref={armRef} style={{ transform: `rotate(${LEVER_REST}deg)` }}>
          <div
            className="lever-ball"
            role="button"
            tabIndex={0}
            aria-label="Pull lever"
            aria-disabled={!armed}
            onPointerDown={onLeverDown}
            onPointerMove={onLeverMove}
            onPointerUp={onLeverUp}
            onPointerCancel={onLeverUp}
            onKeyDown={onLeverKey}
          />
        </div>
      </div>
    </div>
  )
}
