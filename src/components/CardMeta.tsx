import { useState } from 'react'
import { MAX_TAGS, normalizeTag } from '../lib/cardMeta'
import { SlotSymbol } from './SlotSymbol'

/** A star you can click to mark a card. Grey when off, gold when on. */
export function StarButton({ starred, onToggle, hint }: { starred: boolean; onToggle: () => void; hint?: string }) {
  return (
    <button
      type="button"
      className={`star-btn${starred ? ' on' : ''}`}
      onClick={onToggle}
      aria-pressed={starred}
      title={`${starred ? 'Unstar' : 'Star'} this card${hint ? ` (${hint})` : ''}`}
    >
      <SlotSymbol id="star" />
    </button>
  )
}

/** A row of tag chips. Clicking a chip calls onPick (e.g. to filter by it); the x removes it. */
export function TagChips({ tags, onRemove, onPick }: { tags: string[]; onRemove?: (tag: string) => void; onPick?: (tag: string) => void }) {
  if (tags.length === 0) return null
  return (
    <span className="tag-chips">
      {tags.map((t) => (
        <span className="tag-chip" key={t}>
          {onPick ? (
            <button type="button" className="tag-pick" onClick={() => onPick(t)} title={`Show only #${t}`}>
              #{t}
            </button>
          ) : (
            <span>#{t}</span>
          )}
          {onRemove && (
            <button type="button" className="tag-x" onClick={() => onRemove(t)} aria-label={`Remove tag ${t}`}>
              ×
            </button>
          )}
        </span>
      ))}
    </span>
  )
}

/** A one-field tag editor: Enter adds the tag, Escape (or the x) closes it. */
export function TagAdder({
  existing,
  suggestions,
  onAdd,
  onClose,
  autoFocus = true,
}: {
  existing: string[]
  suggestions: string[]
  onAdd: (tag: string) => void
  onClose: () => void
  autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const listId = `tag-suggestions-${existing.join('-')}`
  const full = existing.length >= MAX_TAGS

  function submit() {
    const tag = normalizeTag(text)
    if (tag && !existing.includes(tag)) onAdd(tag)
    setText('')
    onClose()
  }

  return (
    <span className="tag-adder">
      <input
        autoFocus={autoFocus}
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        placeholder={full ? `Up to ${MAX_TAGS} tags` : 'Tag, then Enter'}
        maxLength={30}
        disabled={full}
        aria-label="Add a tag"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !existing.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
      <button type="button" className="link" onClick={onClose}>
        Cancel
      </button>
    </span>
  )
}
