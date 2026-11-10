import { Fragment, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { resolveImagePath } from './storage'
import { HIGHLIGHT_IDS } from './highlights'

/**
 * Renders flashcard text with a small, fixed set of markup:
 *   # / ## / ### heading     **bold**     *italic*     ==highlight==
 *   $inline math$            $$block math$$ or \[block math\]
 *   ![caption](url) inline picture (the text in [] is shown under it), optionally sized with ![alt](url =300) (width in px)
 *   - bullet / * bullet / • bullet, and 1. numbered lines (indent two spaces per level, up to three levels)
 *   `inline code` (also ``double`` and ```triple``` on one line), and a fenced block: a line with ```, the code, a line with ```
 *   Code is shown exactly as typed: nothing inside it is treated as maths, bold, pictures, etc.
 * `url` is usually a short relative path like "cards/<id>.png" (see uploadImage/resolveImagePath),
 * resolved here against the viewing user's own id, rather than a full URL sitting in the editable
 * text. Older cards with a full URL still render fine.
 * It's a line-based mini-parser, not a full Markdown engine — flashcards are short, and that
 * keeps the syntax predictable (lists are just indented lines, no links, etc. to worry about).
 */
type Props = {
  text: string
  userId: string
}

/**
 * A highlight that runs over several lines (select a few paragraphs, press H) is rewritten as one highlight per line,
 * since the renderer works a line at a time. Blank lines are left alone, and a line's bullet, number or heading marker stays outside the highlight.
 * Fenced code blocks are not touched.
 */
function spreadHighlights(text: string): string {
  const span = new RegExp(`==(?:\\{(${HIGHLIGHT_IDS})\\})?([\\s\\S]+?)==`, 'g')
  return text
    .split(/(^[ \t]*```[\w+-]*[ \t]*$)/m) // odd pieces are the fence lines; the code between two fences is left as it is
    .map((piece, i, all) => {
      const inCode = all.slice(0, i).filter((_, j) => j % 2 === 1).length % 2 === 1
      if (i % 2 === 1 || inCode || !piece.includes('==')) return piece
      return piece.replace(span, (m, color: string | undefined, inner: string) => {
        if (!inner.includes('\n')) return m
        const open = color ? `=={${color}}` : '=='
        return inner
          .split('\n')
          .map((line) => {
            if (!line.trim()) return line
            const prefix = /^[ \t]*(?:#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)?/.exec(line)![0]
            return prefix + open + line.slice(prefix.length) + '=='
          })
          .join('\n')
      })
    })
    .join('')
}

export default function CardText({ text, userId }: Props) {
  const lines = spreadHighlights(text).split('\n')
  const out: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // A fenced block: everything up to the closing ``` line is code, shown exactly as typed.
    if (/^\s*```\s*[\w+-]*\s*$/.test(line)) {
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) body.push(lines[j++])
      out.push(
        <pre key={i} className="md-code-block">
          <code>{body.join('\n')}</code>
        </pre>,
      )
      i = j // skip the closing fence (or the end, if it was never closed)
      continue
    }

    const heading = /^(#{1,3})\s+(.*)/.exec(line)
    if (heading) {
      const level = heading[1].length
      out.push(
        <div key={i} className={`md-h md-h${level}`}>
          {renderRich(heading[2], userId)}
        </div>,
      )
      continue
    }
    const item = LIST_RE.exec(line)
    if (item) {
      const level = Math.min(3, Math.floor(item[1].replace(/\t/g, '  ').length / 2))
      const numbered = /^\d/.test(item[2])
      out.push(
        <div key={i} className="md-li" style={{ '--lvl': level } as React.CSSProperties}>
          {numbered ? <span className="md-num">{item[2]}</span> : <span className="md-bullet" aria-hidden="true" />}
          <span className="md-li-text">{renderRich(item[3], userId)}</span>
        </div>,
      )
      continue
    }
    if (line.trim() === '') out.push(<br key={i} />)
    else out.push(<div key={i}>{renderRich(line, userId)}</div>)
  }
  return <>{out}</>
}

// `code`, ``code``, or ```code``` on one line. Tried before everything else so what's inside stays literal.
const CODE_RE = /```([^`\n]+?)```|``([^\n]+?)``|`([^`\n]+?)`/g

/** One line of rich text: code spans, pictures and maths are set aside first, then bold, italic and highlight are applied around them. */
function renderRich(line: string, userId: string): ReactNode[] {
  return renderLine(line, userId)
}

// A bullet (-, * or •) or numbered (1. or 1)) line: indent, marker, then the text.
const LIST_RE = /^([ \t]*)([-*•]|\d+[.)])[ \t]+(.*)$/

// Tried in order at each position: an image (with an optional "=width" size), display math
// ($$ or \[ \]), then inline math ($...$). The image target is either a full http(s)/data URL
// (older cards) or a bare relative path like "cards/<id>.png" (current uploads). Anything
// matching none of these is plain text, formatted afterwards by renderInline.
// Keep the image alternative's URL/width shape in sync with IMG_ONLY_RE below.
const TOKEN_RE =
  /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|[\w./-]+)(?:\s+=(\d+))?\)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$/g

// Pictures and maths are swapped for placeholder characters before **bold**, *italic* and ==highlight== (optionally coloured: =={pink}highlight==) are applied,
// so formatting can wrap around them: "**the answer is $x^2$**" is bold all the way through. They're put back afterwards.
const MARK_OPEN = '\uE000'
const MARK_CLOSE = '\uE001'
const MARK_RE = /\uE000(\d+)\uE001/g

function renderLine(line: string, userId: string) {
  const tokens: React.ReactNode[] = []
  // `code` is set aside first (so what's inside stays literal), then pictures and maths; each leaves a placeholder behind.
  const codeMasked = line.replace(CODE_RE, (_m, a?: string, b?: string, c?: string) => {
    tokens.push(
      <code key={`t${tokens.length}`} className="md-code">
        {(a ?? b ?? c ?? '').trim()}
      </code>,
    )
    return `${MARK_OPEN}${tokens.length - 1}${MARK_CLOSE}`
  })
  const masked = codeMasked.replace(TOKEN_RE, (...m: (string | undefined)[]) => {
    const key = `t${tokens.length}`
    if (m[2] !== undefined) {
      tokens.push(<Picture key={key} src={resolveImagePath(userId, m[2])} alt={m[1] ?? ''} width={m[3] ? Number(m[3]) : undefined} />)
    } else {
      const display = m[4] !== undefined || m[5] !== undefined
      tokens.push(<MathSpan key={key} latex={m[4] ?? m[5] ?? m[6] ?? ''} display={display} />)
    }
    return `${MARK_OPEN}${tokens.length - 1}${MARK_CLOSE}`
  })
  return renderFormatted(masked, tokens, 'f')
}

const INLINE_RE = new RegExp(`\\*\\*(.+?)\\*\\*|\\*(.+?)\\*|==(?:\\{(${HIGHLIGHT_IDS})\\})?(.+?)==`, 'g') // ==text== or =={pink}text==

/** Puts the saved pictures and maths back into a run of plain text. */
function withTokens(text: string, tokens: React.ReactNode[], keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(MARK_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    out.push(<Fragment key={`${keyBase}-m${n++}`}>{tokens[Number(m[1])]}</Fragment>)
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Applies **bold**, *italic* and ==highlight== (optionally coloured: =={pink}highlight==) (which can nest, and can contain pictures and maths). */
function renderFormatted(text: string, tokens: React.ReactNode[], keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index! > last) nodes.push(...withTokens(text.slice(last, m.index), tokens, `${keyBase}-${i++}`))
    const key = `${keyBase}-${i++}`
    if (m[1] !== undefined) nodes.push(<strong key={key}>{renderFormatted(m[1], tokens, key)}</strong>)
    else if (m[2] !== undefined) nodes.push(<em key={key}>{renderFormatted(m[2], tokens, key)}</em>)
    else
      nodes.push(
        <mark key={key} className="md-mark" data-c={m[3]}>
          {renderFormatted(m[4], tokens, key)}
        </mark>,
      )
    last = m.index! + m[0].length
  }
  if (last < text.length) nodes.push(...withTokens(text.slice(last), tokens, `${keyBase}-${i++}`))
  return [<span key={keyBase}>{nodes}</span>]
}

function Picture({ src, alt, width }: { src: string; alt: string; width?: number }) {
  return (
    <span className="md-fig">
      <img src={src} alt={alt} className="md-img" loading="lazy" style={width ? { width: `${width}px` } : undefined} />
      {alt && <span className="md-caption">{alt}</span>}
    </span>
  )
}

// Must match TOKEN_RE's image alternative — kept separate because editing text (outside React)
// doesn't need the math alternatives at all.
export const IMG_ONLY_RE = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+|[\w./-]+)(?:\s+=(\d+))?\)/g

function MathSpan({ latex, display }: { latex: string; display: boolean }) {
  const html = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: display,
    trust: false, // never honor \href, \includegraphics etc. — this text can come from an uploaded CSV
  })
  const Tag = display ? 'div' : 'span'
  return <Tag className={display ? 'md-math-block' : 'md-math'} dangerouslySetInnerHTML={{ __html: html }} />
}
