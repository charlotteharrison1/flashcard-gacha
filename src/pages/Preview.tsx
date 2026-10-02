import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Card } from '../lib/types'
import CardText from '../lib/cardText'
import { SlotSymbol } from '../components/SlotSymbol'

/** Every card in the deck, question and answer both shown, with no flipping or rating — just a read. */
export default function Preview() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('cards')
      .select('*')
      .eq('deck_id', id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCards(data as Card[])
      })
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!cards) return <p className="muted">Shuffling…</p>

  return (
    <>
      <p>
        <Link to={`/decks/${id}`}>← Back to deck</Link>
      </p>
      <h2>Preview</h2>

      {cards.length === 0 ? (
        <div className="empty">
          <div className="big-mark big-mark-pixel" aria-hidden="true">
            <SlotSymbol id="suitDiamond" />
          </div>
          <p>This deck has no cards yet.</p>
        </div>
      ) : (
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
      )}
    </>
  )
}
