import { STAR_POINTS } from '../lib/slots'

const COLORS = {
  gold: { main: '#ffc233', dark: '#b98410', light: '#fff3b8' },
  silver: { main: '#cfd8e3', dark: '#7d8a9a', light: '#ffffff' },
}

export default function Badge({ tier, className = 'badge' }: { tier: 'gold' | 'silver'; className?: string }) {
  const c = COLORS[tier]
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={`${tier} badge`} strokeLinejoin="round" strokeLinecap="round">
      <circle cx="32" cy="32" r="28" fill={c.dark} stroke="#0a1218" strokeWidth="4" />
      <circle cx="32" cy="30" r="23" fill={c.main} stroke="#0a1218" strokeWidth="3" />
      <path d="M14 26 A19 19 0 0 1 28 12" fill="none" stroke="#fff" strokeWidth="4" opacity="0.6" />
      <g transform="translate(32 30) scale(0.55) translate(-32 -32)">
        <polygon points={STAR_POINTS} fill={c.light} stroke="#0a1218" strokeWidth="5" />
      </g>
    </svg>
  )
}
