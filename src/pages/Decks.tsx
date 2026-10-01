import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckSuit, effectiveColor } from '../lib/theme'
import Earnings from '../components/Earnings'
import SaleSticker from '../components/SaleSticker'
import { useEarnings } from '../lib/earnings'

type DeckRow = {
  id: string
  name: string
  created_at: string
  color: number | null
  icon_url: string | null
  cards: { count: number }[]
}

export default function Decks() {
  const [decks, setDecks] = useState<DeckRow[] | null>(null)
  const { balance } = useEarnings()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('decks')
      .select('id, name, created_at, color, icon_url, cards(count)')
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
    setCreating(false)
    load()
  }

  function cancelCreate() {
    setCreating(false)
    setName('')
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
        <SaleSticker />
        <Earnings balance={balance} />
      </section>

      <section className="collection">
        {error && <p className="error">{error}</p>}

        {decks === null ? (
          <p className="muted">Shuffling…</p>
        ) : (
          <ul className="tiles">
            <li className="tile new-deck-tile">
              {creating ? (
                <form onSubmit={create} className="new-deck-form">
                  <input
                    autoFocus
                    placeholder="Deck name…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && cancelCreate()}
                    maxLength={100}
                  />
                  <div className="row nowrap">
                    <button className="gold sm">Create</button>
                    <button className="link" type="button" onClick={cancelCreate}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button className="new-deck-btn" onClick={() => setCreating(true)} aria-label="Create a new deck">
                  <span className="new-deck-plus">+</span>
                  <span>New deck</span>
                </button>
              )}
            </li>
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
                  <button className="tile-del red" onClick={() => remove(d.id)} aria-label={`Delete ${d.name}`} title="Delete deck">
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
