import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckSuit, effectiveColor } from '../lib/theme'
import Earnings from '../components/Earnings'
import SaleSticker from '../components/SaleSticker'
import { SlotSymbol } from '../components/SlotSymbol'
import { useEarnings } from '../lib/earnings'
import { useSettings } from '../lib/settings'
import SettingsPanel from '../components/SettingsPanel'

type DeckRow = {
  id: string
  name: string
  created_at: string
  color: number | null
  icon_url: string | null
  cards: { count: number }[]
}

type BoxRow = {
  id: string
  name: string
  color: number | null
  icon_url: string | null
  decks: { count: number }[]
}

/** The dashed "+" tile that turns into a one-field form: used for both new decks and new deckboxes. */
function NewTile({ label, placeholder, onCreate }: { label: string; placeholder: string; onCreate: (name: string) => Promise<boolean> }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (await onCreate(trimmed)) {
      setName('')
      setCreating(false)
    }
  }

  function cancel() {
    setCreating(false)
    setName('')
  }

  return (
    <div className="new-half new-deck-tile">
      {creating ? (
        <form onSubmit={submit} className="new-deck-form">
          <input
            autoFocus
            placeholder={placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            maxLength={100}
          />
          <div className="row nowrap">
            <button className="gold sm">Create</button>
            <button className="link" type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="new-deck-btn" onClick={() => setCreating(true)} aria-label={label}>
          <span className="new-deck-plus">+</span>
          <span>{label}</span>
        </button>
      )}
    </div>
  )
}

