import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckSuit, effectiveColor } from '../lib/theme'
import { SlotSymbol } from '../components/SlotSymbol'
import DeckCustomize from '../components/DeckCustomize'

type DeckRow = {
  id: string
  name: string
  color: number | null
  icon_url: string | null
  cards: { count: number }[]
}
type LooseDeck = { id: string; name: string }

/** A deckbox is a folder: open it to see its decks, study one at a time, or shuffle them all together. */
export default function Deckbox() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState<string | null>(null)
  const [color, setColor] = useState<number | null>(null)
  const [iconUrl, setIconUrl] = useState<string | null>(null)
  const [customizing, setCustomizing] = useState(false)
  const [decks, setDecks] = useState<DeckRow[] | null>(null)
  const [loose, setLoose] = useState<LooseDeck[]>([]) // decks not in any box, offered for adding
  const [dueCount, setDueCount] = useState(0)
  const [pick, setPick] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, d, l] = await Promise.all([
      supabase.from('deckboxes').select('id, name, color, icon_url').eq('id', id).single(),
      supabase
        .from('decks')
        .select('id, name, color, icon_url, cards(count)')
        .eq('deckbox_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('decks').select('id, name').is('deckbox_id', null).order('name'),
    ])
    if (b.error) return setError(b.error.message)
    if (d.error) return setError(d.error.message)
    if (l.error) return setError(l.error.message)
    setName(b.data.name)
    setColor(b.data.color)
    setIconUrl(b.data.icon_url)
    setDecks(d.data as DeckRow[])
    setLoose(l.data)

    const ids = d.data.map((x) => x.id)
    if (ids.length === 0) return setDueCount(0)
    const due = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .in('deck_id', ids)
      .lte('due_at', new Date().toISOString())
    setDueCount(due.count ?? 0)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function setBox(deckId: string, boxId: string | null) {
    setError(null)
    const { error } = await supabase.from('decks').update({ deckbox_id: boxId }).eq('id', deckId)
    if (error) return setError(error.message)
    setPick('')
    load()
  }

  async function removeBox() {
    if (!confirm('Delete this deckbox? Its decks are not deleted; they go back to your home screen.')) return
    const { error } = await supabase.from('deckboxes').delete().eq('id', id)
    if (error) return setError(error.message)
    navigate('/')
  }

  if (error && !decks) return <p className="error">{error}</p>
  if (!decks || name === null) return <p className="muted">Opening…</p>

  const totalCards = decks.reduce((sum, d) => sum + (d.cards[0]?.count ?? 0), 0)

  return (
    <>
      <p>
        <Link to="/">← All decks</Link>
      </p>

      <section className="hero">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="hero-icon-img" />
        ) : (
          <span className="tile-icon hero-icon">
            <SlotSymbol id="deckbox" />
          </span>
        )}
        <div className="hero-info">
          <h2>{name}</h2>
          <p className="muted">
            {decks.length} deck{decks.length === 1 ? '' : 's'} · {totalCards} card{totalCards === 1 ? '' : 's'} · {dueCount} due
          </p>
        </div>
        <div className="row">
          {decks.length > 0 && (
            <>
              <Link className="button gold" to={`/boxes/${id}/study`}>
                Study shuffled
              </Link>
              <Link className="button secondary" to={`/boxes/${id}/study?all=1`}>
                Study anyway
              </Link>
            </>
          )}
          <button className="secondary sm" onClick={() => setCustomizing((c) => !c)}>
            Customize
          </button>
          <button className="red sm" onClick={removeBox}>
            Delete box
          </button>
        </div>
      </section>

      {customizing && <DeckCustomize table="deckboxes" deckId={id} color={color} iconUrl={iconUrl} onSaved={load} />}

      {error && <p className="error">{error}</p>}

      {decks.length === 0 ? (
        <p className="empty">This box is empty. Add a deck below.</p>
      ) : (
        <ul className="tiles">
          {decks.map((d) => {
            const n = d.cards[0]?.count ?? 0
            return (
              <li key={d.id} className={`tile cardback${d.icon_url ? ' has-icon' : ''} c${effectiveColor(d.id, d.color)}`}>
                <Link to={`/decks/${d.id}`} className="tile-main">
                  {d.icon_url ? (
                    <img src={d.icon_url} alt="" className="cardback-img" />
                  ) : (
                    <span className="tile-suit">{deckSuit(d.id)}</span>
                  )}
                  <span className="tile-plate">{d.name}</span>
                  <span className="tile-count">
                    {n} card{n === 1 ? '' : 's'}
                  </span>
                </Link>
                <button
                  className="tile-del tile-out blue"
                  onClick={() => setBox(d.id, null)}
                  aria-label={`Take ${d.name} out of this box`}
                  title="Take out of box"
                >
                  ↩
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <section className="panel">
        <h3>Add a deck to this box</h3>
        {loose.length === 0 ? (
          <p className="muted">Every deck is already in a box. Make a new deck on the home screen first.</p>
        ) : (
          <div className="row">
            <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Deck to add">
              <option value="">Choose a deck…</option>
              {loose.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button className="gold" disabled={!pick} onClick={() => setBox(pick, id)}>
              Add
            </button>
          </div>
        )}
      </section>
    </>
  )
}
