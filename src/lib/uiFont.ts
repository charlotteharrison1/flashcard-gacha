/** The font used for the app's buttons, labels and headings (card text has its own font setting). CSS reads data-ui-font. */
export const UI_FONTS = [
  { id: 'pixel', label: 'Pixel (default, easy to read)' },
  { id: 'pixelify', label: 'Pixel (chunky, original)' },
  { id: 'clear', label: 'Clear (Atkinson Hyperlegible)' },
  { id: 'sans', label: 'Sans (Inter)' },
  { id: 'serif', label: 'Serif (Lora)' },
  { id: 'mono', label: 'Monospace (JetBrains Mono)' },
  { id: 'system', label: 'System font' },
] as const

export type UiFontId = (typeof UI_FONTS)[number]['id']

const KEY = 'uiFont'

export function loadUiFont(): UiFontId {
  try {
    const saved = localStorage.getItem(KEY)
    const match = UI_FONTS.find((f) => f.id === saved)
    if (match) return match.id
  } catch {
    // storage blocked (private window etc.) — fall through to default
  }
  return 'pixel'
}

/** Sets data-ui-font on <html> and remembers it. */
export function applyUiFont(id: UiFontId) {
  document.documentElement.dataset.uiFont = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
}
