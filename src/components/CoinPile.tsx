// Coins seen edge-on, stacked like poker chips. B = outline, G = gold, H = highlight (twinkles), D = shadow.
// A coin is 3 rows tall; each one's top outline row doubles as the gap above the coin below it.
const COIN_ROWS = ['BBBBBBBB', 'BGHGGGGB', 'BDDDDDDB']
const TOP_COIN_ROWS = ['.BBBBBB.', 'BHHGGGGB', 'BDDDDDDB'] // rounded top edge so the stack reads as discs
const COLOR: Record<string, string> = { B: '#0a1218', G: '#ffc233', H: '#fff3b8', D: '#b98410' }
const PX = 5 // one sprite pixel, in SVG units
const COIN_W = 8 * PX // 40
const COIN_H = 3 * PX // 15

// A row of stacks of different heights, tallest in the middle, like coins stacked by hand.
// Each stack's max height is its share of the pile; 4+6+7+5+3 = 25 coins max.
const STACK_CAPS = [4, 6, 7, 5, 3]
const STACKS = STACK_CAPS.length
const CAP = STACK_CAPS.reduce((a, b) => a + b, 0)
const STACK_GAP = 6
const START_X = (260 - (STACKS * COIN_W + (STACKS - 1) * STACK_GAP)) / 2 // centred in the 260-wide viewBox
const BASE_Y = 118 // top of each stack's bottom outline row

function coinCount(balance: number | null) {
  if (!balance || balance <= 0) return 0
  return Math.min(CAP, 1 + Math.floor(Math.sqrt(balance) * 1.4))
}

const stackX = (s: number) => START_X + s * (COIN_W + STACK_GAP)

type Placed = { key: string; x: number; y: number; top: boolean; isNew: boolean }

/**
 * Hands out coins one at a time to whichever stack is furthest below its fair share, so every
 * stack grows together but keeps its own height. Adding a coin never moves an existing one, so the
 * newest coin is always the one that just landed on top.
 */
function layout(count: number): Placed[] {
  const heights = STACK_CAPS.map(() => 0)
  let newest = -1
  for (let n = 1; n <= count; n++) {
    let best = -1
    let bestGap = -Infinity
    STACK_CAPS.forEach((cap, s) => {
      if (heights[s] >= cap) return
      const gap = (n * cap) / CAP - heights[s]
      if (gap > bestGap) {
        bestGap = gap
        best = s
      }
    })
    heights[best]++
    newest = best
  }

  const coins: Placed[] = []
  heights.forEach((h, s) => {
    for (let k = 0; k < h; k++) {
      const t = (s + k) % 7
      const wobble = t === 2 ? PX : t === 5 ? -PX : 0 // an occasional one-pixel nudge
      coins.push({
        key: `${s}-${k}`,
        x: stackX(s) + (k === 0 ? 0 : wobble),
        y: BASE_Y - (k + 1) * COIN_H,
        top: k === h - 1,
        isNew: s === newest && k === h - 1,
      })
    }
  })
  return coins
}

type Px = { x: number; y: number; color: string }

function pixels(rows: string[], colorOf: (ch: string) => string | null): { base: Px[]; shine: Px[] } {
  const base: Px[] = []
  const shine: Px[] = []
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const color = ch === '.' ? null : colorOf(ch)
      if (!color) return
      ;(ch === 'H' ? shine : base).push({ x: c * PX, y: r * PX, color })
    }),
  )
  return { base, shine }
}

/** One edge-on coin, drawn from its top-left corner. The highlight pixels get their own group so only they twinkle. */
function PixelCoin({ top, delay }: { top: boolean; delay: number }) {
  const { base, shine } = pixels(top ? TOP_COIN_ROWS : COIN_ROWS, (ch) => COLOR[ch])
  return (
    <>
      <g shapeRendering="crispEdges">
        {base.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill={p.color} />
        ))}
      </g>
      <g className="coin-shine" shapeRendering="crispEdges" style={{ animationDelay: `${delay}s` }}>
        {shine.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill={COLOR.H} />
        ))}
      </g>
    </>
  )
}

/** The closing outline under a stack. */
function StackBase({ x }: { x: number }) {
  return (
    <rect x={x} y={BASE_Y} width={COIN_W} height={PX} fill={COLOR.B} shapeRendering="crispEdges" />
  )
}

// Scattered across the stacks' usual footprint — fixed, so they don't shift as the stacks grow.
const SPARKLES = [
  { x: 40, y: 78, delay: 0 },
  { x: 92, y: 50, delay: 0.15 },
  { x: 132, y: 28, delay: 0.3 },
  { x: 178, y: 60, delay: 0.1 },
  { x: 222, y: 88, delay: 0.25 },
  { x: 112, y: 96, delay: 0.05 },
]

/** A tiny 4-point sparkle, hidden until the pile is hovered (see .coin-pile:hover .sparkle in CSS). */
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const s = 6
  const d = `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`
  return <path className="sparkle" style={{ animationDelay: `${delay}s` }} d={d} fill="#fff3b8" />
}

export default function CoinPile({ balance }: { balance: number | null }) {
  const coins = layout(coinCount(balance))
  const usedStacks = STACK_CAPS.map((_, s) => s).filter((s) => coins.some((c) => c.key.startsWith(`${s}-`)))

  return (
    <svg className="coin-pile" viewBox="0 0 260 135" role="img" aria-label={`${balance ?? 0} earnings`}>
      {coins.length === 0 ? (
        // Nothing earned yet: one grey, empty stack in the middle
        <g className="coin-pile-empty" shapeRendering="crispEdges" transform={`translate(${stackX(2)} ${BASE_Y - COIN_H})`}>
          {pixels(TOP_COIN_ROWS, () => '#5f7488').base.map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill={p.color} />
          ))}
          <rect x={0} y={COIN_H} width={COIN_W} height={PX} fill="#5f7488" />
        </g>
      ) : (
        <>
          {usedStacks.map((s) => (
            <StackBase key={s} x={stackX(s)} />
          ))}
          {coins.map((c, i) => (
            // Outer <g> positions the coin (an SVG attribute, untouched by CSS); the inner <g>
            // carries the pop-in animation so the two don't fight over `transform`.
            <g key={c.key} transform={`translate(${c.x} ${c.y})`}>
              <g className={c.isNew ? 'coin coin-new' : 'coin'}>
                <PixelCoin top={c.top} delay={(i * 0.21) % 2.8} />
              </g>
            </g>
          ))}
        </>
      )}
      {coins.length > 0 && SPARKLES.map((s, i) => <Sparkle key={i} x={s.x} y={s.y} delay={s.delay} />)}
    </svg>
  )
}
