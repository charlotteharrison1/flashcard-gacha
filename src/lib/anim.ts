/** The master "turn off all animations" switch. On by default. CSS reads data-anim; the JS-driven motion (reels, lever) checks it too. */
const KEY = 'anim'

export function loadAnim(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    // storage blocked (private window etc.) — fall through to default
    return true
  }
}

/** Sets data-anim on <html> and remembers it. */
export function applyAnim(on: boolean) {
  document.documentElement.dataset.anim = on ? 'on' : 'off'
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

/** True when motion should be skipped: the user's system asks for less motion, or they turned animations off here. */
export function motionReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.anim === 'off'
}
