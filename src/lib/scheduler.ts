import type { Card, Rating } from './types'

type State = Pick<Card, 'ease' | 'interval_days' | 'repetitions'>

const DAY_MS = 24 * 60 * 60 * 1000
const AGAIN_DELAY_MS = 10 * 60 * 1000

/** Simplified SM-2: returns the card's next spaced-repetition state. */
export function schedule(card: State, rating: Rating, now = new Date()) {
  let { ease, interval_days, repetitions } = card

  if (rating === 0) {
    return {
      ease: Math.max(1.3, ease - 0.2),
      interval_days: 0,
      repetitions: 0,
      due_at: new Date(now.getTime() + AGAIN_DELAY_MS).toISOString(),
    }
  }

  repetitions += 1
  ease = Math.max(1.3, ease + (rating === 1 ? -0.15 : rating === 3 ? 0.15 : 0))

  if (repetitions === 1) interval_days = rating === 3 ? 3 : 1
  else if (repetitions === 2) interval_days = rating === 3 ? 6 : 3
  else {
    const mult = rating === 1 ? 1.2 : rating === 2 ? ease : ease * 1.3
    interval_days = Math.max(interval_days + 1, Math.round(interval_days * mult))
  }

  return {
    ease,
    interval_days,
    repetitions,
    due_at: new Date(now.getTime() + interval_days * DAY_MS).toISOString(),
  }
}
