import { applyPref, loadPref } from './pref'


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

/** Sets data-ui-font on <html> and remembers it. */
export const loadUiFont = () => loadPref('uiFont', 'pixel', UI_FONTS.map((f) => f.id)) as UiFontId
export const applyUiFont = (id: UiFontId) => applyPref('uiFont', 'uiFont', id)
