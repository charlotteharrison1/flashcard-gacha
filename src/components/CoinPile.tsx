const LINE = '#0a1218'

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

export default function CoinPile({ balance }: { balance: number | null }) {
  const coins = layout(coinCount(balance))

  return (
    <svg className="coin-pile" viewBox="0 0 260 135" role="img" aria-label={`${balance ?? 0} earnings`}>
      {coins.length === 0 && (
        <ellipse cx={CENTER_X} cy={BASE_Y} rx="20" ry="11" fill="none" stroke="#5f7488" strokeWidth="3" strokeDasharray="6 5" />
      )}
      {coins.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`} strokeLinejoin="round">
          <path d="M-20 0 v6 a20 11 0 0 0 40 0 v-6 z" fill="#b98410" stroke={LINE} strokeWidth="3" />
          <ellipse rx="20" ry="11" fill="#ffc233" stroke={LINE} strokeWidth="3" />
          <ellipse rx="13" ry="6.5" fill="none" stroke="#b98410" strokeWidth="2" />
          <path d="M-14 -3 Q-8 -8 0 -8" fill="none" stroke="#fff3b8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}
