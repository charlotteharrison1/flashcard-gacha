// Coins seen edge-on, stacked like poker chips. B = outline, G = gold, H = highlight (twinkles), D = shadow.
// A coin is 3 rows tall; each one's top outline row doubles as the gap above the coin below it.
const COIN_ROWS = ['BBBBBBBB', 'BGHGGGGB', 'BDDDDDDB']
const TOP_COIN_ROWS = ['.BBBBBB.', 'BHHGGGGB', 'BDDDDDDB'] // rounded top edge so the stack reads as discs
const COLOR: Record<string, string> = { B: '#0a1218', G: '#ffc233', H: '#fff3b8', D: '#b98410' }
const PX = 5 // one sprite pixel, in SVG units
const COIN_W = 8 * PX // 40
const COIN_H = 3 * PX // 15

// A row of stacks, filled one at a time left to right. 5 stacks of up to 7 coins = 35 coins max.
const STACKS = 5
const STACK_CAP = 7
const CAP = STACKS * STACK_CAP
const STACK_GAP = 12
const START_X = 6
const BASE_Y = 118 // top of each stack's bottom outline row

function coinCount(balance: number | null) {
  if (!balance || balance <= 0) return 0
  return Math.min(CAP, 1 + Math.floor(Math.sqrt(balance) * 1.4))
}

type Placed = { x: number; y: number; top: boolean }

/** Coins in the order they were "added": stack 0 bottom to top, then stack 1, and so on. */
function layout(count: number): Placed[] {
  const coins: Placed[] = []
  for (let s = 0; s < STACKS; s++) {
    const n = Math.min(STACK_CAP, count - s * STACK_CAP)
    if (n <= 0) break
    for (let k = 0; k < n; k++) {
      const t = (s + k) % 7
      const wobble = t === 2 ? PX : t === 5 ? -PX : 0 // an occasional one-pixel nudge so stacks look hand-placed
      coins.push({
        x: START_X + s * (COIN_W + STACK_GAP) + (k === 0 ? 0 : wobble),
        y: BASE_Y - (k + 1) * COIN_H,
        top: k === n - 1,
      })
    }
  }
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
  { x: 30, y: 60, delay: 0 },
  { x: 90, y: 38, delay: 0.15 },
  { x: 150, y: 70, delay: 0.3 },
  { x: 205, y: 44, delay: 0.1 },
  { x: 240, y: 80, delay: 0.25 },
  { x: 120, y: 100, delay: 0.05 },
]

/** A tiny 4-point sparkle, hidden until the pile is hovered (see .coin-pile:hover .sparkle in CSS). */
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const s = 6
  const d = `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`
  return <path className="sparkle" style={{ animationDelay: `${delay}s` }} d={d} fill="#fff3b8" />
}

export default function CoinPile({ balance }: { balance: number | null }) {
  const coins = layout(coinCount(balance))
  const stacksUsed = Math.ceil(coins.length / STACK_CAP)

  return (
    <svg className="coin-pile" viewBox="0 0 260 135" role="img" aria-label={`${balance ?? 0} earnings`}>
      {coins.length === 0 ? (
        // Nothing earned yet: one grey, empty stack in the middle
        <g className="coin-pile-empty" shapeRendering="crispEdges" transform={`translate(${START_X + 2 * (COIN_W + STACK_GAP)} ${BASE_Y - COIN_H})`}>
          {pixels(TOP_COIN_ROWS, () => '#5f7488').base.map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width={PX} height={PX} fill={p.color} />
          ))}
          <rect x={0} y={COIN_H} width={COIN_W} height={PX} fill="#5f7488" />
        </g>
      ) : (
        <>
          {Array.from({ length: stacksUsed }, (_, s) => (
            <StackBase key={s} x={START_X + s * (COIN_W + STACK_GAP)} />
          ))}
          {coins.map((c, i) => (
            // Outer <g> positions the coin (an SVG attribute, untouched by CSS); the inner <g>
            // carries the pop-in animation so the two don't fight over `transform`.
            <g key={i} transform={`translate(${c.x} ${c.y})`}>
              <g className={i === coins.length - 1 ? 'coin coin-new' : 'coin'}>
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
