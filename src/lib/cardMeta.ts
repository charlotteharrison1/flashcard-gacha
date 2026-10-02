import { supabase } from './supabase'

/** Which cards to show or study: everything, starred ones, ones with any tag, or ones with one tag. */
export type CardFilter = 'all' | 'starred' | 'tagged' | `tag:${string}`
export type CardSort = 'newest' | 'starred' | 'tag'

/** The bits of a card that stars, tags and filtering care about. */
export type Taggable = { id: string; starred: boolean; tags: string[]; due_at?: string }

/** Lowercase, no spaces or punctuation (words are joined with "-"), at most 30 characters. */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

export function matchesFilter(c: Taggable, filter: CardFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'starred') return c.starred
  if (filter === 'tagged') return c.tags.length > 0
  return c.tags.includes(filter.slice(4))
}

/** Stable sort. "newest" keeps the order given (the queries return newest first). */
export function sortCards<T extends Taggable>(cards: T[], sort: CardSort): T[] {
  if (sort === 'newest') return cards
  const key = (c: T) => (sort === 'starred' ? (c.starred ? 0 : 1) : c.tags.length ? 0 : 1)
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const d = key(a.c) - key(b.c)
      if (d) return d
      if (sort === 'tag') {
        const t = [...a.c.tags].sort()[0] ?? ''
        const u = [...b.c.tags].sort()[0] ?? ''
        if (t !== u) return t < u ? -1 : 1
      }
      return a.i - b.i
    })
    .map((x) => x.c)
}

/** Every tag used, with how many cards have it, most used first. */
export function tagCounts(cards: Taggable[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const c of cards) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
}

export const MAX_TAGS = 10

/** Returns an error message, or null when saved. */
export async function saveStar(cardId: string, starred: boolean): Promise<string | null> {
  const { error } = await supabase.from('cards').update({ starred }).eq('id', cardId)
  return error ? error.message : null
}

export async function saveTags(cardId: string, tags: string[]): Promise<string | null> {
  const { error } = await supabase.from('cards').update({ tags }).eq('id', cardId)
  return error ? error.message : null
}

/** The `?f=` value for a study link, or '' for "all". */
export const filterParam = (f: CardFilter) => (f === 'all' ? '' : f)

export function readFilter(value: string | null): CardFilter {
  if (value === 'starred' || value === 'tagged') return value
  if (value && value.startsWith('tag:') && value.length > 4) return value as CardFilter
  return 'all'
}

export function filterLabel(f: CardFilter): string {
  if (f === 'all') return 'all cards'
  if (f === 'starred') return 'starred cards'
  if (f === 'tagged') return 'tagged cards'
  return `cards tagged #${f.slice(4)}`
}
