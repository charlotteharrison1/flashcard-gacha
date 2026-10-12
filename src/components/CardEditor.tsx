import { useRef, useState, type FormEvent } from 'react'
import { FONT_OPTIONS, type CardFont } from '../lib/fonts'
import RichField, { type TextTarget } from './RichField'
import FormatToolbar from './FormatToolbar'
import AttachmentPicker from './AttachmentPicker'
import { TagAdder, TagChips } from './CardMeta'
import { MAX_TAGS } from '../lib/cardMeta'

export type CardValues = { front: string; back: string; font: CardFont; tags?: string[] }

/** Front/back/font editor used while reviewing, to fix a card or add a new one to the same deck. */
export default function CardEditor({
  title,
  submitLabel,
  initial,
  userId,
  knownTags = [],
  onSave,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial: CardValues
  userId: string
  /** Tags used elsewhere, offered as suggestions. Tags are only editable when `initial.tags` is given. */
  knownTags?: string[]
  onSave: (values: CardValues) => Promise<void>
  onCancel: () => void
}) {
  const [front, setFront] = useState(initial.front)
  const [back, setBack] = useState(initial.back)
  const [font, setFont] = useState<CardFont>(initial.font)
  const [tags, setTags] = useState(initial.tags)
  const [addingTag, setAddingTag] = useState(false)
  const [busy, setBusy] = useState(false)
  const frontRef = useRef<TextTarget>(null)
  const backRef = useRef<TextTarget>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setBusy(true)
    try {
      await onSave({ front: front.trim(), back: back.trim(), font, tags })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel card-editor">
      <h3>{title}</h3>
      <form onSubmit={submit} className="stack">
        <div className="field-block">
          <FormatToolbar targetRef={frontRef} value={front} setValue={setFront}>
            <span className="fmt-sep" />
            <AttachmentPicker targetRef={frontRef} value={front} setValue={setFront} />
          </FormatToolbar>
          <RichField
            targetRef={frontRef}
            value={front}
            onChange={setFront}
            userId={userId}
            className={`font-${font}`}
            placeholder="Front (the question)"
            onEscape={onCancel}
            autoFocus
          />
        </div>

        <div className="field-block">
          <FormatToolbar targetRef={backRef} value={back} setValue={setBack}>
            <span className="fmt-sep" />
            <AttachmentPicker targetRef={backRef} value={back} setValue={setBack} />
          </FormatToolbar>
          <RichField
            targetRef={backRef}
            value={back}
            onChange={setBack}
            userId={userId}
            className={`font-${font}`}
            placeholder="Back (the answer)"
            onEscape={onCancel}
          />
        </div>

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

        {tags && (
          <div className="row">
            <TagChips tags={tags} onRemove={(t) => setTags(tags.filter((x) => x !== t))} />
            {addingTag ? (
              <TagAdder existing={tags} suggestions={knownTags} onAdd={(t) => tags.length < MAX_TAGS && setTags([...tags, t])} onClose={() => setAddingTag(false)} />
            ) : (
              <button type="button" className="link" onClick={() => setAddingTag(true)}>
                + tag
              </button>
            )}
          </div>
        )}

        <div className="row">
          <button className="gold" disabled={busy || !front.trim() || !back.trim()}>
            {busy ? 'Saving…' : submitLabel}
          </button>
          <button type="button" className="link" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
