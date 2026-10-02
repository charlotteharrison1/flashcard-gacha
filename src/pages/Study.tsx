import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deckSuit, isRedSuit } from '../lib/theme'
import { useEarnings } from '../lib/earnings'
import { useAuth } from '../lib/auth'
import type { Card, Deck, Rating, ReviewResult } from '../lib/types'
import Confetti from '../components/Confetti'
import CardText from '../lib/cardText'
import { SlotSymbol } from '../components/SlotSymbol'
import { faceTextClass } from '../lib/cardDensity'
import FitScroll from '../components/FitScroll'
import CardEditor, { type CardValues } from '../components/CardEditor'
import { StarButton, TagAdder, TagChips } from '../components/CardMeta'
import { MAX_TAGS, filterLabel, readFilter, saveStar, saveTags, tagCounts } from '../lib/cardMeta'

const SESSION_LIMIT = 100
const COIN_POOF_MS = 800
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

const RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: 0, label: 'Again', color: 'red' },
  { value: 1, label: 'Hard', color: 'orange' },
  { value: 2, label: 'Good', color: 'blue' },
  { value: 3, label: 'Easy', color: 'green' },
]

type Poof = { id: number; x: number; y: number }
type DeckSettings = Pick<Deck, 'show_both' | 'float_anim'>

/** Fisher-Yates, so a deckbox round mixes its decks instead of running through them one after another. */
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DEFAULT_SETTINGS: DeckSettings = { show_both: false, float_anim: true }

