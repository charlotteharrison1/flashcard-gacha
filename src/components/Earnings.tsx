import CoinPile from './CoinPile'

export default function Earnings({ balance, compact = false }: { balance: number | null; compact?: boolean }) {
  return (
    <div className={`earnings-box${compact ? ' compact' : ''}`}>
      <CoinPile balance={balance} />
      <div className="earn-text">
        <span className="earn-label">Earnings</span>
        <span className="earn-value">{balance ?? '–'}</span>
        {!compact && <span className="earn-sub">1–5 per correct card</span>}
      </div>
    </div>
  )
}
