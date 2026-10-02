import { useEffect, useRef, useState } from 'react'
import { SlotSymbol } from './SlotSymbol'
import CardAnimToggle from './CardAnimToggle'
import { UI_FONTS, applyUiFont, loadUiFont, type UiFontId } from '../lib/uiFont'
import { SCHEMES, applyScheme, loadScheme, type SchemeId } from '../lib/scheme'
import { applyLights, loadLights } from '../lib/lights'
import { applyAnim, loadAnim } from '../lib/anim'

/** The Settings button in the top bar and its dropdown: look and feel (font, colours) and the animation switches. All saved on this device. */
export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [font, setFont] = useState<UiFontId>(loadUiFont)
  const [scheme, setScheme] = useState<SchemeId>(loadScheme)
  const [lights, setLights] = useState(loadLights)
  const [anim, setAnim] = useState(loadAnim)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on Escape or a click anywhere outside.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div className="settings-menu" ref={rootRef}>
      <button className="secondary sm settings-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <span className="settings-gear" aria-hidden="true">
          <SlotSymbol id="gear" />
        </span>
        Settings
      </button>

      {open && (
        <div className="settings-dropdown" role="dialog" aria-label="Settings">
          <div className="row between">
            <h3>Settings</h3>
            <button className="link" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <label className="file-field">
            <span>App font</span>
            <select
              value={font}
              onChange={(e) => {
                const id = e.target.value as UiFontId
                applyUiFont(id)
                setFont(id)
              }}
            >
              {UI_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="file-field">
            <span>Colours</span>
            <select
              value={scheme}
              onChange={(e) => {
                const id = e.target.value as SchemeId
                applyScheme(id)
                setScheme(id)
              }}
            >
              {SCHEMES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="row nowrap">
            <input
              type="checkbox"
              checked={lights}
              onChange={(e) => {
                applyLights(e.target.checked)
                setLights(e.target.checked)
              }}
            />
            Blinking lights
          </label>

          <CardAnimToggle />

          <label className="row nowrap">
            <input
              type="checkbox"
              checked={!anim}
              onChange={(e) => {
                applyAnim(!e.target.checked)
                setAnim(!e.target.checked)
              }}
            />
            Turn off ALL animations (the reels just show the result)
          </label>
        </div>
      )}
    </div>
  )
}
