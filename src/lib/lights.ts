/** Whether the blinking and chasing marquee lights animate. On by default; the header toggle turns them off (CSS reads data-lights). */
const KEY = 'lights'

export function loadLights(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    // storage blocked (private window etc.) — fall through to default
    return true
  }
}

/** Sets data-lights on <html> and remembers it. */
export function applyLights(on: boolean) {
  document.documentElement.dataset.lights = on ? 'on' : 'off'
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}
