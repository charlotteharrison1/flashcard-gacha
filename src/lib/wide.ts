import { applyPref, loadPref } from './pref'

/** Wide mode on the home page: the deck shelf fills the screen so a big collection fits without scrolling. Off by default; CSS reads data-wide. */
export const loadWide = () => loadPref('wide', 'off') === 'on'
export const applyWide = (on: boolean) => applyPref('wide', 'wide', on ? 'on' : 'off')
