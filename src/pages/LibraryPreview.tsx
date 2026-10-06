import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import CardText from '../lib/cardText'
import { takeLibraryDeck, type LibraryDeck } from './Library'

type LibCard = { id: string; position: number; front: string; back: string; font: string }

/** A read-only look at every card in a preset deck, with a Take button. */
export default function LibraryPreview() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [deck, setDeck] = useState<LibraryDeck | null>(null)
  const [cards, setCards] = useState<LibCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taking, setTaking] = useState(false)

  useEffect(() => {
    async function load() {
      const d = await supabase.from('library_decks').select('*').eq('slug', slug).single()
      if (d.error) return setError(d.error.message)
      const c = await supabase.from('library_cards').select('*').eq('library_deck_id', d.data.id).order('position')
      if (c.error) return setError(c.error.message)
      setDeck(d.data as LibraryDeck)
      setCards(c.data as LibCard[])
    }
    load()
  }, [slug])

  async function take() {
    setTaking(true)
    const err = await takeLibraryDeck(slug)
    if (err) {
      setError(err)
      setTaking(false)
      return
    }
    navigate('/')
  }

  if (error && !deck) return <p className="error">{error}</p>
  if (!deck || !cards) return <p className="muted">Dusting the shelves…</p>

  return (
    <>
      <p>
        <Link to="/library">← The Library</Link>
      </p>
      <section className="hero">
        <div className="hero-info">
          <h2>{deck.name}</h2>
          <p className="muted">
            {cards.length} card{cards.length === 1 ? '' : 's'} · {deck.description}
          </p>
        </div>
        <button className="gold" onClick={take} disabled={taking}>
          {taking ? 'Taking…' : 'Take'}
        </button>
      </section>
      {error && <p className="error">{error}</p>}
      <ul className="preview-list">
        {cards.map((c) => (
          <li key={c.id} className="face preview-card">
            <div className={`face-text font-${c.font}`}>
              <CardText text={c.front} userId={userId} />
            </div>
            <hr className="combined-divider" />
            <div className={`face-text font-${c.font}`}>
              <CardText text={c.back} userId={userId} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
