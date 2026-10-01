export const SUITS = ['♠', '♥', '♦', '♣']
export const DECK_COLOR_COUNT = 6

export const isRedSuit = (suit: string) => suit === '♥' || suit === '♦'

/** Stable index from a string, so each deck keeps the same look. */
export function hashIndex(id: string, mod: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

// Different salts so colour and suit vary independently.
export const deckSuit = (id: string) => SUITS[hashIndex(id + ':suit', SUITS.length)]
export const deckColor = (id: string) => hashIndex(id + ':color', DECK_COLOR_COUNT)

/** A deck's colour: the player's saved choice if they set one, otherwise a stable hash of its id. */
export const effectiveColor = (id: string, override: number | null | undefined) => override ?? deckColor(id)
