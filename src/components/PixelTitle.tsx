import { TITLE_ROWS } from '../lib/titleSprite'

const OUTLINE = '#0a1218'
const HIGHLIGHT = '#fff3b8'
const GOLD = '#ffc233'
const SHADE = '#e0a020'
const DARK = '#b98410'
const AMBER = '#e8a020'

type Cell = { x: number; y: number; color: string }

/** One SVG path per colour, one 1x1 square per pixel, so the DOM stays tiny. */
function toPaths(cells: Cell[]) {
  const byColor = new Map<string, string>()
  for (const c of cells) byColor.set(c.color, (byColor.get(c.color) ?? '') + `M${c.x} ${c.y}h1v1h-1z`)
  return [...byColor].map(([color, d]) => <path key={color} d={d} fill={color} />)
}

const PAD = 2 // room for the outline and a little air around it
const rows = TITLE_ROWS
const H = rows.length
const W = rows[0].length
const filled = new Set<string>()
rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && filled.add(`${x},${y}`)))
const has = (x: number, y: number) => filled.has(`${x},${y}`)

const TITLE_CELLS: Cell[] = (() => {
  const cells: Cell[] = []
  const outline = new Set<string>()
  filled.forEach((key) => {
    const [x, y] = key.split(',').map(Number)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!has(x + dx, y + dy)) outline.add(`${x + dx},${y + dy}`)
  })
  outline.forEach((key) => {
    const [x, y] = key.split(',').map(Number)
    cells.push({ x: x + PAD, y: y + PAD, color: OUTLINE })
  })
  // Light on the top pixel of every vertical stroke, shade on the bottom two.
  filled.forEach((key) => {
    const [x, y] = key.split(',').map(Number)
    const top = !has(x, y - 1)
    const bottom = !has(x, y + 1)
    const second = has(x, y + 1) && !has(x, y + 2)
    const color = top ? HIGHLIGHT : bottom ? DARK : second ? SHADE : GOLD
    cells.push({ x: x + PAD, y: y + PAD, color })
  })
  return cells
})()

export const TITLE_WIDTH = W + 2 * PAD
export const TITLE_HEIGHT = H + 2 * PAD

/** The "TYCHE" logo: uncial lettering in pixel art, drawn at `scale` screen pixels per art pixel. */
export default function PixelTitle({ scale = 1 }: { scale?: number }) {
  return (
    <svg
      viewBox={`0 0 ${TITLE_WIDTH} ${TITLE_HEIGHT}`}
      width={TITLE_WIDTH * scale}
      height={TITLE_HEIGHT * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Tyche"
    >
      {toPaths(TITLE_CELLS)}
    </svg>
  )
}

const PLAIT_H = 11
const PLAIT_CELLS: Cell[] = (() => {
  const cells: Cell[] = []
  const put = (x: number, y: number, color: string) => cells.push({ x, y, color })
  const period = 16 // two strands that cross every 8 pixels
  for (let x = 0; x < TITLE_WIDTH; x++) {
    const s = Math.sin((x * 2 * Math.PI) / period)
    const a = Math.round(5 + 3 * s) // strand A's centre row
    const b = Math.round(5 - 3 * s) // strand B's centre row
    const aOver = Math.floor(x / (period / 2)) % 2 === 0 // they swap who is on top at each crossing
    const [under, over] = aOver ? [b, a] : [a, b]
    const colour = (isA: boolean) => (isA ? GOLD : AMBER)
    const underColor = colour(!aOver)
    const overColor = colour(aOver)
    for (let dy = -2; dy <= 2; dy++) put(x, under + dy, OUTLINE)
    for (let dy = -1; dy <= 1; dy++) put(x, under + dy, dy === 1 ? DARK : underColor)
    for (let dy = -2; dy <= 2; dy++) put(x, over + dy, OUTLINE)
    for (let dy = -1; dy <= 1; dy++) put(x, over + dy, dy === -1 ? HIGHLIGHT : dy === 1 ? SHADE : overColor)
  }
  return cells
})()

/** A pixel plait (two interlaced strands), the same width as the title: a Celtic touch for under the logo. */
export function Plait({ scale = 1 }: { scale?: number }) {
  return (
    <svg
      viewBox={`0 0 ${TITLE_WIDTH} ${PLAIT_H + 1}`}
      width={TITLE_WIDTH * scale}
      height={(PLAIT_H + 1) * scale}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {toPaths(PLAIT_CELLS)}
    </svg>
  )
}
