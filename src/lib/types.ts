export type Deck = {
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
  due_at: string
  created_at: string
}

/** 0 again, 1 hard, 2 good, 3 easy */
export type Rating = 0 | 1 | 2 | 3
