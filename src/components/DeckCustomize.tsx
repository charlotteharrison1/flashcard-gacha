import { useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { errorMessage } from '../lib/errors'
import { DECK_COLOR_COUNT } from '../lib/theme'
import { DECK_LOGOS, logoFor } from '../lib/logos'
import CardLogo from './CardLogo'

type Props = {
  deckId: string
  color: number | null
  iconUrl: string | null
  /** The pixel logo on the card back (decks only). */
  logo?: string | null
  onSaved: () => void
  /** Which table the id belongs to: customising a deck (default) or a deckbox. */
  table?: 'decks' | 'deckboxes'
}

export default function DeckCustomize({ deckId, color, iconUrl, logo = null, onSaved, table = 'decks' }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function setColor(i: number) {
    setError(null)
    // Choosing a colour swaps out a custom icon, since the two are alternatives, not layers.
    const { error } = await supabase.from(table).update({ color: i, icon_url: null }).eq('id', deckId)
    if (error) setError(error.message)
    else onSaved()
  }

  async function setLogo(id: string | null) {
    setError(null)
    const { error } = await supabase.from('decks').update({ logo: id }).eq('id', deckId)
    if (error) setError(`${error.message} (If this says the column doesn't exist, run supabase/migrations/0021_deck_logo.sql.)`)
    else onSaved()
  }

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const { url } = await uploadImage(file, table === 'decks' ? 'deck-icons' : 'box-icons')
      const { error } = await supabase.from(table).update({ icon_url: url }).eq('id', deckId)
      if (error) throw error
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Upload failed.'))
    } finally {
      setBusy(false)
    }
  }

  async function clearIcon() {
    setError(null)
    const { error } = await supabase.from(table).update({ icon_url: null }).eq('id', deckId)
    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <div className="customize">
      <span className="customize-label">Colour</span>
      <div className="swatches">
        {Array.from({ length: DECK_COLOR_COUNT }, (_, i) => (
          <button
            key={i}
            className={`swatch-btn c${i}${color === i && !iconUrl ? ' active' : ''}`}
            onClick={() => setColor(i)}
            aria-label={`Colour ${i + 1}`}
          />
        ))}
      </div>

      {table === 'decks' && (
        <>
          <span className="customize-label">Logo</span>
          <div className="logo-picker">
            {DECK_LOGOS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`logo-option${logoFor(deckId, logo) === l.id && !iconUrl ? ' active' : ''}`}
                onClick={() => setLogo(l.id)}
                aria-label={l.label}
                title={l.label}
              >
                <CardLogo id={l.id} target={28} />
              </button>
            ))}
            {logo && (
              <button type="button" className="link" onClick={() => setLogo(null)}>
                Automatic
              </button>
            )}
          </div>
        </>
      )}

      <span className="customize-label">Icon image</span>
      <div className="row">
        <button className="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : iconUrl ? 'Replace image' : 'Upload image'}
        </button>
        {iconUrl && (
          <button className="link danger" onClick={clearIcon} disabled={busy}>
            Remove
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
