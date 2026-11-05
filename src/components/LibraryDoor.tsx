import { Link } from 'react-router-dom'

// A 10x20 pixel grid: [x, y, width, height, colour]. The back is the frame and the night sky behind the door; the leaf is the door itself.
const INK = '#0a1218'
const GOLD = '#ffc233'
const GOLD_D = '#b98410'
const BACK: [number, number, number, number, string][] = [
  [0, 0, 10, 20, INK],
  [1, 1, 8, 19, GOLD],
  [8, 1, 1, 19, GOLD_D],
  [2, 2, 6, 17, '#05060d'], // the night sky behind the door
  [3, 4, 1, 1, '#ffffff'],
  [6, 3, 1, 1, '#ffe27a'],
  [5, 7, 1, 1, '#9fd6ff'],
  [3, 9, 1, 1, '#ffe27a'],
  [6, 11, 1, 1, '#ffffff'],
  [4, 13, 1, 1, '#9fd6ff'],
  [7, 15, 1, 1, '#ffffff'],
  [3, 17, 1, 1, '#ffe27a'],
]
const WOOD = '#a36a35'
const WOOD_D = '#8a5628'
const LEAF: [number, number, number, number, string][] = [
  [2, 2, 6, 17, WOOD],
  [2, 2, 1, 17, '#5e3a18'],
  [7, 2, 1, 17, WOOD_D],
  [3, 3, 4, 6, WOOD_D],
  [4, 4, 2, 4, '#b9793c'],
  [3, 12, 4, 6, WOOD_D],
  [4, 13, 2, 4, '#b9793c'],
  [6, 10, 1, 1, GOLD],
  [2, 2, 6, 1, '#c08445'],
]

const Pixels = ({ rects }: { rects: typeof BACK }) => (
  <>
    {rects.map(([x, y, w, h, fill], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
    ))}
  </>
)

/** A little door to the Library. The door swings open when you hover it; the green label below is part of the same link. */
export default function LibraryDoor() {
  return (
    <Link to="/library" className="door" aria-label="Enter the library">
      <span className="door-art">
        <svg viewBox="0 0 10 20" shapeRendering="crispEdges" aria-hidden="true">
          <Pixels rects={BACK} />
        </svg>
        <svg className="door-leaf" viewBox="0 0 10 20" shapeRendering="crispEdges" aria-hidden="true">
          <Pixels rects={LEAF} />
        </svg>
      </span>
      <span className="door-label">Enter the library</span>
    </Link>
  )
}
