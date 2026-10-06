import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckSuit, effectiveColor } from '../lib/theme'
import { SlotSymbol } from '../components/SlotSymbol'
import DeckCustomize from '../components/DeckCustomize'
import CardFilterBar from '../components/CardFilterBar'
import { previewText } from '../lib/textFormat'
import StudyFilter from '../components/StudyFilter'
import { StarButton, TagAdder, TagChips } from '../components/CardMeta'
import { MAX_TAGS, matchesFilter, saveStar, saveTags, sortCards, tagCounts, type CardFilter, type CardSort } from '../lib/cardMeta'

type DeckRow = {
  id: string
  name: string
  color: number | null
  icon_url: string | null
  cards: { count: number }[]
  due: { count: number }[]
}
type LooseDeck = { id: string; name: string }
type BoxCard = { id: string; deck_id: string; front: string; starred: boolean; tags: string[]; due_at: string }
const SHOWN_LIMIT = 100 // rows drawn at once; the filter and the study link still cover every card

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
  const [cards, setCards] = useState<BoxCard[]>([])
  const [filter, setFilter] = useState<CardFilter>('all')
  const [sort, setSort] = useState<CardSort>('newest')
  const [taggingId, setTaggingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, d, l] = await Promise.all([
      supabase.from('deckboxes').select('id, name, color, icon_url').eq('id', id).single(),
      supabase
        .from('decks')
        .select('id, name, color, icon_url, cards(count), due:cards(count)')
        .lte('due.due_at', new Date().toISOString())
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
    if (ids.length === 0) {
      setCards([])
      return setDueCount(0)
    }
    const cs = await supabase
      .from('cards')
      .select('id, deck_id, front, starred, tags, due_at')
      .in('deck_id', ids)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (cs.error) return setError(cs.error.message)
    setCards(cs.data as BoxCard[])
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

  function patchCard(cardId: string, patch: Partial<BoxCard>) {
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, ...patch } : c)))
  }

  async function toggleStar(c: BoxCard) {
    patchCard(c.id, { starred: !c.starred })
    const err = await saveStar(c.id, !c.starred)
    if (err) {
      patchCard(c.id, { starred: c.starred })
      setError(err)
    }
  }

  async function changeTags(c: BoxCard, tags: string[]) {
    patchCard(c.id, { tags })
    const err = await saveTags(c.id, tags)
    if (err) {
      patchCard(c.id, { tags: c.tags })
      setError(err)
    }
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
              {dueCount > 0 ? (
                <Link className="button gold" to={`/boxes/${id}/study`}>
                  {dueCount} card{dueCount === 1 ? '' : 's'} due
                </Link>
              ) : (
                <Link className="button secondary" to={`/boxes/${id}/study?all=1`}>
                  0 cards due - study anyway?
                </Link>
              )}
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
                <Link to={`/decks/${d.id}/study`} className="tile-main">
                  {d.icon_url ? (
                    <img src={d.icon_url} alt="" className="cardback-img" />
                  ) : (
                    <span className="tile-suit">{deckSuit(d.id)}</span>
                  )}
                  <span className="tile-plate">{d.name}</span>
                  <span className="tile-count">
                    {n} card{n === 1 ? '' : 's'}
                  </span>
                  <span className={`tile-due${(d.due[0]?.count ?? 0) > 0 ? ' has-due' : ''}`}>
                    {d.due[0]?.count ?? 0} card{(d.due[0]?.count ?? 0) === 1 ? '' : 's'} due
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
                <Link className="tile-del tile-gear" to={`/decks/${d.id}`} aria-label={`${d.name}: edit cards and settings`} title="Edit cards and settings">
                  <SlotSymbol id="gear" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {cards.some((c) => c.starred || c.tags.length > 0) && <StudyFilter compact basePath={`/boxes/${id}/study`} cards={cards} />}

      {cards.length > 0 && (
        <section className="panel">
          <h3>Cards in this box ({cards.length})</h3>
          <CardFilterBar cards={cards} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />
          {(() => {
            const matching = sortCards(
              cards.filter((c) => matchesFilter(c, filter)),
              sort,
            )
            const known = tagCounts(cards).map(([t]) => t)
            const deckName = new Map(decks.map((d) => [d.id, d.name]))
            return matching.length === 0 ? (
              <p className="muted">No cards match.</p>
            ) : (
              <>
                <ul className="list">
                  {matching.slice(0, SHOWN_LIMIT).map((c) => (
                    <li key={c.id} className="row nowrap card-row-main">
                      <StarButton starred={c.starred} onToggle={() => toggleStar(c)} />
                      <span>
                        <span className="card-row-text">
                          <strong>{previewText(c.front)}</strong> <span className="muted">· {deckName.get(c.deck_id)}</span>
                        </span>
                        <span className="card-row-tags">
                          <TagChips
                            tags={c.tags}
                            onPick={(t) => setFilter(`tag:${t}`)}
                            onRemove={(t) => changeTags(c, c.tags.filter((x) => x !== t))}
                          />
                          {taggingId === c.id ? (
                            <TagAdder
                              existing={c.tags}
                              suggestions={known}
                              onAdd={(t) => c.tags.length < MAX_TAGS && changeTags(c, [...c.tags, t])}
                              onClose={() => setTaggingId(null)}
                            />
                          ) : (
                            <button className="link" onClick={() => setTaggingId(c.id)}>
                              + tag
                            </button>
                          )}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {matching.length > SHOWN_LIMIT && (
                  <p className="muted">
                    Showing the first {SHOWN_LIMIT} of {matching.length}. Use the filter to narrow it down.
                  </p>
                )}
              </>
            )
          })()}
        </section>
      )}

      <details className="panel more-options">
        <summary>Add a deck to this box</summary>
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
      </details>
    </>
  )
}
