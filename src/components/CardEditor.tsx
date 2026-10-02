import { useRef, useState, type FormEvent } from 'react'
import { FONT_OPTIONS, type CardFont } from '../lib/fonts'
import CardText, { setImageWidth } from '../lib/cardText'
import FormatToolbar from './FormatToolbar'
import AttachmentPicker from './AttachmentPicker'

export type CardValues = { front: string; back: string; font: CardFont }

const HAS_IMAGE_RE = /!\[[^\]]*\]\(/

/** Front/back/font editor used while reviewing, to fix a card or add a new one to the same deck. */
export default function CardEditor({
  title,
  submitLabel,
  initial,
  userId,
  onSave,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial: CardValues
  userId: string
  onSave: (values: CardValues) => Promise<void>
  onCancel: () => void
}) {
  const [front, setFront] = useState(initial.front)
  const [back, setBack] = useState(initial.back)
  const [font, setFont] = useState<CardFont>(initial.font)
  const [busy, setBusy] = useState(false)
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const backRef = useRef<HTMLTextAreaElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setBusy(true)
    try {
      await onSave({ front: front.trim(), back: back.trim(), font })
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
          <textarea
            ref={frontRef}
            placeholder="Front (the question)"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
            maxLength={5000}
            rows={3}
            autoFocus
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
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
            maxLength={5000}
            rows={4}
          />
          {HAS_IMAGE_RE.test(back) && (
            <div className="field-preview">
              <CardText text={back} userId={userId} onImageResize={(i, w) => setBack((t) => setImageWidth(t, i, w))} />
            </div>
          )}
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
