import type { CardFont } from './fonts'

export type Deck = {
  id: string
  name: string
  created_at: string
  color: number | null
  icon_url: string | null
  /** Study page shows front and back together, skipping flip-to-reveal. */
  show_both: boolean
  /** The study card's gentle floating animation. */
  float_anim: boolean
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
}

/** 0 again, 1 hard, 2 good, 3 easy */
export type Rating = 0 | 1 | 2 | 3
