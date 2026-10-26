import { useState } from 'react'
import { applyHoverAnim, loadHoverAnim } from '../lib/hoverAnim'

/** "Deck card hover animation": decks on the home screen lift and tilt under the mouse. Off by default; saved on this device. */
export default function HoverAnimToggle() {
  const [on, setOn] = useState(loadHoverAnim)

  return (
    <label className="row nowrap">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          applyHoverAnim(e.target.checked)
          setOn(e.target.checked)
        }}
      />
      Deck cards lift and tilt when hovered
    </label>
  )
}
