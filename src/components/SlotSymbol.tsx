import { SPRITES, type SpriteId } from '../lib/sprites'

/** A pixel-art sprite (see lib/sprites.ts). Sized in CSS as a whole multiple of its grid so pixels stay square. */
export function SlotSymbol({ id }: { id: SpriteId }) {
  const { size, paths } = SPRITES[id]
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      {paths.map((p) => (
        <path key={p.color} d={p.d} fill={p.color} />
      ))}
    </svg>
  )
}
