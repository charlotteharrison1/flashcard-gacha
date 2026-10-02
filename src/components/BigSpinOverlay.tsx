import { useEffect, useMemo, useRef, useState } from 'react'
import { randomFill, type Result, type SymbolId } from '../lib/slots'
import { SlotSymbol } from './SlotSymbol'
import Badge from './Badge'

export type BigSpinItem = { id: number; final: SymbolId[]; result: Result }

// --- Timing (tweak these) ----------------------------------------------------
const V = 10 // cruise speed, in symbols per second
const CELL_MS = 1000 / V
const FIRST_LAND = 1800 // ms until the first machine's first reel lands
const MACHINE_GAP = 600 // ms between one machine landing and the next
const REEL_GAP = 180 // ms between a machine's reels, left to right
const DECEL = 900 // ms each reel spends slowing into place
const LOOP = 8 // symbols in the repeating cruise strip
const LAND_CELLS = 5 // symbols passed while slowing: [target, ...filler, where it was]
const EASE_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)'
// -----------------------------------------------------------------------------

type ReelPlan = { cruise: SymbolId[]; land: SymbolId[]; landAt: number }

const pct = (cells: number, of: number) => `translateY(${(cells / of) * 100}%)`

/**
 * Full-screen reveal for a 10-coin batch. Every reel cruises in a seamless loop, then the machines
 * land one at a time (each machine's three reels left to right), lighting up as they stop.
 * A reel lands on a whole-symbol boundary of the loop, so the hand-off from cruise strip to
 * landing strip is invisible.
 */
export default function BigSpinOverlay({ items, onDone }: { items: BigSpinItem[]; onDone: () => void }) {
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [landed, setLanded] = useState(reduceMotion ? items.length : 0) // machines that have finished, in order
  const cruiseRefs = useRef<(HTMLDivElement | null)[]>([])
  const landRefs = useRef<(HTMLDivElement | null)[]>([])
  const anims = useRef<Animation[]>([])
  const timers = useRef<number[]>([])

  const plans = useMemo<ReelPlan[]>(
    () =>
      items.flatMap((item, gi) =>
        item.final.map((target, ri) => {
          const cruise = randomFill(LOOP)
          // Snap the landing moment to a symbol boundary: the cruise strip is then exactly on a whole symbol.
          const landAt = Math.round((FIRST_LAND + gi * MACHINE_GAP + ri * REEL_GAP) / CELL_MS) * CELL_MS
          const startCell = ((-Math.round(landAt / CELL_MS) % LOOP) + LOOP) % LOOP
          // Top to bottom: target first, the symbol that was showing last; the strip slides downwards.
          const land = [target, ...randomFill(LAND_CELLS - 2), cruise[startCell]]
          return { cruise, land, landAt }
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` is fixed for this overlay's lifetime
    [],
  )

  useEffect(() => {
    const started = anims.current
    const pending = timers.current
    if (reduceMotion) {
      // No motion: show every answer straight away.
      cruiseRefs.current.forEach((el) => el && (el.style.visibility = 'hidden'))
      landRefs.current.forEach((el) => {
        if (!el) return
        el.style.visibility = 'visible'
        el.style.transform = pct(0, LAND_CELLS)
      })
      return
    }

    plans.forEach((plan, i) => {
      const cruise = cruiseRefs.current[i]
      const land = landRefs.current[i]
      if (!cruise || !land) return
      // Cruise: slide down one symbol-loop forever (loop strip = LOOP symbols + a copy of the first).
      started.push(
        cruise.animate([{ transform: pct(-LOOP, LOOP + 1) }, { transform: pct(0, LOOP + 1) }], {
          duration: LOOP * CELL_MS,
          iterations: Infinity,
          easing: 'linear',
        }),
        // Hide the cruise strip the instant the landing strip takes over.
        cruise.animate([{ visibility: 'visible' }, { visibility: 'hidden' }], { delay: plan.landAt, duration: 1, fill: 'forwards' }),
        land.animate(
          [
            { visibility: 'visible', transform: pct(-(LAND_CELLS - 1), LAND_CELLS) },
            { visibility: 'visible', transform: pct(0, LAND_CELLS) },
          ],
          { delay: plan.landAt, duration: DECEL, easing: EASE_OUT, fill: 'forwards' },
        ),
      )
    })

    // Machine g is done when its last reel has settled.
    items.forEach((_, gi) => {
      const lastReel = plans[gi * 3 + 2]
      pending.push(window.setTimeout(() => setLanded((n) => Math.max(n, gi + 1)), lastReel.landAt + DECEL))
    })

    return () => {
      started.splice(0).forEach((a) => a.cancel())
      pending.splice(0).forEach((t) => window.clearTimeout(t))
    }
  }, [plans, items, reduceMotion])

  function skip() {
    timers.current.splice(0).forEach((t) => window.clearTimeout(t))
    // Landing animations are finite: finishing them puts every reel on its answer.
    anims.current.forEach((a) => {
      if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish()
    })
    cruiseRefs.current.forEach((el) => el && (el.style.visibility = 'hidden'))
    setLanded(items.length)
  }

  const done = landed >= items.length
  const golds = items.filter((i) => i.result === 'gold').length
  const silvers = items.filter((i) => i.result === 'silver').length
  const nothing = items.length - golds - silvers

  return (
    <div className="bigspin-backdrop" role="dialog" aria-modal="true" aria-label="Ten-pull results">
      <div className="bigspin">
        <div className="bigspin-title">10 coins in — everybody spins!</div>
        <div className="bigspin-grid">
          {items.map((item, gi) => {
            const revealed = gi < landed
            return (
              <div className={`bigspin-item${revealed && item.result !== 'nothing' ? ` win ${item.result}` : ''}`} key={item.id}>
                <div className="bigspin-reels">
                  {item.final.map((_, ri) => {
                    const idx = gi * 3 + ri
                    const plan = plans[idx]
                    return (
                      <div className="bigspin-reel" key={ri}>
                        <div
                          className="bigspin-strip"
                          ref={(el) => {
                            cruiseRefs.current[idx] = el
                          }}
                        >
                          {[...plan.cruise, plan.cruise[0]].map((sym, ci) => (
                            <div className="bigspin-cell" key={ci}>
                              <SlotSymbol id={sym} />
                            </div>
                          ))}
                        </div>
                        <div
                          className="bigspin-strip land"
                          ref={(el) => {
                            landRefs.current[idx] = el
                          }}
                        >
                          {plan.land.map((sym, ci) => (
                            <div className="bigspin-cell" key={ci}>
                              <SlotSymbol id={sym} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {revealed && item.result !== 'nothing' && <Badge tier={item.result} className="badge bigspin-badge" />}
              </div>
            )
          })}
        </div>

        <div className="bigspin-summary">
          {done ? (
            <>
              <p>
                {golds} gold · {silvers} silver · {nothing} nothing
              </p>
              <button className="spend" onClick={onDone}>
                Continue
              </button>
            </>
          ) : (
            <button className="link" onClick={skip}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
