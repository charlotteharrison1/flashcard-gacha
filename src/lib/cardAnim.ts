import { applyPref, loadPref } from './pref'


/** Whether study cards animate: the fade-in when a card appears, the floating bob, and the flip. On by default. CSS reads data-card-anim. */
/** Sets data-card-anim on <html> and remembers it. */
export const loadCardAnim = (): boolean => loadPref('cardAnim', 'on') !== 'off'
export const applyCardAnim = (on: boolean) => applyPref('cardAnim', 'cardAnim', on ? 'on' : 'off')
