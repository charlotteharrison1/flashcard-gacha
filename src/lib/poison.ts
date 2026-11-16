import { applyPref, loadPref } from './pref'

/** Whether "Pick your poison" (spend coins on games mid-study) is available on the study screen. On by default. CSS reads data-poison. */
export const loadPoison = (): boolean => loadPref('poison', 'on') !== 'off'
export const applyPoison = (on: boolean) => applyPref('poison', 'poison', on ? 'on' : 'off')
