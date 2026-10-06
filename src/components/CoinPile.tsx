// Coins seen edge-on, stacked like poker chips. B = outline, G = gold, H = highlight (twinkles), D = shadow.
// A coin is 3 rows tall; each one's top outline row doubles as the gap above the coin below it.
const COIN_ROWS = ['BBBBBBBB', 'BGHGGGGB', 'BDDDDDDB']
const TOP_COIN_ROWS = ['.BBBBBB.', 'BHHGGGGB', 'BDDDDDDB'] // rounded top edge so the stack reads as discs
const COLOR: Record<string, string> = { B: '#0a1218', G: '#ffc233', H: '#fff3b8', D: '#b98410' }
const PX = 5 // one sprite pixel, in SVG units
const COIN_W = 8 * PX // 40
const COIN_H = 3 * PX // 15

// A row of stacks of different heights, like coins stacked by hand. A small pile is one tall stack:
// coins fill the middle stack first, then the one to its right, then left, and so on outward.
const STACK_CAPS = [4, 5, 5, 4, 3] // max height of each stack, left to right
const FILL_ORDER = [2, 3, 1, 4, 0]
const STACKS = STACK_CAPS.length
const CAP = STACK_CAPS.reduce((a, b) => a + b, 0)
const STACK_GAP = 3 // stacks nearly touch
const MARGIN = 10
const VIEW_W = STACKS * COIN_W + (STACKS - 1) * STACK_GAP + MARGIN * 2
const START_X = MARGIN
// Cropped to fit stacks up to 5 coins tall; the SVG has overflow: visible, so taller ones just rise past the top edge.
const VIEW_TOP = 36
const VIEW_H = 106
const BASE_Y = 118 // top of each stack's bottom outline row

/** One coin per earning at first (1 earning = 1 coin), then the pile grows more slowly so it stops around 95 earnings. */
function coinCount(balance: number | null) {
  if (!balance || balance <= 0) return 0
  if (balance <= 6) return balance
  return Math.min(CAP, 6 + Math.floor(Math.sqrt(balance - 6) * 1.6))
}

/** Below this many earnings the pile is "poor": no sparkles, just a fly that shows up when you hover it. */
const POOR_BELOW = 10

const stackX = (s: number) => START_X + s * (COIN_W + STACK_GAP)

type Placed = { key: string; x: number; y: number; top: boolean; isNew: boolean }

/** Coins in the order they were "added": each stack filled bottom to top before the next one starts. */
function layout(count: number): Placed[] {
  const coins: Placed[] = []
  let left = count
  for (const s of FILL_ORDER) {
    const n = Math.min(left, STACK_CAPS[s])
    left -= n
    for (let k = 0; k < n; k++) {
      const t = (s + k) % 7
      const wobble = t === 2 ? PX : t === 5 ? -PX : 0 // an occasional one-pixel nudge
      coins.push({
        key: `${s}-${k}`,
        x: stackX(s) + (k === 0 ? 0 : wobble),
        y: BASE_Y - (k + 1) * COIN_H,
        top: k === n - 1,
        isNew: false,
      })
    }
  }
  if (coins.length > 0) coins[coins.length - 1].isNew = true // the coin that just landed
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

// Scattered around the stacks; fixed, so they don't shift as the pile grows or shrinks.
const SPARKLES = [
  { x: 28, y: 76, delay: 0 },
  { x: 108, y: 44, delay: 0.9 },
  { x: 196, y: 70, delay: 1.7 },
  { x: 62, y: 104, delay: 1.3 },
  { x: 214, y: 102, delay: 0.4 },
]

/** A pixel plus-sign sparkle that blinks on and off in whole steps (see .sparkle in CSS). */
function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const u = PX
  return (
    <g className="sparkle" style={{ animationDelay: `${delay}s` }} shapeRendering="crispEdges">
      {[
        [0, -u],
        [-u, 0],
        [u, 0],
        [0, u],
      ].map(([dx, dy], i) => (
        <rect key={i} x={x + dx - u / 2} y={y + dy - u / 2} width={u} height={u} fill="#fff3b8" />
      ))}
      <rect x={x - u / 2} y={y - u / 2} width={u} height={u} fill="#ffffff" />
    </g>
  )
}

/** A pixel fly that buzzes out of a small pile when it's hovered (see .fly in CSS). Only shown below POOR_BELOW earnings. */
function Fly() {
  const u = 6
  return (
    <g transform={`translate(${VIEW_W / 2} ${BASE_Y - 45})`}>
      <g className="fly" shapeRendering="crispEdges">
        <rect x={0} y={u} width={3 * u} height={2 * u} fill="#9aa8b6" />
        <rect x={0} y={2 * u} width={3 * u} height={u} fill="#4b5668" />
        <rect x={2 * u} y={u} width={u} height={u} fill="#ff4d40" />
        <g className="wing wing-up">
          <rect x={0} y={-u} width={2 * u} height={2 * u} fill="#ffffff" />
        </g>
        <g className="wing wing-down">
          <rect x={0} y={3 * u} width={2 * u} height={u} fill="#ffffff" />
        </g>
      </g>
    </g>
  )
}

/** A little pixel shelf the stacks sit on, with studs along it. */
function Shelf() {
  const w = VIEW_W - 6
  const studs = Array.from({ length: Math.floor(w / 24) }, (_, i) => 12 + i * 24)
  return (
    <g shapeRendering="crispEdges">
      <rect x={3} y={BASE_Y + PX} width={w} height={PX} fill="#b98410" />
      <rect x={3} y={BASE_Y + PX * 2} width={w} height={PX} fill="#0a1218" />
      {studs.map((x) => (
        <rect key={x} x={x} y={BASE_Y + PX} width={PX} height={PX} fill="#fff3b8" />
      ))}
    </g>
  )
}

export default function CoinPile({ balance }: { balance: number | null }) {
  const coins = layout(coinCount(balance))
  const poor = !balance || balance < POOR_BELOW
  const usedStacks = STACK_CAPS.map((_, s) => s).filter((s) => coins.some((c) => c.key.startsWith(`${s}-`)))

  return (
    <svg className="coin-pile" viewBox={`0 ${VIEW_TOP} ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`${balance ?? 0} earnings`}>
      {coins.length === 0 ? (
        // Nothing earned yet: a note where the pile would be (the fly below still buzzes out on hover)
        <foreignObject x={12} y={VIEW_TOP + 4} width={VIEW_W - 24} height={BASE_Y - VIEW_TOP - 10}>
          <div className="pile-empty-text">No earnings yet. Study to get coins!</div>
        </foreignObject>
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
      <Shelf />
      {poor ? <Fly /> : SPARKLES.map((s, i) => <Sparkle key={i} x={s.x} y={s.y} delay={s.delay} />)}
    </svg>
  )
}
