import { supabase } from './supabase'

/** The most brand-new cards that get introduced in one day, across all decks. A setting for this is planned; change it here for now. */
export const NEW_CARDS_PER_DAY = 20

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * How many new cards may still be introduced today: the daily limit minus the cards whose first review was today.
 * If the counting function isn't in the database yet (0031_new_cards_today.sql), each session just gets the full allowance.
 */
export async function newCardsLeftToday(): Promise<number> {
  const { data, error } = await supabase.rpc('new_cards_today', { p_since: startOfToday().toISOString() })
  if (error || typeof data !== 'number') return NEW_CARDS_PER_DAY
  return Math.max(0, NEW_CARDS_PER_DAY - data)
}
