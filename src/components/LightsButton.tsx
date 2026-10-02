import { useState } from 'react'
import { applyLights, loadLights } from '../lib/lights'

/** Header toggle for the blinking / chasing lights. */
export default function LightsButton() {
  const [on, setOn] = useState(loadLights)

  function toggle() {
    applyLights(!on)
    setOn(!on)
  }

  return (
    <button
      className="secondary scheme-btn lights-btn"
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'Turn the blinking lights off' : 'Turn the blinking lights on'}
    >
      Lights: {on ? 'on' : 'off'}
    </button>
  )
}
