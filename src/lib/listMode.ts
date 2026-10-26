import { applyPref, loadPref } from './pref'

/** List mode on the home page: decks and deckboxes as rows with icons instead of cards. Off by default; CSS reads data-list. */
export const loadListMode = () => loadPref('list', 'off') === 'on'
export const applyListMode = (on: boolean) => applyPref('list', 'list', on ? 'on' : 'off')