/** `scope` "deck" studies the deck in the URL; "box" studies every deck in that deckbox, shuffled together. */
export default function Study({ scope = 'deck' }: { scope?: 'deck' | 'box' }) {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const studyAll = searchParams.get('all') === '1'
  const filter = readFilter(searchParams.get('f')) // all, starred, tagged, or tag:<name>
  const { setBalance } = useEarnings()
  const { session } = useAuth()
  const userId = session?.user.id ?? '' // Study is behind an authenticated route, so this is always set
  const [decks, setDecks] = useState<Record<string, DeckSettings> | null>(null) // per-deck display settings
  const [queue, setQueue] = useState<Card[] | null>(null)
  const [total, setTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(0)
  const [earned, setEarned] = useState(0)
  const [turn, setTurn] = useState(0)
  const [poofs, setPoofs] = useState<Poof[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tagging, setTagging] = useState(false) // the tag field is open
  const [editing, setEditing] = useState<'edit' | 'new' | null>(null) // the card editor is open
  const saving = useRef(false)
  const flyId = useRef(0)
  const cardAreaRef = useRef<HTMLDivElement>(null)
  const studyPath = scope === 'box' ? `/boxes/${id}` : `/decks/${id}`

  useEffect(() => {
    let cancelled = false
    async function load() {
      const decksQuery = supabase.from('decks').select('id, show_both, float_anim')
      const d = await (scope === 'box' ? decksQuery.eq('deckbox_id', id) : decksQuery.eq('id', id))
      if (d.error) return setError(d.error.message)
      const ids = d.data.map((x) => x.id)

      let cards: Card[] = []
      if (ids.length > 0) {
        let cardsQuery = supabase.from('cards').select('*').in('deck_id', ids).order('due_at').limit(SESSION_LIMIT)
        if (!studyAll) cardsQuery = cardsQuery.lte('due_at', new Date().toISOString())
        if (filter === 'starred') cardsQuery = cardsQuery.eq('starred', true)
        else if (filter === 'tagged') cardsQuery = cardsQuery.neq('tags', '{}')
        else if (filter.startsWith('tag:')) cardsQuery = cardsQuery.contains('tags', [filter.slice(4)])
        const c = await cardsQuery
        if (c.error) return setError(c.error.message)
        cards = c.data as Card[]
      }
      if (scope === 'box') cards = shuffle(cards)

      if (cancelled) return
      setDecks(Object.fromEntries(d.data.map((x) => [x.id, { show_both: x.show_both, float_anim: x.float_anim }])))
      setQueue(cards)
      setTotal(cards.length)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, studyAll, scope, filter])

  // A coin pops up over the card, then poofs into sparks. The position is measured fresh each time,
  // since the layout shifts as "N / M cleared" and the card itself change.
  function poofCoin() {
    const from = cardAreaRef.current?.getBoundingClientRect()
    if (!from) return
    const id = ++flyId.current
    setPoofs((p) => [...p, { id, x: from.left + from.width / 2, y: from.top + from.height * 0.4 }])
    window.setTimeout(() => setPoofs((p) => p.filter((c) => c.id !== id)), COIN_POOF_MS)
  }

  async function rate(card: Card, rating: Rating) {
    if (saving.current) return
    saving.current = true
    // The database reschedules the card and decides the payout (see review_card in 0012_review_card.sql).
    const { data, error: rpcError } = await supabase.rpc('review_card', { p_card_id: card.id, p_rating: rating })
    saving.current = false
    if (rpcError) return setError(rpcError.message)
    const { coins, ...fields } = data as ReviewResult

    if (coins > 0) {
      poofCoin()
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

  // Skip: put the card back somewhere later in this round. Nothing is saved, so no coin and no reschedule.
  function skip(card: Card) {
    if (saving.current) return
    setQueue((q) => {
      const rest = (q ?? []).slice(1)
      if (rest.length === 0) return q // nothing to skip to
      rest.splice(1 + Math.floor(Math.random() * rest.length), 0, card) // never first, so a different card is next
      return rest
    })
    setRevealed(false)
    setTurn((t) => t + 1)
  }

  // Suspend: hide the card until tomorrow (the database moves its due date; see 0014_suspend_card.sql).
  async function suspend(card: Card) {
    if (saving.current) return
    saving.current = true
    const { error: rpcError } = await supabase.rpc('suspend_card', { p_card_id: card.id })
    saving.current = false
    if (rpcError) return setError(rpcError.message)
    setQueue((q) => (q ?? []).slice(1))
    setTotal((t) => t - 1) // it's no longer part of this round, so the progress bar still reaches 100%
    setRevealed(false)
    setTurn((t) => t + 1)
  }

  /** Changes one card in the queue (and any copy of it) without touching the order. */
  function patchCard(cardId: string, patch: Partial<Card>) {
    setQueue((q) => (q ?? []).map((c) => (c.id === cardId ? { ...c, ...patch } : c)))
  }

  async function toggleStar(card: Card) {
    const starred = !card.starred
    patchCard(card.id, { starred })
    const err = await saveStar(card.id, starred)
    if (err) {
      patchCard(card.id, { starred: !starred })
      setError(err)
    }
  }

  async function changeTags(card: Card, tags: string[]) {
    const before = card.tags
    patchCard(card.id, { tags })
    const err = await saveTags(card.id, tags)
    if (err) {
      patchCard(card.id, { tags: before })
      setError(err)
    }
  }

  async function saveEdit(card: Card, values: CardValues) {
    const { error: e } = await supabase.from('cards').update(values).eq('id', card.id)
    if (e) return setError(e.message)
    patchCard(card.id, values)
    setEditing(null)
  }

  // A new card goes into the same deck as the one on screen and joins the end of this round.
  async function addCard(card: Card, values: CardValues) {
    const { data, error: e } = await supabase
      .from('cards')
      .insert({ deck_id: card.deck_id, source: 'manual', ...values })
      .select('*')
      .single()
    if (e) return setError(e.message)
    setQueue((q) => [...(q ?? []), data as Card])
    setTotal((t) => t + 1)
    setEditing(null)
  }

  const card = queue?.[0]

  // Keyboard: Space/Enter reveals the answer, 1-4 rates once it's visible, 8 stars the card, T adds a tag.
  useEffect(() => {
    if (!card) return
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !card) return
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return // typing
      if (e.key === '8') {
        toggleStar(card)
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setTagging(true)
      } else if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
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
  if (!queue || !decks) return <p className="muted">Shuffling…</p>

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
          <p className="muted">
            {filter !== 'all'
              ? `No ${filterLabel(filter)} ${studyAll ? 'found' : 'are due'} in this ${scope === 'box' ? 'deckbox' : 'deck'}.`
              : studyAll
                ? `This ${scope === 'box' ? 'deckbox' : 'deck'} has no cards yet.`
                : `No cards are due in this ${scope === 'box' ? 'deckbox' : 'deck'} right now.`}
          </p>
        )}
        <div className="row center-row">
          <Link className="button gold" to={studyPath}>
            {scope === 'box' ? 'Back to deckbox' : 'Back to deck'}
          </Link>
          {done === 0 && !studyAll && (
            <Link className="button gold" to={`${studyPath}/study?all=1${filter !== 'all' ? `&f=${encodeURIComponent(filter)}` : ''}`}>
              Study anyway
            </Link>
          )}
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

  // Each card keeps its own deck's look, so a shuffled deckbox round mixes suits and settings.
  const deck = decks[card.deck_id] ?? DEFAULT_SETTINGS
  const suit = deckSuit(card.deck_id)
  const pct = total ? Math.round((done / total) * 100) : 0
  const faceClass = isRedSuit(suit) ? 'face red' : 'face'
  const fitKey = `${card.id}:${card.font}:${card.front.length}:${card.back.length}` // when this changes, the text is re-measured
  const knownTags = tagCounts(queue).map(([t]) => t)

  return (
    <>
      <p className="study-back">
        <Link to={studyPath}>← Back to {scope === 'box' ? 'deckbox' : 'deck'}</Link>
      </p>

      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted center-text study-count">
        {done} / {total} cleared
      </p>

      <div className="study" key={turn} ref={cardAreaRef}>
        {deck.show_both ? (
          // Question is always visible; the answer is what's hidden until revealed, and once
          // revealed both stay on screen together — no flip, nothing disappears.
          <div
            className={`${faceClass} combined`}
            onClick={() => !revealed && setRevealed(true)}
            role="button"
            tabIndex={0}
            aria-label="Show answer"
          >
            <span className="corner tl">
              <b>Q</b>
              {suit}
            </span>
            <span className="corner br">
              <b>{revealed ? 'A' : 'Q'}</b>
              {suit}
            </span>
            {card.starred && (
              <span className="star-mark" aria-hidden="true">
                <SlotSymbol id="star" />
              </span>
            )}
            <FitScroll watch={`${fitKey}:${revealed}`}>
              <div className={faceTextClass(card.front, card.font)}>
                <CardText text={card.front} userId={userId} />
              </div>
              {!revealed && <span className="face-hint">Click or press space to reveal the answer</span>}
              {revealed && (
                <>
                  <hr className="combined-divider" />
                  <div className={faceTextClass(card.back, card.font)}>
                    <CardText text={card.back} userId={userId} />
                  </div>
                </>
              )}
            </FitScroll>
          </div>
        ) : (
          <div
            className={`flip${deck.float_anim ? '' : ' no-float'} ${revealed ? 'flipped' : ''}`}
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
                {card.starred && (
                  <span className="star-mark" aria-hidden="true">
                    <SlotSymbol id="star" />
                  </span>
                )}
                <FitScroll watch={`${fitKey}:front`} comfortable>
                  <div className={faceTextClass(card.front, card.font)}>
                    <CardText text={card.front} userId={userId} />
                  </div>
                </FitScroll>
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
                {card.starred && (
                  <span className="star-mark" aria-hidden="true">
                    <SlotSymbol id="star" />
                  </span>
                )}
                <FitScroll watch={`${fitKey}:back`} comfortable>
                  <div className={faceTextClass(card.back, card.font)}>
                    <CardText text={card.back} userId={userId} />
                  </div>
                </FitScroll>
              </div>
            </div>
          </div>
        )}

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

        <div className="row center-row">
          <StarButton starred={card.starred} onToggle={() => toggleStar(card)} hint="8" />
          <button className="secondary sm" onClick={() => setTagging((t) => !t)} title="Add a tag (T)">
            # Tag
          </button>
          <button className="secondary sm" onClick={() => setEditing((m) => (m === 'edit' ? null : 'edit'))} title="Edit this card">
            Edit card
          </button>
          <button className="secondary sm" onClick={() => setEditing((m) => (m === 'new' ? null : 'new'))} title="Add a new card to this deck">
            Add card
          </button>
          <button
            className="secondary sm"
            onClick={() => skip(card)}
            disabled={queue.length < 2}
            title="Move this card to later in the round. No coin, and its schedule doesn't change."
          >
            Skip
          </button>
          <button className="secondary sm" onClick={() => suspend(card)} title="Hide this card until tomorrow.">
            Suspend until tomorrow
          </button>
        </div>

        {(card.tags.length > 0 || tagging) && (
          <div className="row center-row study-tags">
            <TagChips tags={card.tags} onRemove={(t) => changeTags(card, card.tags.filter((x) => x !== t))} />
            {tagging && (
              <TagAdder
                key={card.id}
                existing={card.tags}
                suggestions={knownTags}
                onAdd={(t) => card.tags.length < MAX_TAGS && changeTags(card, [...card.tags, t])}
                onClose={() => setTagging(false)}
              />
            )}
          </div>
        )}

        {editing && (
          <CardEditor
            key={`${editing}:${card.id}`}
            title={editing === 'edit' ? 'Edit this card' : 'Add a card to this deck'}
            submitLabel={editing === 'edit' ? 'Save changes' : 'Add card'}
            initial={editing === 'edit' ? { front: card.front, back: card.back, font: card.font } : { front: '', back: '', font: card.font }}
            userId={userId}
            onSave={(values) => (editing === 'edit' ? saveEdit(card, values) : addCard(card, values))}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>

      {poofs.map((f) => (
        <div key={f.id} className="coin-poof" style={{ left: f.x, top: f.y }} aria-hidden="true">
          <span className="poof-coin">
            <SlotSymbol id="coin" />
          </span>
          {SPARK_ANGLES.map((a) => (
            <i key={a} className="poof-spark" style={{ '--a': `${a}deg` } as CSSProperties} />
          ))}
        </div>
      ))}
    </>
  )
}
