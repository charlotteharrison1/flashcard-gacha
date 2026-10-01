import { useEffect, useMemo, useRef, useState } from 'react'
import { randomFill, type Result, type SymbolId } from '../lib/slots'
import { SlotSymbol } from './SlotSymbol'
import Badge from './Badge'

export type BigSpinItem = { id: number; final: SymbolId[]; result: Result }

const CELLS = 7 // symbols in each mini reel's strip; the last one is the target
const DURATION = 1700

/** Full-screen reveal for a 10-coin batch: every pull's 3 reels spin at the same time. */
export default function BigSpinOverlay({ items, onDone }: { items: BigSpinItem[]; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  // One strip per reel, 3 reels per pull, flattened so refs can be indexed directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` is fixed for this overlay's lifetime
  const strips = useMemo(() => items.flatMap((item) => item.final.map((target) => [...randomFill(CELLS - 1), target])), [])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const end = `translateY(-${((CELLS - 1) / CELLS) * 100}%)`

    // Every strip starts at 0%; setting the end position next frame is what makes it transition.
    const frame = requestAnimationFrame(() => {
      stripRefs.current.forEach((el) => {
        if (!el) return
        if (reduceMotion) el.style.transition = 'none'
        el.style.transform = end
      })
    })
    const timer = window.setTimeout(() => setRevealed(true), reduceMotion ? 0 : DURATION + 150)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])

  const golds = items.filter((i) => i.result === 'gold').length
  const silvers = items.filter((i) => i.result === 'silver').length
  const nothing = items.length - golds - silvers

  return (
    <div className="bigspin-backdrop" role="dialog" aria-modal="true" aria-label="Ten-pull results">
      <div className="bigspin">
        <div className="bigspin-title">10 coins in — everybody spins!</div>
        <div className="bigspin-grid">
          {items.map((item, gi) => (
            <div className={`bigspin-item${revealed && item.result !== 'nothing' ? ` win ${item.result}` : ''}`} key={item.id}>
              <div className="bigspin-reels">
                {item.final.map((_, ri) => {
                  const idx = gi * 3 + ri
                  return (
                    <div className="bigspin-reel" key={ri}>
                      <div
                        className="bigspin-strip"
                        ref={(el) => {
                          stripRefs.current[idx] = el
                        }}
                      >
                        {strips[idx].map((sym, ci) => (
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
          ))}
        </div>

        {revealed && (
          <div className="bigspin-summary">
            <p>
              {golds} gold · {silvers} silver · {nothing} nothing
            </p>
            <button className="spend" onClick={onDone}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