export default function Decks() {
  const [decks, setDecks] = useState<DeckRow[] | null>(null)
  const [boxes, setBoxes] = useState<BoxRow[]>([])
  const { balance } = useEarnings()
  const [error, setError] = useState<string | null>(null)
  const { settings, save: saveSettings, saveError } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // The gloves around the box all point at the sale sticker, so tell the CSS where its centre is (relative to the box).
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const place = () => {
      const sticker = box.querySelector('.sale')
      if (!sticker) return
      const b = box.getBoundingClientRect()
      const s = sticker.getBoundingClientRect()
      box.style.setProperty('--sx', `${Math.round(s.left - b.left + s.width / 2)}px`)
      box.style.setProperty('--sy', `${Math.round(s.top - b.top + s.height / 2)}px`)
    }
    place()
    const observer = new ResizeObserver(place) // the box changes size as decks load
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const [dragId, setDragId] = useState<string | null>(null) // the deck being dragged
  const [overBox, setOverBox] = useState<string | null>(null) // the deckbox it's hovering over

  async function load() {
    // Decks inside a deckbox only show up inside that box, like files in a folder.
    const [d, b] = await Promise.all([
      supabase
        .from('decks')
        .select('id, name, created_at, color, icon_url, cards(count)')
        .is('deckbox_id', null)
        .order('created_at', { ascending: false }),
      supabase.from('deckboxes').select('id, name, color, icon_url, decks(count)').order('created_at', { ascending: false }),
    ])
    if (d.error) return setError(d.error.message)
    if (b.error) return setError(b.error.message)
    setDecks(d.data as DeckRow[])
    setBoxes(b.data as BoxRow[])
  }

  useEffect(() => {
    load()
  }, [])

  async function createDeck(name: string) {
    // A new deck starts with the user's presets (Settings button).
    const { error } = await supabase.from('decks').insert({
      name,
      show_both: settings.show_both,
      float_anim: settings.float_anim,
      ...(settings.orientation !== 'horizontal' ? { orientation: settings.orientation } : {}),
    })
    if (error) {
      setError(error.message)
      return false
    }
    load()
    return true
  }

  async function createBox(name: string) {
    const { error } = await supabase.from('deckboxes').insert({ name })
    if (error) {
      setError(error.message)
      return false
    }
    load()
    return true
  }

  async function moveToBox(deckId: string, boxId: string) {
    setError(null)
    const { error } = await supabase.from('decks').update({ deckbox_id: boxId }).eq('id', deckId)
    if (error) return setError(error.message)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this deck and all its cards?')) return
    const { error } = await supabase.from('decks').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  return (
    <div className="home-box" ref={boxRef}>
      <span className="home-suit tl"><SlotSymbol id="spade" /></span>
      <span className="home-suit tr"><SlotSymbol id="heart" /></span>
      <span className="home-suit bl"><SlotSymbol id="suitDiamond" /></span>
      <span className="home-suit br"><SlotSymbol id="club" /></span>

      {/* Three gloves aimed at the sale sticker: two on the left (above and below its middle) and one on top */}
      <span className="home-glove glove-left" aria-hidden="true">
        <SlotSymbol id="glove" />
      </span>
      <span className="home-glove glove-left glove-left-low" aria-hidden="true">
        <SlotSymbol id="glove" />
      </span>
      <span className="home-glove glove-top" aria-hidden="true">
        <SlotSymbol id="glove" />
      </span>

      <section className="wallet">
        <SaleSticker />
        <Earnings balance={balance} />
      </section>

      <div className="home-divider" aria-hidden="true" />

      {showSettings && (
        <SettingsPanel
          settings={settings}
          save={saveSettings}
          saveError={saveError}
          onClose={() => setShowSettings(false)}
          onApplied={load}
        />
      )}

      <section className="collection">
        {error && <p className="error">{error}</p>}

        {decks === null ? (
          <p className="muted">Shuffling…</p>
        ) : (
          <ul className="tiles">
            {/* One grid cell holding both "new" buttons, stacked, to save room */}
            <li className="tile new-stack">
              <NewTile label="New deck" placeholder="Deck name…" onCreate={createDeck} />
              <NewTile label="New deckbox" placeholder="Deckbox name…" onCreate={createBox} />
              <div className="new-half new-deck-tile">
                <button className="new-deck-btn" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
                  <span className="new-deck-gear">
                    <SlotSymbol id="gear" />
                  </span>
                  <span>Settings</span>
                </button>
              </div>
            </li>

            {boxes.map((b) => {
              const n = b.decks[0]?.count ?? 0
              return (
                <li
                  key={b.id}
                  className={`tile cardback boxback${b.icon_url ? ' has-icon' : ''} c${effectiveColor(b.id, b.color)}${overBox === b.id ? ' drop-target' : ''}`}
                  onDragOver={(e) => {
                    if (!dragId) return
                    e.preventDefault() // lets this tile accept the drop
                    e.dataTransfer.dropEffect = 'move'
                    setOverBox(b.id)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverBox(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const deckId = dragId ?? e.dataTransfer.getData('text/plain')
                    setOverBox(null)
                    setDragId(null)
                    if (deckId) moveToBox(deckId, b.id)
                  }}
                >
                  <Link to={`/boxes/${b.id}`} className="tile-main">
                    {b.icon_url ? (
                      <img src={b.icon_url} alt="" className="cardback-img" draggable={false} />
                    ) : (
                      <span className="tile-icon">
                        <SlotSymbol id="deckbox" />
                      </span>
                    )}
                    <span className="tile-plate">{b.name}</span>
                    <span className="tile-count">
                      {n} deck{n === 1 ? '' : 's'}
                    </span>
                  </Link>
                </li>
              )
            })}

            {decks.map((d) => {
              const n = d.cards[0]?.count ?? 0
              return (
                <li
                  key={d.id}
                  className={`tile cardback${d.icon_url ? ' has-icon' : ''} c${effectiveColor(d.id, d.color)}${dragId === d.id ? ' dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', d.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(d.id)
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverBox(null)
                  }}
                >
                  <Link to={`/decks/${d.id}`} className="tile-main">
                    {d.icon_url ? (
                      <img src={d.icon_url} alt="" className="cardback-img" draggable={false} />
                    ) : (
                      <span className="tile-suit">{deckSuit(d.id)}</span>
                    )}
                    <span className="tile-plate">{d.name}</span>
                    <span className="tile-count">
                      {n} card{n === 1 ? '' : 's'}
                    </span>
                  </Link>
                  <button className="tile-del red" onClick={() => remove(d.id)} aria-label={`Delete ${d.name}`} title="Delete deck">
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
