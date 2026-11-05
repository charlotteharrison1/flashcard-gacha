import { Link } from 'react-router-dom'

/** A little door to the Library. The door swings open when you hover it; the green label below is part of the same link. */
export default function LibraryDoor() {
  return (
    <Link to="/library" className="door" aria-label="Enter the library">
      <span className="door-frame">
        <span className="door-glow" />
        <span className="door-leaf">
          <span className="door-knob" />
        </span>
      </span>
      <span className="door-label">Enter the library</span>
    </Link>
  )
}
