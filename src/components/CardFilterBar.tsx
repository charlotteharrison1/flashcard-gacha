import { matchesFilter, tagCounts, type CardFilter, type CardSort, type Taggable } from '../lib/cardMeta'

/** "Show" and "Sort" selects for a list of cards, with counts for starred, tagged and each tag. */
export default function CardFilterBar({
  cards,
  filter,
  setFilter,
  sort,
  setSort,
}: {
  cards: Taggable[]
  filter: CardFilter
  setFilter: (f: CardFilter) => void
  sort: CardSort
  setSort: (s: CardSort) => void
}) {
  const tags = tagCounts(cards)
  return (
    <div className="filter-bar row">
      <label>
        Show{' '}
        <select value={filter} onChange={(e) => setFilter(e.target.value as CardFilter)}>
          <option value="all">All cards ({cards.length})</option>
          <option value="starred">Starred ({cards.filter((c) => matchesFilter(c, 'starred')).length})</option>
          <option value="tagged">Any tag ({cards.filter((c) => matchesFilter(c, 'tagged')).length})</option>
          {tags.map(([t, n]) => (
            <option key={t} value={`tag:${t}`}>
              #{t} ({n})
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort{' '}
        <select value={sort} onChange={(e) => setSort(e.target.value as CardSort)}>
          <option value="newest">Newest first</option>
          <option value="starred">Starred first</option>
          <option value="tag">By tag (A–Z)</option>
        </select>
      </label>
    </div>
  )
}
