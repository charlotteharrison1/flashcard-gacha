import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { SlotSymbol } from './SlotSymbol'
import { motionReduced } from '../lib/anim'
import type { SlotPhase } from './SlotMachine'

// --- Lever (degrees; 0 = pointing right, positive = swinging down) -----------
const LEVER_REST = -55
const LEVER_END = 50
const LEVER_PULL_AT = 32 // drag past this and the pull fires
const STEP = 5 // the arm only redraws every STEP degrees, so it moves in chunky pixel jumps
// -----------------------------------------------------------------------------

// The whole lever is one grid of pixels, W x H units (a unit is --px on screen). The pivot sits on the
// gold bracket; the arm is rasterised as a pixel line, so it never anti-aliases or rotates smoothly.
const W = 28
const H = 44
const PIVOT = { x: 4, y: 22 }
const ARM = 17 // length of the arm, in units
const BALL = 8 // the knob sprite is 8x8 units

const OUTLINE = '#0a1218'
const SHADOW = '#00000040'
const GOLD = '#ffc233'
const GOLD_D = '#b98410'
const GOLD_L = '#fff3b8'
const STEEL = '#b9c4d0'

type Raster = { paths: { color: string; d: string }[]; ex: number; ey: number }

const ease = {
  out: (t: number) => 1 - (1 - t) * (1 - t),
  spring: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2, // overshoots, then settles
}

/** Whole pixels along a line (Bresenham). */
function line(x0: number, y0: number, x1: number, y1: number) {
  const pts: [number, number][] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    pts.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return pts
}

const cache = new Map<number, Raster>()

function raster(angle: number): Raster {
  const hit = cache.get(angle)
  if (hit) return hit

  const grid = new Map<number, string>()
  const put = (x: number, y: number, color: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) grid.set(y * W + x, color)
  }

  // Bracket: a gold plate bolted to the cabinet, with two rivets.
  for (let y = 15; y <= 29; y++) {
    for (let x = 1; x <= 7; x++) {
      const edge = x === 1 || x === 7 || y === 15 || y === 29
      put(x, y, edge ? OUTLINE : x >= 5 ? GOLD_D : GOLD)
    }
  }
  put(4, 17, OUTLINE)
  put(4, 27, OUTLINE)

  // Arm: a pixel line, drawn as shadow, outline, body, then a highlight edge and a shade edge.
  const rad = (angle * Math.PI) / 180
  const ex = Math.round(PIVOT.x + ARM * Math.cos(rad))
  const ey = Math.round(PIVOT.y + ARM * Math.sin(rad))
  const pts = line(PIVOT.x, PIVOT.y, ex, ey)
  const brush = (r: number, color: string, ox = 0, oy = 0) => {
    for (const [px, py] of pts) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) put(px + dx + ox, py + dy + oy, color)
  }
  brush(1, SHADOW, 2, 2)
  brush(1, OUTLINE)
  brush(0, STEEL)

  // Hub cap over the pivot: a small pixel disc.
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const d2 = dx * dx + dy * dy
      if (d2 <= 5) put(PIVOT.x + dx, PIVOT.y + dy, dx === -1 && dy === -1 ? GOLD_L : dx + dy >= 2 ? GOLD_D : GOLD)
      else if (d2 <= 10) put(PIVOT.x + dx, PIVOT.y + dy, OUTLINE)
    }
  }

  // One SVG path per colour keeps the DOM tiny.
  const byColor = new Map<string, string>()
  grid.forEach((color, i) => {
    byColor.set(color, (byColor.get(color) ?? '') + `M${i % W} ${Math.floor(i / W)}h1v1h-1z`)
  })
  const result: Raster = { paths: [...byColor].map(([color, d]) => ({ color, d })), ex, ey }
  cache.set(angle, result)
  return result
}

type Props = {
  armed: boolean
  phase?: SlotPhase
  /** The pull fires. */
  onPull: () => void
}

/** The pull lever: drag the knob down around the pivot (or press Enter/Space/Down) to fire a loaded pull. */
export default function Lever({ armed, onPull }: Props) {
  const [shown, setShown] = useState(LEVER_REST) // the angle currently drawn, in whole STEPs
  const exact = useRef(LEVER_REST)
  const frame = useRef(0)
  const pivotRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, pulled: false, past: false }) // `past`: dragged far enough that letting go fires the pull
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((t) => window.clearTimeout(t))
      cancelAnimationFrame(frame.current)
    }
  }, [])

  function show(deg: number) {
    exact.current = deg
    setShown(Math.round(deg / STEP) * STEP) // setting the same value again is a no-op
  }

  /** Move to `target`, optionally tweening over `ms`. */
  function move(target: number, ms = 0, curve: (t: number) => number = (t) => t) {
    cancelAnimationFrame(frame.current)
    if (!ms || motionReduced()) return show(target)
    const from = exact.current
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      show(from + (target - from) * curve(t))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  const snapBack = () => move(LEVER_REST, 500, ease.spring)
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  function pull() {
    drag.current.pulled = true
    move(LEVER_END, 120, ease.out)
    onPull()
    later(snapBack, 260)
  }

  function denied() {
    // The lever won't go down without a coin; that resistance is the only feedback.
    move(LEVER_REST + 14, 90, ease.out) // a dead "clunk"
    later(snapBack, 140)
  }

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (!armed) return denied()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { active: true, pulled: false, past: false }
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !pivotRef.current) return
    const p = pivotRef.current.getBoundingClientRect()
    const angle = (Math.atan2(e.clientY - (p.top + p.height / 2), e.clientX - (p.left + p.width / 2)) * 180) / Math.PI
    // Pointer wandered back over the cabinet: treat the lever as let go.
    const clamped = Math.abs(angle) > 100 ? LEVER_REST : Math.max(LEVER_REST, Math.min(LEVER_END, angle))
    move(clamped)
    // The pull only fires when the lever is let go; drag back up before letting go to cancel it.
    drag.current.past = clamped >= LEVER_PULL_AT
  }

  function onUp() {
    if (!drag.current.active) return
    const fire = drag.current.past
    drag.current.active = false
    if (fire) pull()
    else snapBack()
  }

  /** The pointer was interrupted (not released): never fire. */
  function onCancel() {
    if (!drag.current.active) return
    drag.current.active = false
    snapBack()
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return
    e.preventDefault()
    if (armed) pull()
    else denied()
  }

  const { paths, ex, ey } = raster(shown)

  return (
    <div className={`lever${armed ? ' armed' : ''}`}>
      <svg className="lever-art" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" aria-hidden="true">
        {paths.map((p) => (
          <path key={p.color} d={p.d} fill={p.color} />
        ))}
      </svg>
      <div className="lever-pivot" ref={pivotRef} aria-hidden="true" />
      <div
        className="lever-ball"
        style={{ left: `calc(${ex - BALL / 2} * var(--px))`, top: `calc(${ey - BALL / 2} * var(--px))` }}
        role="button"
        tabIndex={0}
        aria-label="Pull lever"
        aria-disabled={!armed}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onKeyDown={onKey}
      >
        <SlotSymbol id="ball" />
      </div>
    </div>
  )
}
