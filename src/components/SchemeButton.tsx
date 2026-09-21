import { useState } from 'react'
import { SCHEMES, applyScheme, loadScheme, type SchemeId } from '../lib/scheme'

export default function SchemeButton() {
  const [id, setId] = useState<SchemeId>(loadScheme)
  const index = SCHEMES.findIndex((s) => s.id === id)
  const current = SCHEMES[index]

  function next() {
    const nextId = SCHEMES[(index + 1) % SCHEMES.length].id
    applyScheme(nextId)
    setId(nextId)
  }

  return (
    <button
      className="secondary scheme-btn"
      onClick={next}
      title="Change colour scheme"
      aria-label={`Colour scheme: ${current.label}. Click to change.`}
    >
      <span className="swatch" style={{ background: current.swatch }} />
      {current.label}
    </button>
  )
}
