import katex from 'katex'
import { resolveImagePath } from './storage'

/**
 * Renders flashcard text with a small, fixed set of markup:
 *   # / ## / ### heading     **bold**     *italic*     ==highlight==
 *   $inline math$            $$block math$$ or \[block math\]
 *   ![alt](url) inline picture — `url` is usually a short relative path like "cards/<id>.png"
 *   (see uploadImage/resolveImagePath), resolved here against the viewing user's own id, rather
 *   than a full URL sitting in the editable text. Older cards with a full URL still render fine.
 * It's a line-based mini-parser, not a full Markdown engine — flashcards are short, and that
 * keeps the syntax predictable (no nested lists, links, etc. to worry about).
 */
export default function CardText({ text, userId }: { text: string; userId: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const heading = /^(#{1,3})\s+(.*)/.exec(line)
        if (heading) {
          const level = heading[1].length
          return (
            <div key={i} className={`md-h md-h${level}`}>
              {renderLine(heading[2], userId)}
            </div>
          )
        }
        if (line.trim() === '') return <br key={i} />
        return <div key={i}>{renderLine(line, userId)}</div>
      })}
    </>
  )
}

// Tried in order at each position: an image, display math ($$ or \[ \]), then inline math ($...$).
// The image target is either a full http(s)/data URL (older cards) or a bare relative path like
// "cards/<id>.png" (current uploads). Anything matching none of these is plain text, formatted
// afterwards by renderInline.
const TOKEN_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|[\w./-]+)\)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$/g

function renderLine(line: string, userId: string) {
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m.index! > last) nodes.push(...renderInline(line.slice(last, m.index), i++))
    if (m[2] !== undefined) {
      nodes.push(<img key={i++} src={resolveImagePath(userId, m[2])} alt={m[1]} className="md-img" loading="lazy" />)
    } else {
      const display = m[3] !== undefined || m[4] !== undefined
      nodes.push(<MathSpan key={i++} latex={m[3] ?? m[4] ?? m[5] ?? ''} display={display} />)
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

function MathSpan({ latex, display }: { latex: string; display: boolean }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: display,
    trust: false, // never honor \href, \includegraphics etc. — this text can come from an uploaded CSV
  })
  const Tag = display ? 'div' : 'span'
  return <Tag className={display ? 'md-math-block' : 'md-math'} dangerouslySetInnerHTML={{ __html: html }} />
}
