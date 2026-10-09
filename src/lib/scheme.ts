export const SCHEMES = [
  { id: 'felt', label: 'Felt', swatch: '#1b7167' },
  { id: 'midnight', label: 'Midnight', swatch: '#2b4a8f' },
  { id: 'crimson', label: 'Crimson', swatch: '#8a2a3a' },
  { id: 'violet', label: 'Violet', swatch: '#6a3fa0' },
  { id: 'gold', label: 'Gold (light)', swatch: '#f6d05a' },
  { id: 'silver', label: 'Silver (light)', swatch: '#d9dee6' },
  { id: 'pink', label: 'Pink (light)', swatch: '#ff9fcf' },
  { id: 'lightblue', label: 'Light blue (light)', swatch: '#8fd3ff' },
  { id: 'lightgreen', label: 'Light green (light)', swatch: '#9fe870' },
] as const

export type SchemeId = (typeof SCHEMES)[number]['id']

const KEY = 'scheme'

export function loadScheme(): SchemeId {
  try {
    const saved = localStorage.getItem(KEY)
    const match = SCHEMES.find((s) => s.id === saved)
    if (match) return match.id
  } catch {
    // storage blocked (private window etc.) — fall through to default
  }
  return 'felt'
}

/** Sets the scheme on <html> (CSS reads data-scheme) and remembers it. */
export function applyScheme(id: SchemeId) {
  document.documentElement.dataset.scheme = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
}
