import { Link } from 'react-router-dom'
import CoinPile from './CoinPile'
import { SlotSymbol } from './SlotSymbol'

export default function Earnings({ balance, compact = false, library = false }: { balance: number | null; compact?: boolean; library?: boolean }) {
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
      {library && (
        <Link to="/library" className="button spend library-btn">
          Enter the library
        </Link>
      )}
    </div>
  )
}
