import { STAR_POINTS, type SymbolId } from '../lib/slots'

const LINE = '#0a1218'

export function SlotSymbol({ id }: { id: SymbolId }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" strokeLinejoin="round" strokeLinecap="round">
      {id === 'star' && (
        <>
          <polygon points={STAR_POINTS} fill="#ffc233" stroke={LINE} strokeWidth="4" />
          <polyline points="32,14 36,24 46,25" fill="none" stroke="#fff3b8" strokeWidth="3" />
        </>
      )}
      {id === 'cherry' && (
        <>
          <path d="M22 34 Q26 16 38 8" fill="none" stroke="#3b6b2a" strokeWidth="4" />
          <path d="M44 36 Q44 18 38 8" fill="none" stroke="#3b6b2a" strokeWidth="4" />
          <ellipse cx="46" cy="10" rx="9" ry="5" fill="#3ed598" stroke={LINE} strokeWidth="3" transform="rotate(-20 46 10)" />
          <circle cx="21" cy="45" r="12" fill="#ff4d40" stroke={LINE} strokeWidth="4" />
          <circle cx="44" cy="47" r="11" fill="#ff4d40" stroke={LINE} strokeWidth="4" />
          <circle cx="17" cy="41" r="3" fill="#ffd0cc" />
          <circle cx="40" cy="43" r="3" fill="#ffd0cc" />
        </>
      )}
      {id === 'seven' && (
        <text
          x="32"
          y="52"
          textAnchor="middle"
          fontSize="58"
          fontWeight="700"
          fontFamily="'Pixelify Sans', monospace"
          fill="#ff4d40"
          stroke={LINE}
          strokeWidth="5"
          paintOrder="stroke"
        >
          7
        </text>
      )}
      {id === 'bar' && (
        <>
          <rect x="5" y="18" width="54" height="28" rx="4" fill="#1e9bff" stroke={LINE} strokeWidth="4" />
          <text
            x="32"
            y="40"
            textAnchor="middle"
            fontSize="20"
            fontWeight="700"
            fontFamily="'Pixelify Sans', monospace"
            fill="#fff"
            letterSpacing="2"
          >
            BAR
          </text>
        </>
      )}
      {id === 'diamond' && (
        <>
          <polygon points="32,6 56,26 32,58 8,26" fill="#4dd8ff" stroke={LINE} strokeWidth="4" />
          <polyline points="8,26 56,26 M20,26 32,58 44,26 32,6 20,26" fill="none" stroke="#e8fbff" strokeWidth="2.5" />
        </>
      )}
      {id === 'bell' && (
        <>
          <path d="M14 46 Q14 14 32 12 Q50 14 50 46 Z" fill="#ff9430" stroke={LINE} strokeWidth="4" />
          <rect x="10" y="44" width="44" height="7" rx="3" fill="#ff9430" stroke={LINE} strokeWidth="4" />
          <circle cx="32" cy="56" r="4" fill="#ff9430" stroke={LINE} strokeWidth="3" />
          <path d="M22 22 Q24 18 28 17" fill="none" stroke="#ffe0b8" strokeWidth="3" />
        </>
      )}
    </svg>
  )
}
