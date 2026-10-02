import CoinPile from './CoinPile'

export default function Earnings({ balance, compact = false }: { balance: number | null; compact?: boolean }) {
  return (
    <div className={`earnings-box${compact ? ' compact' : ''}`}>
      <CoinPile balance={balance} />
      <div className="earn-text">
        {balance !== null && balance <= 0 ? (
          <span className="earn-empty">No earnings yet. Study to get coins!</span>
        ) : (
          <>
            <span className="earn-label">Earnings</span>
            <span className="earn-value">{balance ?? '–'}</span>
          </>
        )}
      </div>
    </div>
  )
}
