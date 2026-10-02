import CoinPile from './CoinPile'
import { SlotSymbol } from './SlotSymbol'

export default function Earnings({ balance, compact = false }: { balance: number | null; compact?: boolean }) {
  return (
    <div className={`earnings-box${compact ? ' compact' : ''}`}>
      <CoinPile balance={balance} />
      <div className="earn-text">
        {balance !== null && balance <= 0 ? (
          <span className="earn-empty">No earnings yet. Study to get coins!</span>
        ) : (
          <>
            <span className="earn-label">
              <SlotSymbol id="star" />
              Earnings
              <SlotSymbol id="star" />
            </span>
            <span className="earn-value">{balance ?? '–'}</span>
          </>
        )}
      </div>
    </div>
  )
}
