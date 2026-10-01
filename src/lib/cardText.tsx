import { useEffect, useRef } from 'react'
import katex from 'katex'
import { resolveImagePath } from './storage'

/**
 * Renders flashcard text with a small, fixed set of markup:
 *   # / ## / ### heading     **bold**     *italic*     ==highlight==
 *   $inline math$            $$block math$$ or \[block math\]
 *   ![alt](url) inline picture, optionally sized with ![alt](url =300) (width in px)
 * `url` is usually a short relative path like "cards/<id>.png" (see uploadImage/resolveImagePath),
 * resolved here against the viewing user's own id, rather than a full URL sitting in the editable
 * text. Older cards with a full URL still render fine.
 * It's a line-based mini-parser, not a full Markdown engine — flashcards are short, and that
 * keeps the syntax predictable (no nested lists, links, etc. to worry about).
 */
type Props = {
  text: string
  userId: string
  /** When set, images render with a drag handle; dragging reports (image index in `text`, new width in px). */
  onImageResize?: (index: number, width: number) => void
}

export default function CardText({ text, userId, onImageResize }: Props) {
  let imgIndex = 0
  const nextImgIndex = () => imgIndex++
  return (
    <>
      {text.split('\n').map((line, i) => {
        const heading = /^(#{1,3})\s+(.*)/.exec(line)
        if (heading) {
          const level = heading[1].length
          return (
            <div key={i} className={`md-h md-h${level}`}>
              {renderLine(heading[2], userId, nextImgIndex, onImageResize)}
            </div>
          )
        }
        if (line.trim() === '') return <br key={i} />
        return <div key={i}>{renderLine(line, userId, nextImgIndex, onImageResize)}</div>
      })}
    </>
  )
}

// Tried in order at each position: an image (with an optional "=width" size), display math
// ($$ or \[ \]), then inline math ($...$). The image target is either a full http(s)/data URL
// (older cards) or a bare relative path like "cards/<id>.png" (current uploads). Anything
// matching none of these is plain text, formatted afterwards by renderInline.
// Keep the image alternative's URL/width shape in sync with IMG_ONLY_RE below.
const TOKEN_RE =
  /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|[\w./-]+)(?:\s+=(\d+))?\)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$/g

function renderLine(line: string, userId: string, nextImgIndex: () => number, onImageResize?: (index: number, width: number) => void) {
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m.index! > last) nodes.push(...renderInline(line.slice(last, m.index), i++))
    if (m[2] !== undefined) {
      const idx = nextImgIndex()
      nodes.push(
        <ResizableImage
          key={i++}
          src={resolveImagePath(userId, m[2])}
          alt={m[1]}
          width={m[3] ? Number(m[3]) : undefined}
          index={idx}
          onResize={onImageResize}
        />,
      )
    } else {
      const display = m[4] !== undefined || m[5] !== undefined
      nodes.push(<MathSpan key={i++} latex={m[4] ?? m[5] ?? m[6] ?? ''} display={display} />)
    }
    last = m.index! + m[0].length
  }
  if (last < line.length) nodes.push(...renderInline(line.slice(last), i++))
  return nodes
}

const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*|==(.+?)==/g

/** Applies **bold**, *italic* and ==highlight== to a run of plain text (no images or math in it). */
function renderInline(text: string, keyBase: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index! > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) nodes.push(<strong key={`${keyBase}-${i++}`}>{m[1]}</strong>)
    else if (m[2] !== undefined) nodes.push(<em key={`${keyBase}-${i++}`}>{m[2]}</em>)
    else
      nodes.push(
        <mark key={`${keyBase}-${i++}`} className="md-mark">
          {m[3]}
        </mark>,
      )
    last = m.index! + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return [<span key={keyBase}>{nodes}</span>]
}

/** A plain <img>, or — when `onResize` is given (the card editor's live preview) — one with a
 *  drag handle in the corner that reports its new width so the caller can save it back to the text. */
function ResizableImage({
  src,
  alt,
  width,
  index,
  onResize,
}: {
  src: string
  alt: string
  width?: number
  index: number
  onResize?: (index: number, width: number) => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!onResize || !ref.current) return
    const el = ref.current
    const observer = new ResizeObserver(() => onResize(index, Math.round(el.getBoundingClientRect().width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [onResize, index])

  const style = width ? { width: `${width}px` } : undefined
  if (!onResize) return <img src={src} alt={alt} className="md-img" loading="lazy" style={style} />
  return (
    <span ref={ref} className="md-img-resizable" style={style}>
      <img src={src} alt={alt} loading="lazy" />
    </span>
  )
}

// Must match TOKEN_RE's image alternative — kept separate because editing text (outside React)
// doesn't need the math alternatives at all.
const IMG_ONLY_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|[\w./-]+)(?:\s+=(\d+))?\)/g

/** Rewrites the Nth image in `text` (0-indexed, same order CardText renders them) to carry `width`. */
export function setImageWidth(text: string, index: number, width: number): string {
  let i = -1
  return text.replace(IMG_ONLY_RE, (whole, alt, src) => {
    i++
    return i === index ? `![${alt}](${src} =${width})` : whole
  })
}

function MathSpan({ latex, display }: { latex: string; display: boolean }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: display,
    trust: false, // never honor \href, \includegraphics etc. — this text can come from an uploaded CSV
  })
  const Tag = display ? 'div' : 'span'
  return <Tag className={display ? 'md-math-block' : 'md-math'} dangerouslySetInnerHTML={{ __html: html }} />
}
