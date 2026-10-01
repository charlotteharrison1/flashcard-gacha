import { useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { uploadImage } from '../lib/storage'
import { errorMessage } from '../lib/errors'
import { insertAtCursor } from '../lib/textEditing'

type Props = {
  targetRef: RefObject<HTMLTextAreaElement | null>
  value: string
  setValue: (v: string) => void
}

/** Uploads a picture and drops it inline into the text as ![](url), right at the cursor. */
export default function AttachmentPicker({ targetRef, value, setValue }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const { path } = await uploadImage(file, 'cards')
      insertAtCursor(targetRef.current, value, setValue, `![](${path})`)
    } catch (err) {
      setError(errorMessage(err, 'Upload failed.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="attach-row">
      <button type="button" className="fmt-btn" title="Insert a picture" onClick={() => inputRef.current?.click()} disabled={busy}>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="attach-icon">
          <rect x="2" y="3.5" width="12" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5.3" cy="6.3" r="1" fill="currentColor" />
          <path
            d="m2.5 11 3.3-3.3 2 2 2.3-2.7 3.4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
      {busy && <span className="attach-status muted">Uploading…</span>}
      {error && <span className="attach-status error">{error}</span>}
    </span>
  )
}
