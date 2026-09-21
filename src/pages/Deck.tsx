import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Card, Deck as DeckType } from '../lib/types'
import { deckColor, deckSuit } from '../lib/theme'
import CsvImport from '../components/CsvImport'

export default function Deck() {
  const { id = '' } = useParams()
  const [deck, setDeck] = useState<DeckType | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [d, c, due] = await Promise.all([
      supabase.from('decks').select('id, name, created_at').eq('id', id).single(),
      supabase.from('cards').select('*').eq('deck_id', id).order('created_at', { ascending: false }).limit(500),
      supabase
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('deck_id', id)
        .lte('due_at', new Date().toISOString()),
    ])
    if (d.error) return setError(d.error.message)
    if (c.error) return setError(c.error.message)
    setDeck(d.data)
    setCards(c.data as Card[])
    setDueCount(due.count ?? 0)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    const { error } = await supabase
      .from('cards')
      .insert({ deck_id: id, front: front.trim(), back: back.trim(), source: 'manual' })
    if (error) return setError(error.message)
    setFront('')
    setBack('')
    load()
  }

  async function remove(cardId: string) {
    const { error } = await supabase.from('cards').delete().eq('id', cardId)
    if (error) return setError(error.message)
    load()
  }

  if (error) return <p className="error">{error}</p>
  if (!deck) return <p className="muted">Shuffling…</p>

  return (
    <>
      <p>
        <Link to="/">← Decks</Link>
      </p>

      <div className="hero">
        <div className={`mini-card cardback c${deckColor(id)}`}>
          <span>{deckSuit(id)}</span>
        </div>
        <div className="hero-info">
          <h2>{deck.name}</h2>
          <p className="muted">
            {cards.length} card{cards.length === 1 ? '' : 's'} · {dueCount} due
          </p>
        </div>
        {dueCount > 0 ? (
          <Link className="button gold" to={`/decks/${id}/study`}>
            Study {dueCount}
          </Link>
        ) : (
          <span className="hero-done">{cards.length > 0 ? 'All cleared' : 'Add some cards'}</span>
        )}
      </div>

      <section className="panel">
        <h3>Add a card</h3>
        <form onSubmit={add} className="stack">
          <textarea placeholder="Front (the question)" value={front} onChange={(e) => setFront(e.target.value)} maxLength={5000} rows={2} />
          <textarea placeholder="Back (the answer)" value={back} onChange={(e) => setBack(e.target.value)} maxLength={5000} rows={2} />
          <button className="gold">Add card</button>
        </form>
      </section>

      <CsvImport deckId={id} onImported={load} />

      <h3>Cards ({cards.length})</h3>
      {cards.length === 0 ? (
        <div className="empty">
          <div className="big-mark">♣</div>
          <p>This deck is empty. Add a card or import a CSV above.</p>
        </div>
      ) : (
        <ul className="list">
          {cards.map((c) => (
            <li key={c.id} className="row between nowrap">
              <span>
                <strong>{c.front}</strong> <span className="muted">→ {c.back}</span>
              </span>
              <button className="link danger" onClick={() => remove(c.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
