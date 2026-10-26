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
import { DECK_SIZES, logoTargetFor, sizeOf, type DeckSize } from '../lib/deckSize'
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
  card_size?: string | null
  home_order?: number | null
  cards: { count: number }[]
  due: { count: number }[] // the same cards, counting only the ones due now
}

type BoxRow = {
  id: string
  name: string
  color: number | null
  icon_url: string | null
  home_order?: number | null
  decks: { count: number }[]
}

/** A solid pill-shaped "+ New ..." button that turns into a one-field form: used for both new decks and new deckboxes. */
function NewPellet({ label, color, placeholder, onCreate }: { label: string; color: string; placeholder: string; onCreate: (name: string) => Promise<boolean> }) {
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

  return creating ? (
    <form onSubmit={submit} className="pellet-form">
      <input
        autoFocus
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && cancel()}
        maxLength={100}
      />
      <button className="pellet gold">Create</button>
      <button className="link" type="button" onClick={cancel}>
        Cancel
      </button>
    </form>
  ) : (
    <button className={`pellet ${color}`} onClick={() => setCreating(true)} aria-label={label}>
      <span className="pellet-plus">+</span>
      {label}
    </button>
  )
}

type Item = { kind: 'box'; box: BoxRow } | { kind: 'deck'; deck: DeckRow }
const idOf = (it: Item) => (it.kind === 'box' ? it.box.id : it.deck.id)

