import { useLayoutEffect, useRef, type PointerEvent, type RefObject } from 'react'
import { IMG_ONLY_RE } from '../lib/cardText'
import { resolveImagePath } from '../lib/storage'

/** What the formatting toolbar needs from a text field: a textarea satisfies it, and so does RichField. */
export interface TextTarget {
  selectionStart: number | null
  selectionEnd: number | null
  setSelectionRange(start: number, end: number): void
  focus(): void
}

const tokenOf = (alt: string, src: string, width?: string | number) => `![${alt}](${src}${width ? ` =${width}` : ''})`

/** The text this DOM represents: text nodes as-is, each picture as its ![caption](path =w) token. */
function ser(parent: Node): string {
  let s = ''
  parent.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) s += n.textContent
    else if (n instanceof HTMLElement) {
      if (n.dataset.md) s += n.dataset.md
      else if (n.tagName === 'BR') s += '\n'
      else s += (s && !s.endsWith('\n') ? '\n' : '') + ser(n) // a <div> a browser slipped in for a new line
    }
  })
  return s
}

const nodeLen = (n: Node) => (n.nodeType === Node.TEXT_NODE ? n.textContent!.length : (n as HTMLElement).dataset?.md?.length ?? ser(n).length)

function pictureNode(alt: string, src: string, width: string | undefined, userId: string) {
  const el = document.createElement('span')
  el.className = 'rf-img'
  el.contentEditable = 'false'
  el.dataset.alt = alt
  el.dataset.src = src
  el.dataset.md = tokenOf(alt, src, width)
  const box = el.appendChild(document.createElement('span'))
  box.className = 'rf-box'
  const img = box.appendChild(document.createElement('img'))
  img.src = resolveImagePath(userId, src)
  img.alt = alt
  img.draggable = false
  if (width) img.style.width = `${width}px`
  box.appendChild(document.createElement('span')).className = 'rf-handle'
  if (alt) el.appendChild(document.createElement('span')).className = 'md-caption'
  if (alt) el.lastElementChild!.textContent = alt
  return el
}

function build(root: HTMLElement, value: string, userId: string) {
  root.textContent = ''
  let last = 0
  for (const m of value.matchAll(IMG_ONLY_RE)) {
    if (m.index > last) root.append(value.slice(last, m.index))
    root.append(pictureNode(m[1], m[2], m[3], userId))
    last = m.index + m[0].length
  }
  if (last < value.length) root.append(value.slice(last))
}

/**
 * A text field where pictures show up in place, at the spot in the text where they sit, with a corner
 * handle to resize them. It's still the same markdown text underneath (`value`), so everything else
 * (the toolbar, saving, CardText) is unchanged: the picture is one atomic chunk that backspace removes whole.
 */
export default function RichField({
  value,
  onChange,
  userId,
  targetRef,
  className = '',
  placeholder,
  onEscape,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  userId: string
  targetRef: RefObject<TextTarget | null>
  className?: string
  placeholder?: string
  onEscape?: () => void
  autoFocus?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<string | null>(null) // the text the DOM currently shows
  const drag = useRef<{ box: HTMLElement; startX: number; startW: number } | null>(null)

  // Rebuild the DOM only when the text changed from outside (toolbar, picture insert); typing edits it directly.
  useLayoutEffect(() => {
    const root = rootRef.current!
    if (value !== lastRef.current) {
      build(root, value, userId)
      lastRef.current = value
    }
  }, [value, userId])

  useLayoutEffect(() => {
    const root = rootRef.current!
    const range = () => {
      const sel = getSelection()
      if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return null
      return sel.getRangeAt(0)
    }
    const offset = (node: Node, off: number) => {
      const r = document.createRange()
      r.selectNodeContents(root)
      r.setEnd(node, off)
      return ser(r.cloneContents()).length
    }
    const locate = (pos: number): [Node, number] => {
      let acc = 0
      for (let i = 0; i < root.childNodes.length; i++) {
        const n = root.childNodes[i]
        const len = nodeLen(n)
        if (n.nodeType === Node.TEXT_NODE) {
          if (pos <= acc + len) return [n, pos - acc]
        } else if (pos <= acc + len) return [root, pos - acc <= 0 ? i : i + 1]
        acc += len
      }
      return [root, root.childNodes.length]
    }
    targetRef.current = {
      get selectionStart() {
        const r = range()
        return r ? offset(r.startContainer, r.startOffset) : ser(root).length
      },
      get selectionEnd() {
        const r = range()
        return r ? offset(r.endContainer, r.endOffset) : ser(root).length
      },
      setSelectionRange(start, end) {
        const r = document.createRange()
        r.setStart(...locate(start))
        r.setEnd(...locate(end))
        const sel = getSelection()
        sel?.removeAllRanges()
        sel?.addRange(r)
      },
      focus: () => root.focus(),
    }
    if (autoFocus) root.focus()
  }, [targetRef, autoFocus])

  const emit = () => {
    const v = ser(rootRef.current!)
    lastRef.current = v
    onChange(v)
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    const handle = e.target as HTMLElement
    if (!handle.classList.contains('rf-handle')) return
    e.preventDefault()
    const box = handle.parentElement!
    handle.setPointerCapture(e.pointerId)
    drag.current = { box, startX: e.clientX, startW: box.getBoundingClientRect().width }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const max = rootRef.current!.clientWidth - 24
    const w = Math.round(Math.min(max, Math.max(40, d.startW + e.clientX - d.startX)))
    d.box.querySelector('img')!.style.width = `${w}px`
  }

  function up() {
    const d = drag.current
    drag.current = null
    if (!d) return
    const pic = d.box.parentElement!
    pic.dataset.md = tokenOf(pic.dataset.alt!, pic.dataset.src!, Math.round(d.box.getBoundingClientRect().width))
    emit()
  }

  return (
    <div
      ref={rootRef}
      className={`rf ${className}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onInput={emit}
      onKeyDown={(e) => e.key === 'Escape' && onEscape?.()}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    />
  )
}
