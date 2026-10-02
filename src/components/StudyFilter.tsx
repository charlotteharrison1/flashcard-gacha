import { useState } from 'react'
import { Link } from 'react-router-dom'
import { filterParam, matchesFilter, tagCounts, type CardFilter, type Taggable } from '../lib/cardMeta'

/** A panel to study just the starred cards, the tagged ones, or one tag, optionally including cards that aren't due. */
export default function StudyFilter({ basePath, cards }: { basePath: string; cards: Taggable[] }) {
  const [filter, setFilter] = useState<CardFilter>('starred')
  const [includeNotDue, setIncludeNotDue] = useState(true)
  const tags = tagCounts(cards)

  const [now] = useState(() => Date.now()) // fixed for the life of the panel, so the count doesn't shift as the page re-renders
  const count = cards.filter((c) => matchesFilter(c, filter) && (includeNotDue || !c.due_at || new Date(c.due_at).getTime() <= now)).length

  const params = new URLSearchParams()
  if (filterParam(filter)) params.set('f', filterParam(filter))
  if (includeNotDue) params.set('all', '1')
  const query = params.toString()

  return (
    <section className="panel">
      <h3>Study starred or tagged cards</h3>
      <div className="row">
        <label>
          Cards{' '}
          <select value={filter} onChange={(e) => setFilter(e.target.value as CardFilter)}>
            <option value="starred">Starred</option>
            <option value="tagged">Any tag</option>
            {tags.map(([t, n]) => (
              <option key={t} value={`tag:${t}`}>
                #{t} ({n})
              </option>
            ))}
          </select>
        </label>
        <label className="row nowrap">
          <input type="checkbox" checked={includeNotDue} onChange={(e) => setIncludeNotDue(e.target.checked)} />
          Include cards that aren't due
        </label>
        {count > 0 ? (
          <Link className="button gold" to={`${basePath}${query ? `?${query}` : ''}`}>
            Study {count}
          </Link>
        ) : (
          <span className="muted">No matching cards</span>
        )}
      </div>
    </section>
  )
}
