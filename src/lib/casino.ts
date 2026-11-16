import { supabase } from './supabase'

/** What every game in "Pick your poison" gets: the coin balance and a way to update it after a bet settles. */
export type GameProps = { balance: number | null; setBalance: (balance: number) => void }

export type MinesView = {
  bet: number
  mines_count: number
  revealed: number[]
  multiplier: number
  payout: number
  balance: number
  status: 'active' | 'lost' | 'cashed' | 'cleared'
  mines: number[] | null // only once the game is over
  hit: number | null
}

export type BjResult = 'win' | 'lose' | 'push' | 'blackjack' | 'bust'
export type BjView = {
  bet: number
  balance: number
  player: number[]
  player_total: number
  dealer: number[] // just the first card while the hand is live
  dealer_total: number | null
  result: BjResult | null
  payout: number
  can_double: boolean
}

/** Calls a game function in the database (supabase/migrations/0033_casino.sql). Every outcome is decided there. */
export async function casino<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const missing = /could not find the function|does not exist/i.test(error.message)
    throw new Error(missing ? 'The games need supabase/migrations/0033_casino.sql to be run first.' : error.message)
  }
  return data as T
}

/** Multiplier after k safe tiles with m mines on the 5x5 board (the same maths as mines_mult in the database), for showing the next step. */
export function minesMult(mines: number, k: number): number {
  let m = 0.97
  for (let i = 0; i < k; i++) m *= (25 - i) / (25 - mines - i)
  return m
}
