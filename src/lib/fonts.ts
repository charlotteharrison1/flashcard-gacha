export const FONT_OPTIONS = [
  { id: 'clear', label: 'Clear (recommended)' },
  { id: 'classic', label: 'Classic sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'retro', label: 'Retro pixel' },
] as const

export type CardFont = (typeof FONT_OPTIONS)[number]['id']

export const DEFAULT_FONT: CardFont = 'clear'
