import { SPRITES } from '../lib/sprites'

/** The gold / silver prize medal: a pixel-art sprite (see medalRows in lib/sprites.ts). */
export default function Badge({ tier, className = 'badge' }: { tier: 'gold' | 'silver'; className?: string }) {
  const { size, paths } = SPRITES[tier === 'gold' ? 'goldBadge' : 'silverBadge']
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={`${tier} badge`} shapeRendering="crispEdges">
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  )
}
