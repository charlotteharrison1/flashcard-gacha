/** How big a deck is drawn on the home screen. Wide = two cards across; big = twice as wide and twice as tall; long = the full width of the shelf. */
export const DECK_SIZES = [
  { id: 'normal', label: 'Normal', hint: '1 × 1' },
  { id: 'wide', label: 'Wide', hint: '2 × 1' },
  { id: 'big', label: 'Big', hint: '2 × 2' },
  { id: 'long', label: 'Long', hint: 'full width' },
] as const

export type DeckSize = (typeof DECK_SIZES)[number]['id']

export const sizeOf = (value: string | null | undefined): DeckSize => (DECK_SIZES.some((s) => s.id === value) ? (value as DeckSize) : 'normal')

/** Roughly how many screen pixels wide the pixel logo should be at each size. */
export const logoTargetFor = (size: DeckSize) => (size === 'big' ? 72 : size === 'wide' || size === 'long' ? 48 : 36)
