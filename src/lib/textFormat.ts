/** Converts simple Anki-style HTML fields into our markdown syntax, for plain-text imports with `#html:true`. */
export function htmlToText(s: string): string {
  // Anki's "Cards in Plain Text" export gives each card as rendered from its template: wrapped in
  // <script>/<style>/<link> tags, with "Question" / "Answer" label spans, and the answer side repeating
  // the question above it. Keep just what follows the "Answer" label, and drop the scaffolding.
  const answerLabel = /<span[^>]*class=["']?label["']?[^>]*>\s*Answer\s*<\/span>/i.exec(s)
  if (answerLabel) s = s.slice(answerLabel.index + answerLabel[0].length)
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<span[^>]*class=["']?label["']?[^>]*>[\s\S]*?<\/span>/gi, '')
    // A text export holds only a picture's file name, not the picture, so keep the name as text.
    .replace(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, (_m, a, b, c) => a ?? b ?? c ?? '')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/(li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<(p|div)[^>]*>/gi, '')
    .replace(/<(b|strong)>/gi, '**')
    .replace(/<\/(b|strong)>/gi, '**')
    .replace(/<(i|em)>/gi, '*')
    .replace(/<\/(i|em)>/gi, '*')
    .replace(/<[^>]+>/g, '') // strip anything else (spans, etc.)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
