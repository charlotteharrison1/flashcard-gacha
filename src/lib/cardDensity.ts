/** True when the text has bullet or numbered lines, so the card should left-align instead of centering. */
export const hasList = (text: string) => /^[ \t]*([-*•]|\d+[.)])[ \t]+\S/m.test(text)

/** The face-text class names for a piece of card text. (Its size is set by FitScroll, which shrinks long text to fit.) */
export function faceTextClass(text: string, font: string) {
  return `face-text font-${font}${hasList(text) ? ' has-list' : ''}`
}
