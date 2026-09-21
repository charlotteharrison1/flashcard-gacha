import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { schedule } from '../lib/scheduler'
import { deckSuit, isRedSuit } from '../lib/theme'
import type { Card, Rating } from '../lib/types'
import Confetti from '../components/Confetti'

const SESSION_LIMIT = 100

const RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: 0, label: 'Again', color: 'red' },
  { value: 1, label: 'Hard', color: 'orange' },
  { value: 2, label: 'Good', color: 'blue' },
  { value: 3, label: 'Easy', color: 'green' },
]

export default function Study() {
  const { id = '' } = useParams()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [turn, setTurn] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  const suit = deckSuit(id)

  useEffect(() => {
    supabase
      .from('cards')
      .select('*')
      .eq('deck_id', id)
      .lte('due_at', new Date().toISOString())
      .order('due_at')
      .limit(SESSION_LIMIT)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else {
          setQueue(data as Card[])
          setTotal(data.length)
        }
      })
  }, [id])

  async function rate(card: Card, rating: Rating) {
    if (saving.current) return
    saving.current = true
    const next = schedule(card, rating)
    const [upd, rev] = await Promise.all([
      supabase.from('cards').update(next).eq('id', card.id),
      supabase.from('reviews').insert({ card_id: card.id, rating }),
    ])
    saving.current = false
    const err = upd.error ?? rev.error
    if (err) return setError(err.message)

    setQueue((q) => {
      const rest = (q ?? []).slice(1)
      return rating === 0 ? [...rest, { ...card, ...next }] : rest
    })
    if (rating !== 0) setDone((n) => n + 1)
    setRevealed(false)
    setTurn((t) => t + 1)
  }

  const card = queue?.[0]

  // Keyboard: Space/Enter flips, 1-4 rates.
  useEffect(() => {
    if (!card) return
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !card) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(card, (Number(e.key) - 1) as Rating)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) return <p className="error">{error}</p>
  if (!queue) return <p className="muted">Shuffling…</p>

  if (!card) {
    return (
      <div className="center celebrate">
        {done > 0 && <Confetti />}
        <div className="big-mark">{done > 0 ? '♥' : '♠'}</div>
        <h2>{done > 0 ? 'Round cleared' : 'Nothing to play'}</h2>
        {done > 0 ? (
          <>
            <p className="score">+{turn} earnings</p>
            <p className="muted">Spend them on the pull screen.</p>
          </>
        ) : (
          <p className="muted">No cards are due in this deck right now.</p>
        )}
        <div className="row center-row">
          <Link className="button gold" to={`/decks/${id}`}>
            Back to deck
          </Link>
          <Link className="button green" to="/pull">
            Pull screen
          </Link>
          <Link className="button secondary" to="/">
            All decks
          </Link>
        </div>
      </div>
    )
  }

  const pct = total ? Math.round((done / total) * 100) : 0
  const faceClass = isRedSuit(suit) ? 'face red' : 'face'

  return (
    <>
      <p>
        <Link to={`/decks/${id}`}>← Back to deck</Link>
      </p>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted center-text">
        {done} / {total} cleared
      </p>

      <div className="study" key={turn}>
        <div
          className={`flip ${revealed ? 'flipped' : ''}`}
          onClick={() => setRevealed(true)}
          role="button"
          tabIndex={0}
          aria-label="Show answer"
        >
          <div className="flip-inner">
            <div className={faceClass}>
              <span className="corner tl">
                <b>Q</b>
                {suit}
              </span>
              <span className="corner br">
                <b>Q</b>
                {suit}
              </span>
              <span className="tag q">Question</span>
              <span className="face-text">{card.front}</span>
              {!revealed && <span className="face-hint">Click or press space to flip</span>}
            </div>
            <div className={`${faceClass} back`}>
              <span className="corner tl">
                <b>A</b>
                {suit}
              </span>
              <span className="corner br">
                <b>A</b>
                {suit}
              </span>
              <span className="tag a">Answer</span>
              <span className="face-text">{card.back}</span>
            </div>
          </div>
        </div>

        {revealed ? (
          <div className="ratings">
            {RATINGS.map((r) => (
              <button key={r.value} className={`rate ${r.color}`} onClick={() => rate(card, r.value)}>
                {r.label}
                <kbd>{r.value + 1}</kbd>
              </button>
            ))}
          </div>
        ) : (
          <button className="gold" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}
      </div>
    </>
  )
}
