import { Link } from 'react-router-dom'
import { PULL_COST } from '../lib/earnings'

// 22-point starburst, computed once.
const SPIKES = 22
const BURST = Array.from({ length: SPIKES * 2 }, (_, i) => {
  const angle = (Math.PI * i) / SPIKES - Math.PI / 2
  const r = i % 2 ? 82 : 98
  return `${(100 + r * Math.cos(angle)).toFixed(1)},${(100 + r * Math.sin(angle)).toFixed(1)}`
}).join(' ')

/** Big "ON SALE" sticker with a bobbing gold SPEND button in the middle. The whole sticker links to the pull screen. */
export default function SaleSticker() {
  return (
    <Link to="/pull" className="sale" aria-label="Spend coins on pulls">
      <svg className="sale-burst" viewBox="0 0 200 200" aria-hidden="true" strokeLinejoin="round">
        <defs>
          <radialGradient id="sale-grad" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ff8a5c" />
            <stop offset="55%" stopColor="#ff4d40" />
            <stop offset="100%" stopColor="#b3231a" />
          </radialGradient>
        </defs>
        <polygon points={BURST} fill="url(#sale-grad)" stroke="#0a1218" strokeWidth="5" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="#ffe27a" strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />
      </svg>
      <span className="sale-shine" aria-hidden="true" />
      <span className="sale-tag">On sale</span>
      <span className="button spend sale-btn">Spend</span>
      <span className="sale-cost">
        {PULL_COST} coin{PULL_COST === 1 ? '' : 's'} per pull
      </span>
    </Link>
  )
}
