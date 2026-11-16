import { SlotSymbol } from '../SlotSymbol'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['spade', 'heart', 'suitDiamond', 'club'] as const

/** A playing card from the database's 0-51 numbering (rank = n % 13, suit = n / 13), or a face-down card when `n` is null. */
export default function PlayingCard({ n }: { n: number | null }) {
  if (n === null) return <span className="cg-card back" aria-label="Face-down card" />
  const suit = Math.floor(n / 13)
  return (
    <span className={`cg-card${suit === 1 || suit === 2 ? ' red' : ''}`} aria-label={`${RANKS[n % 13]} of ${['spades', 'hearts', 'diamonds', 'clubs'][suit]}`}>
      <b>{RANKS[n % 13]}</b>
      <SlotSymbol id={SUITS[suit]} />
    </span>
  )
}
