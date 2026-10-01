/** Converts simple Anki-style HTML fields into our markdown syntax, for plain-text imports with `#html:true`. */
export function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<(p|div)[^>]*>/gi, '')
    .replace(/<(b|strong)>/gi, '**')
    .replace(/<\/(b|strong)>/gi, '**')
    .replace(/<(i|em)>/gi, '*')
    .replace(/<\/(i|em)>/gi, '*')
    .replace(/<[^>]+>/g, '') // strip anything else (spans, images we can't resolve here, etc.)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
