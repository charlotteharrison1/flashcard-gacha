import { Link } from 'react-router-dom'
import CoinPile from './CoinPile'
import { SlotSymbol } from './SlotSymbol'

export default function Earnings({ balance, compact = false, pull = false }: { balance: number | null; compact?: boolean; pull?: boolean }) {
  const empty = balance !== null && balance <= 0
  return (
    <div className="earnings-col">
      <div className={`earnings-box${compact ? ' compact' : ''}`}>
        <CoinPile balance={balance} />
        {!empty && (
          <div className="earn-text">
            <span className="earn-label">
              <SlotSymbol id="star" />
              Earnings
              <SlotSymbol id="star" />
            </span>
            <span className="earn-value">{balance ?? '–'}</span>
          </div>
        )}
      </div>
      {pull && (
        <Link to="/pull" className="button spend library-btn">
          <span>Pull now</span>
          <span className="library-arrow">
            <SlotSymbol id="arrow" />
          </span>
        </Link>
      )}
    </div>
  )
}
