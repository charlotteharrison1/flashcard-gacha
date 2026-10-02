import type { CardFont } from './fonts'

export type Orientation = 'horizontal' | 'vertical'

export type Deck = {
  id: string
  name: string
  created_at: string
  color: number | null
  icon_url: string | null
  /** The deckbox (folder) this deck is in, if any. */
  deckbox_id: string | null
  /** Study page shows front and back together, skipping flip-to-reveal. */
  show_both: boolean
  /** The study card's gentle floating animation. */
  float_anim: boolean
  /** Wide cards (horizontal) or tall ones (vertical). */
  orientation: Orientation
}

export type Deckbox = {
  id: string
  name: string
  created_at: string
}

export type Card = {
  id: string
  deck_id: string
  front: string
  back: string
  source: 'manual' | 'csv'
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string
  created_at: string
  font: CardFont
  starred: boolean
  tags: string[]
}

/** 0 again, 1 hard, 2 good, 3 easy */
export type Rating = 0 | 1 | 2 | 3

/** What the review_card() database function returns: the card's new schedule plus the coins it paid. */
export type ReviewResult = Pick<Card, 'ease' | 'interval_days' | 'repetitions' | 'lapses' | 'due_at'> & { coins: number }
