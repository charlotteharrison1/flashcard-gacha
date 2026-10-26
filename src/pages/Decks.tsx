import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { effectiveColor } from '../lib/theme'
import CardLogo from '../components/CardLogo'
import { logoFor } from '../lib/logos'
import Earnings from '../components/Earnings'
import SaleSticker from '../components/SaleSticker'
import { SlotSymbol } from '../components/SlotSymbol'
import { useEarnings } from '../lib/earnings'
import { useAuth } from '../lib/auth'
import { loadHome, saveHome } from '../lib/homeCache'
import { useSettings } from '../lib/settings'
import { applyWide, loadWide } from '../lib/wide'
import { applyListMode, loadListMode } from '../lib/listMode'
import DeckPresetsPanel from '../components/DeckPresetsPanel'

type DeckRow = {
  id: string
  name: string
  created_at: string
  color: number | null
  icon_url: string | null
  logo?: string | null
  cards: { count: number }[]
  due: { count: number }[] // the same cards, counting only the ones due now
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
  const userId = useAuth().session?.user.id ?? ''
  const cached = useRef(userId ? loadHome<{ decks: DeckRow[]; boxes: BoxRow[] }>(userId) : null).current // last visit's screen, drawn at once
  const [decks, setDecks] = useState<DeckRow[] | null>(cached?.decks ?? null)
  const [boxes, setBoxes] = useState<BoxRow[]>(cached?.boxes ?? [])
  const { balance, setBalance, refresh: refreshBalance } = useEarnings({ fetch: false }) // home_summary brings the balance too
  const [error, setError] = useState<string | null>(null)
  const { settings, save: saveSettings, saveError } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [wide, setWide] = useState(loadWide)
  const [list, setList] = useState(loadListMode)
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

  function show(d: DeckRow[], b: BoxRow[]) {
    setDecks(d)
    setBoxes(b)
    if (userId) saveHome(userId, { decks: d, boxes: b })
  }

  async function load() {
    // One round trip for the whole screen (0027_fast_home.sql). Decks inside a deckbox only show up inside that box.
    const summary = await supabase.rpc('home_summary')
    if (!summary.error && summary.data) {
      const s = summary.data as {
        balance: number
        decks: (DeckRow & { card_count: number; due_count: number })[]
        boxes: (BoxRow & { deck_count: number })[]
      }
      setBalance(s.balance)
      return show(
        s.decks.map((d) => ({ ...d, cards: [{ count: d.card_count }], due: [{ count: d.due_count }] })),
        s.boxes.map((b) => ({ ...b, decks: [{ count: b.deck_count }] })),
      )
    }

    // The migration hasn't been run yet: ask the old way, in separate requests.
    refreshBalance()
    const [d, b] = await Promise.all([
      supabase
        .from('decks')
        .select('*, cards(count), due:cards(count)') // all deck columns, so a missing newer one (like logo) can't break the page
        .lte('due.due_at', new Date().toISOString())
        .is('deckbox_id', null)
        .order('created_at', { ascending: false }),
      supabase.from('deckboxes').select('id, name, color, icon_url, decks(count)').order('created_at', { ascending: false }),
    ])
    if (d.error) return setError(d.error.message)
    if (b.error) return setError(b.error.message)
    show(d.data as DeckRow[], b.data as BoxRow[])
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

  // Dragging a deck onto a deckbox works the same in card mode and list mode.
  const boxDrop = (boxId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return
      e.preventDefault() // lets this tile accept the drop
      e.dataTransfer.dropEffect = 'move'
      setOverBox(boxId)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverBox(null)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const deckId = dragId ?? e.dataTransfer.getData('text/plain')
      setOverBox(null)
      setDragId(null)
      if (deckId) moveToBox(deckId, boxId)
    },
  })
  const deckDrag = (deckId: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', deckId)
      e.dataTransfer.effectAllowed = 'move'
      setDragId(deckId)
    },
    onDragEnd: () => {
      setDragId(null)
      setOverBox(null)
    },
  })

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
        <SlotSymbol id="gloveGold" />
      </span>

      <section className="wallet">
        <SaleSticker />
        <Earnings balance={balance} library />
      </section>

      <div className="home-divider" aria-hidden="true" />

      {showSettings && (
        <DeckPresetsPanel
          settings={settings}
          save={saveSettings}
          saveError={saveError}
          onClose={() => setShowSettings(false)}
          onApplied={load}
        />
      )}

      <section className="collection">
        <div className="view-toggles">
          <button className="link wide-toggle" onClick={() => { applyListMode(!list); setList(!list) }} aria-pressed={list}>
            {list ? 'Card mode' : 'List mode'}
          </button>
          {!list && (
            <button className="link wide-toggle" onClick={() => { applyWide(!wide); setWide(!wide) }} aria-pressed={wide}>
              {wide ? 'Thin mode' : 'Wide mode'}
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}

        {decks === null ? (
          <p className="muted">Shuffling…</p>
        ) : list ? (
          <>
            <div className="list-actions">
              <NewTile label="New deck" placeholder="Deck name…" onCreate={createDeck} />
              <NewTile label="New deckbox" placeholder="Deckbox name…" onCreate={createBox} />
              <div className="new-half new-deck-tile">
                <button className="new-deck-btn" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
                  <span className="new-deck-gear">
                    <SlotSymbol id="gear" />
                  </span>
                  <span>Deck presets</span>
                </button>
              </div>
            </div>
            <ul className="deck-list">
              {boxes.map((b) => {
                const n = b.decks[0]?.count ?? 0
                return (
                  <li key={b.id} className={`deck-row box-row c${effectiveColor(b.id, b.color)}${overBox === b.id ? ' drop-target' : ''}`} {...boxDrop(b.id)}>
                    <Link to={`/boxes/${b.id}`} className="row-main">
                      <span className="row-icon">
                        {b.icon_url ? <img src={b.icon_url} alt="" draggable={false} /> : <span className="tile-icon-sm"><SlotSymbol id="deckbox" /></span>}
                      </span>
                      <span className="row-name">{b.name}</span>
                      <span className="row-count">
                        {n} deck{n === 1 ? '' : 's'}
                      </span>
                    </Link>
                  </li>
                )
              })}
              {decks.map((d) => {
                const n = d.cards[0]?.count ?? 0
                const due = d.due[0]?.count ?? 0
                return (
                  <li key={d.id} className={`deck-row c${effectiveColor(d.id, d.color)}${dragId === d.id ? ' dragging' : ''}`} {...deckDrag(d.id)}>
                    <Link to={`/decks/${d.id}/study`} className="row-main">
                      <span className="row-icon">
                        {d.icon_url ? <img src={d.icon_url} alt="" draggable={false} /> : <CardLogo id={logoFor(d.id, d.logo)} target={28} />}
                      </span>
                      <span className="row-name">{d.name}</span>
                      <span className="row-count">
                        {n} card{n === 1 ? '' : 's'}.{' '}
                        <span className={`row-due${due > 0 ? ' has-due' : ''}`}>{due} due</span>
                      </span>
                    </Link>
                    <Link className="row-edit" to={`/decks/${d.id}`} aria-label={`${d.name}: edit cards and settings`}>
                      Edit deck
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
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
                  <span>Deck presets</span>
                </button>
              </div>
            </li>

            {boxes.map((b) => {
              const n = b.decks[0]?.count ?? 0
              return (
                <li
                  key={b.id}
                  className={`tile cardback boxback${b.icon_url ? ' has-icon' : ''} c${effectiveColor(b.id, b.color)}${overBox === b.id ? ' drop-target' : ''}`}
                  {...boxDrop(b.id)}
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
                  className={`tile cardback flashcard${d.icon_url ? ' has-icon' : ''} c${effectiveColor(d.id, d.color)}${dragId === d.id ? ' dragging' : ''}`}
                  {...deckDrag(d.id)}
                >
                  <Link to={`/decks/${d.id}/study`} className="tile-main">
                    {d.icon_url ? (
                      <img src={d.icon_url} alt="" className="cardback-img" draggable={false} />
                    ) : (
                      <span className="tile-logo">
                        <CardLogo id={logoFor(d.id, d.logo)} />
                      </span>
                    )}
                    <span className="tile-plate">{d.name}</span>
                    <span className="tile-count">
                      {n} card{n === 1 ? '' : 's'}.{' '}
                      <span className={`tile-due${(d.due[0]?.count ?? 0) > 0 ? ' has-due' : ''}`}>{d.due[0]?.count ?? 0} due</span>
                    </span>
                  </Link>
                  <Link className="tile-del tile-gear" to={`/decks/${d.id}`} aria-label={`${d.name}: edit cards and settings`} title="Edit cards and settings">Edit deck</Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
