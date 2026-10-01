import type { Card, Rating } from './types'

type State = Pick<Card, 'ease' | 'interval_days' | 'repetitions' | 'lapses'>

const DAY_MS = 24 * 60 * 60 * 1000
const AGAIN_DELAY_MS = 10 * 60 * 1000

/** Extra coins for each time a card was marked Again since its last success, capped at +4 (5 coins total). */
export const MAX_LAPSE_BONUS = 4

/**
 * Simplified SM-2, plus the review economy: `lapses` counts Again answers since the last
 * success, and `coins` is what this answer pays out. Again itself earns nothing — only
 * finally getting the card right does, and it pays more the more it had to fight back.
 */
export function schedule(card: State, rating: Rating, now = new Date()) {
  let { ease, interval_days, repetitions, lapses } = card

  if (rating === 0) {
    return {
      ease: Math.max(1.3, ease - 0.2),
      interval_days: 0,
      repetitions: 0,
      lapses: lapses + 1,
      due_at: new Date(now.getTime() + AGAIN_DELAY_MS).toISOString(),
      coins: 0,
    }
  }

  const coins = 1 + Math.min(lapses, MAX_LAPSE_BONUS)

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
    lapses: 0,
    due_at: new Date(now.getTime() + interval_days * DAY_MS).toISOString(),
    coins,
  }
}
