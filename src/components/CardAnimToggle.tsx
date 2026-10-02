import { useState } from 'react'
import { applyCardAnim, loadCardAnim } from '../lib/cardAnim'

/** "Turn off card animations": no fade-in, no floating, and the flip is instant. Saved on this device. */
export default function CardAnimToggle() {
  const [on, setOn] = useState(loadCardAnim)

  return (
    <label className="row nowrap">
      <input
        type="checkbox"
        checked={!on}
        onChange={(e) => {
          applyCardAnim(!e.target.checked)
          setOn(!e.target.checked)
        }}
      />
      Turn off card animations (fade-in, floating, flip)
    </label>
  )
}
