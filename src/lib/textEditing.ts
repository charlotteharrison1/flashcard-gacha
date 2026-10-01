/** Wraps the current selection (or inserts a placeholder) in a textarea with marker text, e.g. **bold**. */
export function wrapSelection(
  el: HTMLTextAreaElement | null,
  value: string,
  setValue: (v: string) => void,
  before: string,
  after: string = before,
  placeholder = '',
) {
  if (!el) return
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const selected = value.slice(start, end) || placeholder
  setValue(value.slice(0, start) + before + selected + after + value.slice(end))

  const cursorStart = start + before.length
  const cursorEnd = cursorStart + selected.length
  // The textarea's value hasn't repainted yet on this tick; set the selection on the next one.
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursorStart, cursorEnd)
  })
}

/** Inserts text at the cursor (replacing any selection), e.g. dropping in an inline image. */
export function insertAtCursor(el: HTMLTextAreaElement | null, value: string, setValue: (v: string) => void, text: string) {
  if (!el) return
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  setValue(value.slice(0, start) + text + value.slice(end))

  const pos = start + text.length
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

/** Adds a prefix (e.g. "# ") to the start of whichever line the cursor is on. */
export function prefixLine(el: HTMLTextAreaElement | null, value: string, setValue: (v: string) => void, prefix: string) {
  if (!el) return
  const pos = el.selectionStart ?? value.length
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1
  setValue(value.slice(0, lineStart) + prefix + value.slice(lineStart))

  const newPos = pos + prefix.length
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(newPos, newPos)
  })
}
