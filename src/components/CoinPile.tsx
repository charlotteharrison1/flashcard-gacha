// An 8x8 pixel-art coin sprite. B = outline, G = base gold, H = highlight (twinkles), D = shadow pixel.
const COIN_GRID = ['..BBBB..', '.BGGGGB.', 'BGHHGGGB', 'BGHHGGGB', 'BGGGGGGB', 'BGGDGGGB', '.BGGGGB.', '..BBBB..']
const COLOR: Record<string, string> = { B: '#0a1218', G: '#ffc233', H: '#fff3b8', D: '#b98410' }
const PX = 5 // one sprite pixel, in SVG units
const COIN_SIZE = COIN_GRID.length * PX // 40, matches the old coin's ~40-unit diameter

// Pyramid of coins: bottom row first. 28 coins max, so the pile stops growing around 330 earnings.
const ROWS = [7, 6, 5, 4, 3, 2, 1]
const CAP = ROWS.reduce((a, b) => a + b, 0)
const SPACING = 34
const ROW_H = 15
const BASE_Y = 112
const CENTER_X = 130

function coinCount(balance: number | null) {
  if (!balance || balance <= 0) return 0
  return Math.min(CAP, 1 + Math.floor(Math.sqrt(balance) * 1.4))
}

function layout(count: number) {
  const coins: { x: number; y: number }[] = []
  let left = count
  ROWS.forEach((capacity, row) => {
    const n = Math.min(left, capacity)
    left -= n
    for (let j = 0; j < n; j++) {
      const jitter = ((coins.length * 37) % 5) - 2 // fixed wobble so the pile looks hand-stacked
      coins.push({ x: CENTER_X + (j - (n - 1) / 2) * SPACING, y: BASE_Y - row * ROW_H + jitter })
    }
  })
  return coins
}

/** One pixel-art coin, centered on its own origin. The highlight pixels get their own group so only they twinkle. */
function PixelCoin({ delay }: { delay: number }) {
  const base: { x: number; y: number; color: string }[] = []
  const shine: { x: number; y: number }[] = []
  COIN_GRID.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return
      const x = -COIN_SIZE / 2 + c * PX
      const y = -COIN_SIZE / 2 + r * PX
      if (ch === 'H') shine.push({ x, y })
      else base.push({ x, y, color: COLOR[ch] })
    }),
  )
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

export default function CoinPile({ balance }: { balance: number | null }) {
  const coins = layout(coinCount(balance))

  return (
    <svg className="coin-pile" viewBox="0 0 260 135" role="img" aria-label={`${balance ?? 0} earnings`}>
      {coins.length === 0 ? (
        <g className="coin-pile-empty" shapeRendering="crispEdges">
          {[...COIN_GRID.join('')].map((ch, i) =>
            ch === '.' ? null : (
              <rect
                key={i}
                x={CENTER_X - COIN_SIZE / 2 + (i % 8) * PX}
                y={BASE_Y - COIN_SIZE / 2 + Math.floor(i / 8) * PX}
                width={PX}
                height={PX}
                fill="#5f7488"
              />
            ),
          )}
        </g>
      ) : (
        coins.map((c, i) => (
          // Outer <g> positions the coin (an SVG attribute, untouched by CSS); the inner <g>
          // carries the pop-in animation so the two don't fight over `transform`.
          <g key={i} transform={`translate(${c.x} ${c.y})`}>
            <g className={i === coins.length - 1 ? 'coin coin-new' : 'coin'}>
              <PixelCoin delay={(i * 0.21) % 2.8} />
            </g>
          </g>
        ))
      )}
    </svg>
  )
}
