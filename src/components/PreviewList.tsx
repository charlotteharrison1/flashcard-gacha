import CardText from '../lib/cardText'

/** Read-only list of cards, question and answer both shown. */
export default function PreviewList({ cards, userId }: { cards: { id: string; front: string; back: string; font: string }[]; userId: string }) {
  return (
    <ul className="preview-list">
      {cards.map((c) => (
        <li key={c.id} className="face preview-card">
          <div className={`face-text font-${c.font}`}>
            <CardText text={c.front} userId={userId} />
          </div>
          <hr className="combined-divider" />
          <div className={`face-text font-${c.font}`}>
            <CardText text={c.back} userId={userId} />
          </div>
        </li>
      ))}
    </ul>
  )
}
