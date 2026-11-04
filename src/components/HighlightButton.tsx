import { useEffect, useRef, useState } from 'react'
import { HIGHLIGHTS, loadHighlight, saveHighlight, type HighlightId } from '../lib/highlights'

/**
 * The highlight button in the card editor's toolbar. "H" highlights the selection in the colour you used last;
 * the arrow opens a palette of bright and pastel colours, and picking one highlights the selection in that colour right away.
 */
export default function HighlightButton({ onApply }: { onApply: (id: HighlightId) => void }) {
  const [last, setLast] = useState<HighlightId>(loadHighlight)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const color = HIGHLIGHTS.find((h) => h.id === last)?.color

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function apply(id: HighlightId) {
    setLast(id)
    saveHighlight(id)
    setOpen(false)
    onApply(id)
  }

  return (
    <span className="hl-picker" ref={rootRef}>
      <button type="button" className="fmt-btn hl-main" title="Highlight (in the last colour you chose)" onClick={() => apply(last)}>
        <mark className="md-mark" style={{ background: color }}>
          H
        </mark>
      </button>
      <button type="button" className="fmt-btn hl-caret" title="Choose a highlight colour" aria-expanded={open} aria-label="Choose a highlight colour" onClick={() => setOpen((v) => !v)}>
        ▾
      </button>
      {open && (
        <div className="hl-pop" role="dialog" aria-label="Highlight colours">
          {(['Bright', 'Pastel'] as const).map((group) => (
            <div key={group} className="hl-group">
              <span className="hl-group-label">{group}</span>
              <span className="hl-swatches">
                {HIGHLIGHTS.filter((h) => h.group === group).map((h) => (
                  <button key={h.id} type="button" className={`hl-swatch${h.id === last ? ' active' : ''}`} style={{ background: h.color }} title={h.label} aria-label={h.label} onClick={() => apply(h.id)} />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
