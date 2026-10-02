/** Whether study cards animate: the fade-in when a card appears, the floating bob, and the flip. On by default. CSS reads data-card-anim. */
const KEY = 'cardAnim'

export function loadCardAnim(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    // storage blocked (private window etc.) — fall through to default
    return true
  }
}

/** Sets data-card-anim on <html> and remembers it. */
export function applyCardAnim(on: boolean) {
  document.documentElement.dataset.cardAnim = on ? 'on' : 'off'
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}
