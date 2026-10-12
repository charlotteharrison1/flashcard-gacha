/** Browser-saved preferences. Storage can be blocked (private window etc.), so every access falls back quietly. */
export function loadPref(key: string, fallback: string, allowed?: readonly string[]): string {
  try {
    const v = localStorage.getItem(key)
    if (v && (!allowed || allowed.includes(v))) return v
  } catch {
    // fall through to default
  }
  return fallback
}

/** Sets data-<attr> on <html> (CSS reads it) and remembers the value. */
export function applyPref(key: string, attr: string, value: string) {
  document.documentElement.dataset[attr] = value
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}
