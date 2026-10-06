import type { SpriteId } from './sprites'
import { deckSuit } from './theme'

/** The pixel-art logos a deck's card back can wear. Keep in sync with the check constraint in 0021_deck_logo.sql. */
export const DECK_LOGOS = [
  { id: 'spade', label: 'Spade' },
  { id: 'heart', label: 'Heart' },
  { id: 'club', label: 'Club' },
  { id: 'suitDiamond', label: 'Diamond' },
  { id: 'star', label: 'Star' },
  { id: 'cherry', label: 'Cherries' },
  { id: 'seven', label: 'Lucky 7' },
  { id: 'bar', label: 'BAR' },
  { id: 'diamond', label: 'Gem' },
  { id: 'bell', label: 'Bell' },
  { id: 'coin', label: 'Coin' },
] as const satisfies readonly { id: SpriteId; label: string }[]

export type DeckLogoId = (typeof DECK_LOGOS)[number]['id']

const SUIT_SPRITE: Record<string, DeckLogoId> = { '♠': 'spade', '♥': 'heart', '♦': 'suitDiamond', '♣': 'club' }

/** The deck's chosen logo, or (if it hasn't picked one) the suit its id happens to hash to. */
export function logoFor(deckId: string, logo: string | null | undefined): DeckLogoId {
  if (logo && DECK_LOGOS.some((l) => l.id === logo)) return logo as DeckLogoId
  return SUIT_SPRITE[deckSuit(deckId)] ?? 'spade'
}
