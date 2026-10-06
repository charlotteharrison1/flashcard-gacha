import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Card, Deck as DeckType } from '../lib/types'
import { effectiveColor } from '../lib/theme'
import CardLogo from '../components/CardLogo'
import { logoFor } from '../lib/logos'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../lib/auth'
import { DEFAULT_FONT, FONT_OPTIONS, type CardFont } from '../lib/fonts'
import CsvImport from '../components/CsvImport'
import DeckCustomize from '../components/DeckCustomize'
import AttachmentPicker from '../components/AttachmentPicker'
import FormatToolbar from '../components/FormatToolbar'
import CardText, { setImageWidth } from '../lib/cardText'
import CardFilterBar from '../components/CardFilterBar'
import { previewText } from '../lib/textFormat'
import { SlotSymbol } from '../components/SlotSymbol'
import CardEditor, { type CardValues } from '../components/CardEditor'
import { useSettings } from '../lib/settings'
import StudyFilter from '../components/StudyFilter'
import { StarButton, TagAdder, TagChips } from '../components/CardMeta'
import { MAX_TAGS, matchesFilter, saveStar, saveTags, sortCards, tagCounts, type CardFilter, type CardSort } from '../lib/cardMeta'

const HAS_IMAGE_RE = /!\[[^\]]*\]\(/

export default function Deck() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [deck, setDeck] = useState<DeckType | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [font, setFont] = useState<CardFont>(DEFAULT_FONT)
  const [adding, setAdding] = useState(false)
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const backRef = useRef<HTMLTextAreaElement>(null)
  const [customizing, setCustomizing] = useState(false)
  const { settings, ready: settingsReady } = useSettings()
  const [bulkFont, setBulkFont] = useState<CardFont>(DEFAULT_FONT)
  const [fontNote, setFontNote] = useState<string | null>(null)
  const [filter, setFilter] = useState<CardFilter>('all')
  const [sort, setSort] = useState<CardSort>('newest')
  const [taggingId, setTaggingId] = useState<string | null>(null) // the card whose tag field is open
  const [editingId, setEditingId] = useState<string | null>(null) // the card being edited in the list
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [d, c, due] = await Promise.all([
      supabase.from('decks').select('*').eq('id', id).single(),
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
    setCards((c.data as Card[]).map((x) => ({ ...x, starred: x.starred ?? false, tags: x.tags ?? [] })))
    setDueCount(due.count ?? 0)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // New cards start in the user's preset font (Settings on the home screen).
  useEffect(() => {
    if (settingsReady) setFont(settings.default_font)
  }, [settingsReady, settings.default_font])

  async function saveEdit(c: Card, values: CardValues) {
    setError(null)
    const { error: e } = await supabase.from('cards').update(values).eq('id', c.id)
    if (e) return setError(e.message)
    patchCard(c.id, values)
    setEditingId(null)
  }

  async function applyFontToAll() {
    setError(null)
    setFontNote(null)
    const { error: e } = await supabase.from('cards').update({ font: bulkFont }).eq('deck_id', id)
    if (e) return setError(e.message)
    setFontNote(`Changed the font on all ${cards.length} cards.`)
    load()
  }

  function patchCard(cardId: string, patch: Partial<Card>) {
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, ...patch } : c)))
  }

  async function toggleStar(c: Card) {
    patchCard(c.id, { starred: !c.starred })
    const err = await saveStar(c.id, !c.starred)
    if (err) {
      patchCard(c.id, { starred: c.starred })
      setError(err)
    }
  }

  async function changeTags(c: Card, tags: string[]) {
    patchCard(c.id, { tags })
    const err = await saveTags(c.id, tags)
    if (err) {
      patchCard(c.id, { tags: c.tags })
      setError(err)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setAdding(true)
    setError(null)
    try {
      const { error } = await supabase.from('cards').insert({
        deck_id: id,
        front: front.trim(),
        back: back.trim(),
        source: 'manual',
        font,
      })
      if (error) throw error
      setFront('')
      setBack('')
      load()
    } catch (err) {
      setError(errorMessage(err, 'Could not add card.'))
    } finally {
      setAdding(false)
    }
  }

  async function updateStudySetting(patch: Partial<Pick<DeckType, 'show_both' | 'float_anim' | 'orientation'>>) {
    const { error } = await supabase.from('decks').update(patch).eq('id', id)
    if (error) return setError(errorMessage(error, 'Could not save setting.'))
    load()
  }

  async function removeDeck() {
    if (!confirm(`Delete "${deck?.name}" and all its cards? This also removes the coins earned from reviewing them.`)) return
    const { error: e } = await supabase.from('decks').delete().eq('id', id)
    if (e) return setError(e.message)
    navigate('/')
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
        <div className={`mini-card cardback${deck.icon_url ? ' has-icon' : ''} c${effectiveColor(id, deck.color)}`}>
          {deck.icon_url ? <img src={deck.icon_url} alt="" className="cardback-img" /> : <span className="mini-logo"><CardLogo id={logoFor(id, deck.logo)} target={36} /></span>}
        </div>
        <div className="hero-info">
          <h2>{deck.name}</h2>
          <p className="muted">
            {cards.length} card{cards.length === 1 ? '' : 's'} · {dueCount} due
          </p>
        </div>
        {dueCount > 0 ? (
          <Link className="button gold" to={`/decks/${id}/study`}>
            {dueCount} card{dueCount === 1 ? '' : 's'} due
          </Link>
        ) : cards.length > 0 ? (
          <Link className="button secondary" to={`/decks/${id}/study?all=1`}>
            0 cards due - study anyway?
          </Link>
        ) : (
          <span className="hero-done">Add some cards</span>
        )}
        {cards.length > 0 && (
          <Link className="button secondary" to={`/decks/${id}/preview`}>
            Preview cards
          </Link>
        )}
        <button className="secondary" onClick={() => setCustomizing((c) => !c)}>
          {customizing ? 'Done' : 'Customize'}
        </button>
      </div>

      {customizing && <DeckCustomize deckId={id} color={deck.color} iconUrl={deck.icon_url} logo={deck.logo ?? null} onSaved={load} />}

      <details className="panel more-options add-card" open={cards.length === 0 ? true : undefined}>
        <summary>+ Add a card</summary>
        <form onSubmit={add} className="stack">
          <div className="field-block">
            <FormatToolbar targetRef={frontRef} value={front} setValue={setFront}>
              <span className="fmt-sep" />
              <AttachmentPicker targetRef={frontRef} value={front} setValue={setFront} />
            </FormatToolbar>
            <textarea
              ref={frontRef}
              placeholder="Front (the question)"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              maxLength={5000}
              rows={2}
            />
            {HAS_IMAGE_RE.test(front) && (
              <div className="field-preview">
                <CardText text={front} userId={userId} onImageResize={(i, w) => setFront((t) => setImageWidth(t, i, w))} />
              </div>
            )}
          </div>

          <div className="field-block">
            <FormatToolbar targetRef={backRef} value={back} setValue={setBack}>
              <span className="fmt-sep" />
              <AttachmentPicker targetRef={backRef} value={back} setValue={setBack} />
            </FormatToolbar>
            <textarea
              ref={backRef}
              placeholder="Back (the answer)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              maxLength={5000}
              rows={2}
            />
            {HAS_IMAGE_RE.test(back) && (
              <div className="field-preview">
                <CardText text={back} userId={userId} onImageResize={(i, w) => setBack((t) => setImageWidth(t, i, w))} />
              </div>
            )}
          </div>

          <details className="format-help-details">
            <summary>Formatting</summary>
            <p className="format-help-inline">
              <code># heading</code> · <code>**bold**</code> · <code>*italic*</code> · <code>==highlight==</code> · <code>$inline math$</code> ·{' '}
              <code>$$block math$$</code> or <code>\[block math\]</code> · the picture icon inserts <code>![](url)</code> wherever your
              cursor is, and once it shows up below you can drag its corner to resize it
            </p>
          </details>
          <div className="row add-row">
            <label className="file-field">
              <span>Font</span>
              <select value={font} onChange={(e) => setFont(e.target.value as CardFont)}>
                {FONT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="gold" disabled={adding}>
              {adding ? 'Adding…' : 'Add card'}
            </button>
          </div>
        </form>
      </details>

      {cards.some((c) => c.starred || c.tags.length > 0) && <StudyFilter compact basePath={`/decks/${id}/study`} cards={cards} />}

      <h3>Cards ({cards.length})</h3>
      {cards.length === 0 ? (
        <div className="empty">
          <div className="big-mark big-mark-pixel" aria-hidden="true">
            <SlotSymbol id="club" />
          </div>
          <p>This deck is empty. Add a card or import a file above.</p>
        </div>
      ) : (
        <>
          <CardFilterBar cards={cards} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />
          {(() => {
            const shown = sortCards(
              cards.filter((c) => matchesFilter(c, filter)),
              sort,
            )
            const known = tagCounts(cards).map(([t]) => t)
            return shown.length === 0 ? (
              <p className="muted">No cards match.</p>
            ) : (
              <ul className="list">
                {shown.map((c) =>
                  editingId === c.id ? (
                    <li key={c.id} className="edit-li">
                      <CardEditor
                        title="Edit card"
                        submitLabel="Save changes"
                        initial={{ front: c.front, back: c.back, font: c.font }}
                        userId={userId}
                        onSave={(values) => saveEdit(c, values)}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                  <li key={c.id} className="row between nowrap">
                    <span className="row nowrap card-row-main">
                      <StarButton starred={c.starred} onToggle={() => toggleStar(c)} />
                      <span>
                        <span className="card-row-text">
                          <strong>{previewText(c.front)}</strong> <span className="muted">→ {previewText(c.back)}</span>
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
                    </span>
                    <span className="row nowrap">
                      <button className="link" onClick={() => setEditingId(c.id)}>
                        Edit
                      </button>
                      <button className="link danger" onClick={() => remove(c.id)}>
                        Delete
                      </button>
                    </span>
                  </li>
                  ),
                )}
              </ul>
            )
          })()}
        </>
      )}

      <details className="panel more-options">
        <summary>Deck options: study settings, card font, import</summary>
        <section className="panel">
          <h3>Study options</h3>
          <label className="row nowrap">
            <input
              type="checkbox"
              checked={deck.show_both}
              onChange={(e) => updateStudySetting({ show_both: e.target.checked })}
            />
            Keep the answer on screen with the question (no flip)
          </label>
          <label className="row nowrap">
            <input
              type="checkbox"
              checked={deck.float_anim}
              onChange={(e) => updateStudySetting({ float_anim: e.target.checked })}
            />
            Floating animation on the study card
          </label>
          <label className="file-field">
            <span>Card shape</span>
            <select
              value={deck.orientation ?? 'horizontal'}
              onChange={(e) => updateStudySetting({ orientation: e.target.value as 'horizontal' | 'vertical' })}
            >
              <option value="horizontal">Horizontal (wide)</option>
              <option value="vertical">Vertical (tall)</option>
            </select>
          </label>
        </section>

        <section className="panel">
          <h3>Card font</h3>
          <div className="row">
            <select value={bulkFont} onChange={(e) => setBulkFont(e.target.value as CardFont)} aria-label="Font for every card in this deck">
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <button className="secondary" onClick={applyFontToAll} disabled={cards.length === 0}>
              Apply to all {cards.length} cards
            </button>
          </div>
          {fontNote && <p className="notice">{fontNote}</p>}
        </section>

        <CsvImport deckId={id} onImported={load} font={settings.default_font} />

        <section className="panel">
          <h3>Delete deck</h3>
          <p className="muted">Removes this deck and all its cards. Coins earned from reviewing them are removed too.</p>
          <button className="red" onClick={removeDeck}>
            Delete this deck
          </button>
        </section>
      </details>
    </>
  )
}
