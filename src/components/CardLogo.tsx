import { SPRITES, type SpriteId } from '../lib/sprites'

/**
 * A pixel-art logo for a card back, drawn at a whole number of screen pixels per art pixel so it stays crisp.
 * `target` is roughly how many screen pixels wide it should be; the exact size is the nearest whole multiple.
 */
export default function CardLogo({ id, target = 52 }: { id: SpriteId; target?: number }) {
  const { size, paths } = SPRITES[id]
  const unit = Math.max(2, Math.round(target / size))
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size * unit} height={size * unit} shapeRendering="crispEdges" aria-hidden="true">
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  )
}
