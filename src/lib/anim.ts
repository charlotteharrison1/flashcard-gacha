import { applyPref, loadPref } from './pref'


/** The master "turn off all animations" switch. On by default. CSS reads data-anim; the JS-driven motion (reels, lever) checks it too. */
/** Sets data-anim on <html> and remembers it. */
export const loadAnim = (): boolean => loadPref('anim', 'on') !== 'off'
export const applyAnim = (on: boolean) => applyPref('anim', 'anim', on ? 'on' : 'off')

/** True when motion should be skipped: the user's system asks for less motion, or they turned animations off here. */
export function motionReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.anim === 'off'
}
