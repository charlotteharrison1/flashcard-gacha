/** The bet entry shared by the games: a number box plus quick amounts. The only limit is your balance. */
export default function BetBox({ balance, bet, setBet, disabled = false }: { balance: number | null; bet: number; setBet: (n: number) => void; disabled?: boolean }) {
  const have = balance ?? 0
  const clamp = (n: number) => Math.max(1, Math.min(Math.floor(n) || 1, Math.max(have, 1)))
  return (
    <div className="cg-bet">
      <label className="cg-bet-label">
        Bet
        <input type="number" min={1} max={have} value={bet} disabled={disabled} onChange={(e) => setBet(clamp(Number(e.target.value)))} aria-label="Bet in coins" />
      </label>
      <div className="cg-chips">
        {[5, 10, 25, 100].map((n) => (
          <button key={n} type="button" className="cg-chip" disabled={disabled || have < n} onClick={() => setBet(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="cg-chip" disabled={disabled || have < 2} onClick={() => setBet(clamp(have / 2))}>
          ½
        </button>
        <button type="button" className="cg-chip" disabled={disabled || have < 1} onClick={() => setBet(have)}>
          Max
        </button>
      </div>
    </div>
  )
}
