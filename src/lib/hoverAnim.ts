import { applyPref, loadPref } from './pref'

/** Whether deck cards lift and tilt when the mouse is over them. Off by default. CSS reads data-hover. */
export const loadHoverAnim = (): boolean => loadPref('hoverAnim', 'off') === 'on'
export const applyHoverAnim = (on: boolean) => applyPref('hoverAnim', 'hover', on ? 'on' : 'off')
