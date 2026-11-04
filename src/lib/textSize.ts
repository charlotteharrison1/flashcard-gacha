import { applyPref, loadPref } from './pref'

/** How large the text on study cards is, as a multiplier on the built-in size. CSS reads data-text-size. */
export const TEXT_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium (default)' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
] as const

export type TextSizeId = (typeof TEXT_SIZES)[number]['id']

const ids = TEXT_SIZES.map((s) => s.id)
export const loadTextSize = (): TextSizeId => loadPref('textSize', 'medium', ids) as TextSizeId
export const applyTextSize = (id: TextSizeId) => applyPref('textSize', 'textSize', id)
