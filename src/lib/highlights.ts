/** The highlight colours you can choose while editing a card: six bright and six softer pastel ones. A card's text marks them as =={pink}text==. */
export const HIGHLIGHTS = [
  { id: 'yellow', label: 'Yellow', color: '#ffe14d', group: 'Bright' },
  { id: 'orange', label: 'Orange', color: '#ffb04d', group: 'Bright' },
  { id: 'pink', label: 'Pink', color: '#ff7eb6', group: 'Bright' },
  { id: 'green', label: 'Green', color: '#5ce07f', group: 'Bright' },
  { id: 'blue', label: 'Blue', color: '#5cc8ff', group: 'Bright' },
  { id: 'purple', label: 'Purple', color: '#b794ff', group: 'Bright' },
  { id: 'cream', label: 'Cream', color: '#fff1a6', group: 'Pastel' },
  { id: 'peach', label: 'Peach', color: '#ffd2b3', group: 'Pastel' },
  { id: 'rose', label: 'Rose', color: '#ffc7de', group: 'Pastel' },
  { id: 'mint', label: 'Mint', color: '#c9f2c4', group: 'Pastel' },
  { id: 'sky', label: 'Sky', color: '#c2e4ff', group: 'Pastel' },
  { id: 'lilac', label: 'Lilac', color: '#dccdff', group: 'Pastel' },
] as const

export type HighlightId = (typeof HIGHLIGHTS)[number]['id']

/** For the card-text parser: matches a colour name inside ==...==. */
export const HIGHLIGHT_IDS = HIGHLIGHTS.map((h) => h.id).join('|')

const KEY = 'highlightColor'

/** The colour the H button applies: whichever you picked last. */
export function loadHighlight(): HighlightId {
  try {
    const saved = localStorage.getItem(KEY)
    if (HIGHLIGHTS.some((h) => h.id === saved)) return saved as HighlightId
  } catch {
    // storage blocked: use the default
  }
  return 'yellow'
}

export function saveHighlight(id: HighlightId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
}
