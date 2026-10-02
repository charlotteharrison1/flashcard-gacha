import { Link } from 'react-router-dom'
import { SlotSymbol } from './SlotSymbol'

// 18-point starburst for the little SALE sticker, computed once.
const SPIKES = 18
const BURST = Array.from({ length: SPIKES * 2 }, (_, i) => {
  const angle = (Math.PI * i) / SPIKES - Math.PI / 2
  const r = i % 2 ? 78 : 98
  return `${(100 + r * Math.cos(angle)).toFixed(1)},${(100 + r * Math.sin(angle)).toFixed(1)}`
}).join(' ')

/** The big gold SPEND button (with an arrow) that goes to the pull screen, with two stickers stuck on its corners. */
export default function SpendButton() {
  return (
    <Link to="/pull" className="spend-cta" aria-label="Spend coins on pulls">
      <span className="button spend spend-big">
        <span>Spend</span>
        <span className="spend-arrow" aria-hidden="true">
          <SlotSymbol id="arrow" />
        </span>
      </span>

      <span className="sticker sticker-sale" aria-hidden="true">
        <svg viewBox="0 0 200 200" strokeLinejoin="round">
          <polygon points={BURST} fill="#ff4d40" stroke="#0a1218" strokeWidth="6" />
        </svg>
        <span>Sale</span>
      </span>
      <span className="sticker sticker-pull" aria-hidden="true">
        Pull
        <br />
        Pull
        <br />
        Pull
      </span>
    </Link>
  )
}
