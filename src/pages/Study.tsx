import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { schedule } from '../lib/scheduler'
import { deckSuit, isRedSuit } from '../lib/theme'
import { useEarnings } from '../lib/earnings'
import type { Card, Rating } from '../lib/types'
import Confetti from '../components/Confetti'
import Earnings from '../components/Earnings'
import CardText from '../lib/cardText'

const SESSION_LIMIT = 100
const COIN_FLY_MS = 750
const SHOW_BOTH_KEY = 'study-show-both'

const RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: 0, label: 'Again', color: 'red' },
  { value: 1, label: 'Hard', color: 'orange' },
  { value: 2, label: 'Good', color: 'blue' },
  { value: 3, label: 'Easy', color: 'green' },
]

type Flyer = { id: number; x: number; y: number; dx: number; dy: number; amount: number }

function loadShowBoth() {
  try {
    return localStorage.getItem(SHOW_BOTH_KEY) === '1'
  } catch {
    return false
  }
}

export default function Study() {
  const { id = '' } = useParams()
  const { balance, setBalance } = useEarnings()
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [showBoth, setShowBoth] = useState(loadShowBoth)
  const [done, setDone] = useState(0)
  const [earned, setEarned] = useState(0)
  const [turn, setTurn] = useState(0)
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  const flyId = useRef(0)
  const earningsRef = useRef<HTMLDivElement>(null)
  const cardAreaRef = useRef<HTMLDivElement>(null)
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

  function toggleShowBoth() {
    setShowBoth((v) => {
      const next = !v
      try {
        localStorage.setItem(SHOW_BOTH_KEY, next ? '1' : '0')
      } catch {
        // storage blocked (private window etc.) — the toggle still works for this session
      }
      return next
    })
  }

  // Sends a little coin from the card to the earnings pile. Positions are measured fresh each
  // time (not cached), since the layout shifts as "N / M cleared" and the card itself change.
  function flyCoin(amount: number) {
    const from = cardAreaRef.current?.getBoundingClientRect()
    const to = earningsRef.current?.getBoundingClientRect()
    if (!from || !to) return
    const id = ++flyId.current
    const x = from.left + from.width / 2
    const y = from.top + 40
    const dx = to.left + to.width / 2 - x
    const dy = to.top + to.height / 2 - y
    setFlyers((f) => [...f, { id, x, y, dx, dy, amount }])
    window.setTimeout(() => setFlyers((f) => f.filter((c) => c.id !== id)), COIN_FLY_MS)
  }

  async function rate(card: Card, rating: Rating) {
    if (saving.current) return
    saving.current = true
    const { coins, ...fields } = schedule(card, rating)
    const [upd, rev] = await Promise.all([
      supabase.from('cards').update(fields).eq('id', card.id),
      supabase.from('reviews').insert({ card_id: card.id, rating, coins_earned: coins }),
    ])
    saving.current = false
    const err = upd.error ?? rev.error
    if (err) return setError(err.message)

    if (coins > 0) {
      flyCoin(coins)
      setBalance((b) => (b ?? 0) + coins)
      setEarned((e) => e + coins)
    }

    setQueue((q) => {
      const rest = (q ?? []).slice(1)
      return rating === 0 ? [...rest, { ...card, ...fields }] : rest
    })
    if (rating !== 0) setDone((n) => n + 1)
    setRevealed(false)
    setTurn((t) => t + 1)
  }

  const card = queue?.[0]
  const canRate = showBoth || revealed

  // Keyboard: Space/Enter flips (flip mode only), 1-4 rates once the answer is visible.
  useEffect(() => {
    if (!card) return
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !card) return
      if (!showBoth && !revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (canRate && ['1', '2', '3', '4'].includes(e.key)) {
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
            <p className="score">+{earned} earnings</p>
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
  const fontClass = `font-${card.font}`

  return (
    <>
      <p>
        <Link to={`/decks/${id}`}>← Back to deck</Link>
      </p>

      <div className="study-wallet" ref={earningsRef}>
        <Earnings compact balance={balance} />
      </div>

      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted center-text">
        {done} / {total} cleared
      </p>
      <div className="study-toggle">
        <button className="secondary sm" onClick={toggleShowBoth}>
          {showBoth ? 'Switch to flip-to-reveal' : 'Show answer with question'}
        </button>
      </div>

      <div className="study" key={turn} ref={cardAreaRef}>
        {showBoth ? (
          <div className={`${faceClass} combined`}>
            <span className="corner tl">
              <b>Q</b>
              {suit}
            </span>
            <span className="corner br">
              <b>A</b>
              {suit}
            </span>
            <div className={`face-text ${fontClass}`}>
              <CardText text={card.front} />
            </div>
            <hr className="combined-divider" />
            <div className={`face-text ${fontClass}`}>
              <CardText text={card.back} />
            </div>
          </div>
        ) : (
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
                <div className={`face-text ${fontClass}`}>
                  <CardText text={card.front} />
                </div>
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
                <div className={`face-text ${fontClass}`}>
                  <CardText text={card.back} />
                </div>
              </div>
            </div>
          </div>
        )}

        {canRate ? (
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

      {flyers.map((f) => (
        <div
          key={f.id}
          className="fly-coin"
          style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px` } as CSSProperties}
          aria-hidden="true"
        >
          +{f.amount}
        </div>
      ))}
    </>
  )
}
