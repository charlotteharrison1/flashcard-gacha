import { applyPref, loadPref } from './pref'


/** Whether the blinking and chasing marquee lights animate. On by default; the header toggle turns them off (CSS reads data-lights). */
/** Sets data-lights on <html> and remembers it. */
export const loadLights = (): boolean => loadPref('lights', 'on') !== 'off'
export const applyLights = (on: boolean) => applyPref('lights', 'lights', on ? 'on' : 'off')
