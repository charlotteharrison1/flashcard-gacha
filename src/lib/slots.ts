export const SYMBOL_IDS = ['star', 'cherry', 'seven', 'bar', 'diamond', 'bell'] as const
export type SymbolId = (typeof SYMBOL_IDS)[number]

export type Result = 'nothing' | 'silver' | 'gold'
export type Winnings = { pulls: number; silver: number; gold: number }
export type SpendResult = { balance: number; result: Result }

/** 5-point star inside a 64x64 box, shared by the reel symbol and the badges. */
export const STAR_POINTS =
  '32,6 38.47,23.1 56.73,23.97 42.46,35.4 47.28,53.03 32,43 16.72,53.03 21.54,35.4 7.27,23.97 25.53,23.1'

export const INITIAL_REELS: SymbolId[] = ['seven', 'bar', 'diamond']

// Visual only. The database rolls the odds (see spend_pull in 0003_slots.sql); the reels just display the result.
const pick = () => SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)]

export const randomFill = (n: number) => Array.from({ length: n }, pick)

/** Gold = three stars, silver = three cherries, nothing = a random mix that is never three alike. */
export function reelsFor(result: Result): SymbolId[] {
  if (result === 'gold') return ['star', 'star', 'star']
  if (result === 'silver') return ['cherry', 'cherry', 'cherry']
  let reels: SymbolId[]
  do {
    reels = [pick(), pick(), pick()]
  } while (reels[0] === reels[1] && reels[1] === reels[2])
  return reels
}

export function isSpendResult(v: unknown): v is SpendResult {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.balance === 'number' && (o.result === 'nothing' || o.result === 'silver' || o.result === 'gold')
}
