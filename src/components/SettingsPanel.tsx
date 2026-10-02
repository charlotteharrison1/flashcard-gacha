import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FONT_OPTIONS, type CardFont } from '../lib/fonts'
import type { Settings } from '../lib/settings'

/** Presets for all decks: what new decks and cards start with, plus buttons to apply a preset to everything that already exists. */
export default function SettingsPanel({
  settings,
  save,
  saveError,
  onClose,
  onApplied,
}: {
  settings: Settings
  save: (patch: Partial<Settings>) => Promise<void>
  saveError: string | null
  onClose: () => void
  onApplied: () => void
}) {
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function applyFont() {
    if (!confirm(`Change the font of EVERY card in ALL your decks to "${FONT_OPTIONS.find((f) => f.id === settings.default_font)?.label}"?`)) return
    setError(null)
    // The filter matches every row; it's there because updates must have one.
    const { count, error: e } = await supabase.from('cards').update({ font: settings.default_font }, { count: 'exact' }).not('id', 'is', null)
    if (e) return setError(e.message)
    setNote(`Changed the font on ${count ?? 'all'} cards.`)
    onApplied()
  }

  async function applyDeckSetting(field: 'show_both' | 'float_anim', label: string) {
    setError(null)
    const { count, error: e } = await supabase.from('decks').update({ [field]: settings[field] }, { count: 'exact' }).not('id', 'is', null)
    if (e) return setError(e.message)
    setNote(`${label} applied to ${count ?? 'all'} decks.`)
    onApplied()
  }

  return (
    <section className="panel settings-panel">
      <div className="row between">
        <h3>Presets for all decks</h3>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">
        These are what a new deck or card starts with. Each "Apply to all" button also changes everything you already have.
      </p>

      <div className="setting-row">
        <label className="file-field">
          <span>Card font</span>
          <select value={settings.default_font} onChange={(e) => save({ default_font: e.target.value as CardFont })}>
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary sm" onClick={applyFont}>
          Apply to all cards
        </button>
      </div>

      <div className="setting-row">
        <label className="row nowrap">
          <input type="checkbox" checked={settings.show_both} onChange={(e) => save({ show_both: e.target.checked })} />
          Keep the answer on screen with the question (no flip)
        </label>
        <button className="secondary sm" onClick={() => applyDeckSetting('show_both', 'No-flip')}>
          Apply to all decks
        </button>
      </div>

      <div className="setting-row">
        <label className="row nowrap">
          <input type="checkbox" checked={settings.float_anim} onChange={(e) => save({ float_anim: e.target.checked })} />
          Floating animation on the study card
        </label>
        <button className="secondary sm" onClick={() => applyDeckSetting('float_anim', 'Floating animation')}>
          Apply to all decks
        </button>
      </div>

      {note && <p className="notice">{note}</p>}
      {(error || saveError) && (
        <p className="error">
          {error ?? saveError} (If this says the table doesn't exist, run supabase/migrations/0018_user_settings.sql.)
        </p>
      )}
    </section>
  )
}
