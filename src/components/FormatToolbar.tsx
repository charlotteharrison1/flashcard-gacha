import type { ReactNode, RefObject } from 'react'
import { prefixLine, wrapSelection } from '../lib/textEditing'

type Props = {
  targetRef: RefObject<HTMLTextAreaElement | null>
  value: string
  setValue: (v: string) => void
  /** Extra buttons appended after the formatting ones, e.g. the picture attacher. */
  children?: ReactNode
}

/** A small text-editor-style toolbar: wraps the textarea's selection in markdown/math markers. */
export default function FormatToolbar({ targetRef, value, setValue, children }: Props) {
  const wrap = (before: string, after: string, placeholder: string) => () =>
    wrapSelection(targetRef.current, value, setValue, before, after, placeholder)

  return (
    <div className="fmt-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" className="fmt-btn" title="Bold" onClick={wrap('**', '**', 'bold')}>
        <b>B</b>
      </button>
      <button type="button" className="fmt-btn" title="Italic" onClick={wrap('*', '*', 'italic')}>
        <i>I</i>
      </button>
      <button type="button" className="fmt-btn" title="Highlight" onClick={wrap('==', '==', 'highlight')}>
        <mark className="md-mark">H</mark>
      </button>
      <button
        type="button"
        className="fmt-btn"
        title="Heading"
        onClick={() => prefixLine(targetRef.current, value, setValue, '# ')}
      >
        #
      </button>
      <button type="button" className="fmt-btn" title="Math" onClick={wrap('$', '$', 'x^2')}>
        ∑
      </button>
      {children}
    </div>
  )
}