/** Decks and deckboxes in the order the user arranged them. Anything never arranged (e.g. just created) comes first, boxes before decks. */
function orderItems(boxes: BoxRow[], decks: DeckRow[]): Item[] {
  const all: Item[] = [...boxes.map((box): Item => ({ kind: 'box', box })), ...decks.map((deck): Item => ({ kind: 'deck', deck }))]
  const key = (it: Item, i: number) => ((it.kind === 'box' ? it.box.home_order : it.deck.home_order) ?? -1e6 + i)
  return all
    .map((it, i) => ({ it, k: key(it, i) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it)
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
      supabase.from('deckboxes').select('*, decks(count)').order('created_at', { ascending: false }),
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

  // ---- Edit homepage: drag tiles into any order, and pick a size for each deck ----
  const [editing, setEditing] = useState(false)
  const [overId, setOverId] = useState<string | null>(null)
  const items = orderItems(boxes, decks ?? [])

  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    const ids = items.map(idOf)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, fromId)
    const orderOf = new Map(next.map((id, i) => [id, i]))
    show(
      (decks ?? []).map((d) => ({ ...d, home_order: orderOf.get(d.id) ?? d.home_order })),
      boxes.map((b) => ({ ...b, home_order: orderOf.get(b.id) ?? b.home_order })),
    )
    const boxIds = new Set(boxes.map((b) => b.id))
    const { error } = await supabase.rpc('save_home_order', { p_items: next.map((id, i) => ({ kind: boxIds.has(id) ? 'box' : 'deck', id, ord: i })) })
    if (error) setError(`${error.message} (If this says the function doesn't exist, run supabase/migrations/0029_home_layout.sql.)`)
  }

  async function resize(deckId: string, size: DeckSize) {
    setError(null)
    show((decks ?? []).map((d) => (d.id === deckId ? { ...d, card_size: size } : d)), boxes)
    const { error } = await supabase.from('decks').update({ card_size: size }).eq('id', deckId)
    if (error) {
      setError(`${error.message} (If this says the column doesn't exist, run supabase/migrations/0028_deck_size.sql.)`)
      load()
    }
  }

  const editDrag = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
      setDragId(id)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverId(id)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const from = dragId ?? e.dataTransfer.getData('text/plain')
      setOverId(null)
      setDragId(null)
      if (from) reorder(from, id)
    },
    onDragEnd: () => {
      setDragId(null)
      setOverId(null)
    },
  })
  const editClass = (id: string) => (editing ? ` editing${dragId === id ? ' dragging' : ''}${overId === id && dragId !== id ? ' over' : ''}` : '')
  const noNav = (e: React.MouseEvent) => {
    if (editing) e.preventDefault() // tiles don't open while you're rearranging
  }

  const renderBoxTile = (b: BoxRow) => {
    const n = b.decks[0]?.count ?? 0
    return (
      <li
        key={b.id}
        className={`tile cardback boxback${b.icon_url ? ' has-icon' : ''} c${effectiveColor(b.id, b.color)}${!editing && overBox === b.id ? ' drop-target' : ''}${editClass(b.id)}`}
        {...(editing ? editDrag(b.id) : boxDrop(b.id))}
      >
        <Link to={`/boxes/${b.id}`} className="tile-main" onClick={noNav}>
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
  }

  const renderDeckTile = (d: DeckRow) => {
    const n = d.cards[0]?.count ?? 0
    const due = d.due[0]?.count ?? 0
    return (
      <li
        key={d.id}
        className={`tile cardback flashcard${d.icon_url ? ' has-icon' : ''} size-${sizeOf(d.card_size)} c${effectiveColor(d.id, d.color)}${!editing && dragId === d.id ? ' dragging' : ''}${editClass(d.id)}`}
        {...(editing ? editDrag(d.id) : deckDrag(d.id))}
      >
        <Link to={`/decks/${d.id}/study`} className="tile-main" onClick={noNav}>
          {d.icon_url ? (
            <img src={d.icon_url} alt="" className="cardback-img" draggable={false} />
          ) : (
            <span className="tile-logo">
              <CardLogo id={logoFor(d.id, d.logo)} target={logoTargetFor(sizeOf(d.card_size))} />
            </span>
          )}
          <span className="tile-plate">{d.name}</span>
          <span className="tile-count">
            {n} card{n === 1 ? '' : 's'}.{' '}
            <span className={`tile-due${due > 0 ? ' has-due' : ''}`}>{due} due</span>
          </span>
        </Link>
        {editing ? (
          <div className="size-ctl" role="group" aria-label={`${d.name} size`}>
            {DECK_SIZES.map((z) => (
              <button key={z.id} type="button" className={`size-pip${sizeOf(d.card_size) === z.id ? ' active' : ''}`} onClick={() => resize(d.id, z.id)} aria-label={`${z.label} (${z.hint})`} title={`${z.label} (${z.hint})`}>
                <span className={`size-shape size-shape-${z.id}`} />
              </button>
            ))}
          </div>
        ) : (
          <Link className="tile-del tile-gear" to={`/decks/${d.id}`} aria-label={`${d.name}: edit cards and settings`} title="Edit cards and settings">
            Edit deck
          </Link>
        )}
      </li>
    )
  }

  const renderBoxRow = (b: BoxRow) => {
    const n = b.decks[0]?.count ?? 0
    return (
      <li key={b.id} className={`deck-row box-row c${effectiveColor(b.id, b.color)}${!editing && overBox === b.id ? ' drop-target' : ''}${editClass(b.id)}`} {...(editing ? editDrag(b.id) : boxDrop(b.id))}>
        <Link to={`/boxes/${b.id}`} className="row-main" onClick={noNav}>
          <span className="row-icon">{b.icon_url ? <img src={b.icon_url} alt="" draggable={false} /> : <span className="tile-icon-sm"><SlotSymbol id="deckbox" /></span>}</span>
          <span className="row-name">{b.name}</span>
          <span className="row-count">
            {n} deck{n === 1 ? '' : 's'}
          </span>
        </Link>
      </li>
    )
  }

  const renderDeckRow = (d: DeckRow) => {
    const n = d.cards[0]?.count ?? 0
    const due = d.due[0]?.count ?? 0
    return (
      <li key={d.id} className={`deck-row c${effectiveColor(d.id, d.color)}${!editing && dragId === d.id ? ' dragging' : ''}${editClass(d.id)}`} {...(editing ? editDrag(d.id) : deckDrag(d.id))}>
        <Link to={`/decks/${d.id}/study`} className="row-main" onClick={noNav}>
          <span className="row-icon">{d.icon_url ? <img src={d.icon_url} alt="" draggable={false} /> : <CardLogo id={logoFor(d.id, d.logo)} target={28} />}</span>
          <span className="row-name">{d.name}</span>
          <span className="row-count">
            {n} card{n === 1 ? '' : 's'}.{' '}
            <span className={`row-due${due > 0 ? ' has-due' : ''}`}>{due} due</span>
          </span>
        </Link>
        {!editing && (
          <Link className="row-edit" to={`/decks/${d.id}`} aria-label={`${d.name}: edit cards and settings`}>
            Edit deck
          </Link>
        )}
      </li>
    )
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
        <div className="shelf-bar">
          <NewPellet label="New deck" color="green" placeholder="Deck name…" onCreate={createDeck} />
          <NewPellet label="New deckbox" color="blue" placeholder="Deckbox name…" onCreate={createBox} />
          <button className="pellet purple" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
            <span className="pellet-gear">
              <SlotSymbol id="gear" />
            </span>
            Deck presets
          </button>
          <button className={`pellet ${editing ? 'red' : 'orange'}`} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            {editing ? 'Done editing' : 'Edit homepage'}
          </button>
          <span className="view-toggles">
            <button className="link wide-toggle" onClick={() => { applyListMode(!list); setList(!list) }} aria-pressed={list}>
              {list ? 'Card mode' : 'List mode'}
            </button>
            {!list && (
              <button className="link wide-toggle" onClick={() => { applyWide(!wide); setWide(!wide) }} aria-pressed={wide}>
                {wide ? 'Thin mode' : 'Wide mode'}
              </button>
            )}
          </span>
        </div>
        {error && <p className="error">{error}</p>}

        {editing && <p className="muted edit-hint">Drag decks and deckboxes to rearrange them. Use the little buttons on a deck to make it wide or big.</p>}
        {decks === null ? (
          <p className="muted">Shuffling…</p>
        ) : list ? (
          <ul className="deck-list">{items.map((it) => (it.kind === 'box' ? renderBoxRow(it.box) : renderDeckRow(it.deck)))}</ul>
        ) : (
          <ul className={`tiles${editing ? ' tiles-editing' : ''}`}>{items.map((it) => (it.kind === 'box' ? renderBoxTile(it.box) : renderDeckTile(it.deck)))}</ul>
        )}
      </section>
    </div>
  )
}
