import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckColor, deckSuit } from '../lib/theme'
import Earnings from '../components/Earnings'
import SaleSticker from '../components/SaleSticker'
import { useEarnings } from '../lib/earnings'

type DeckRow = { id: string; name: string; created_at: string; cards: { count: number }[] }

export default function Decks() {
  const [decks, setDecks] = useState<DeckRow[] | null>(null)
  const { balance } = useEarnings()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, created_at, cards(count)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setDecks(data as DeckRow[])
  }

  useEffect(() => {
    load()
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const { error } = await supabase.from('decks').insert({ name: trimmed })
    if (error) return setError(error.message)
    setName('')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this deck and all its cards?')) return
    const { error } = await supabase.from('decks').delete().eq('id', id)
    if (error) return setError(error.message)
    load()
  }

  return (
    <>
      <section className="wallet">
        <Earnings balance={balance} />
        <SaleSticker />
      </section>

      <h2>Your decks</h2>
      <form onSubmit={create} className="row nowrap">
        <input placeholder="Name a new deck…" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <button className="gold">Create</button>
      </form>
      {error && <p className="error">{error}</p>}

      {decks === null ? (
        <p className="muted">Shuffling…</p>
      ) : decks.length === 0 ? (
        <div className="empty">
          <div className="big-mark">♠</div>
          <p>No decks yet. Name your first one above.</p>
        </div>
      ) : (
        <ul className="tiles">
          {decks.map((d) => {
            const n = d.cards[0]?.count ?? 0
            return (
              <li key={d.id} className={`tile cardback c${deckColor(d.id)}`}>
                <Link to={`/decks/${d.id}`} className="tile-main">
                  <span className="tile-suit">{deckSuit(d.id)}</span>
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
    </>
  )
}
