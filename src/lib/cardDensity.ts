/**
 * Big cards need smaller type. `density` buckets a card's text by how much of it there is
 * (characters, plus a penalty for each line break), from 1 (a short question, big type) to 4
 * (a wall of notes, small type with tight lines). The CSS classes dens-1..4 pick the sizes.
 */
export function density(text: string): 1 | 2 | 3 | 4 {
  const lines = text.split('\n').length - 1
  const weight = text.length + lines * 25
  if (weight <= 90) return 1
  if (weight <= 220) return 2
  if (weight <= 450) return 3
  return 4
}

/** True when the text has bullet or numbered lines, so the card should left-align instead of centering. */
export const hasList = (text: string) => /^[ \t]*([-*•]|\d+[.)])[ \t]+\S/m.test(text)

/** The face-text class names for a piece of card text. */
export function faceTextClass(text: string, font: string, densityOf: string = text) {
  return `face-text font-${font} dens-${density(densityOf)}${hasList(text) ? ' has-list' : ''}`
}
