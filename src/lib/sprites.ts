import type { SymbolId } from './slots'

/**
 * Pixel-art sprites for the slot reels. Each sprite is a grid of palette letters ('.' = empty);
 * a 1px dark outline is added around every filled pixel automatically (see `spritePaths`), so the
 * art below only describes the fill. Every sprite keeps a 1px empty margin so the outline fits.
 */
export type Sprite = { size: number; paths: { color: string; d: string }[] }

/** Everything drawable: the slot symbols, the lever knob, the four card suits (home page frame corners) and a deckbox. */
export type SpriteId = SymbolId | 'ball' | 'coin' | 'arrow' | 'goldBadge' | 'silverBadge' | 'spade' | 'heart' | 'club' | 'suitDiamond' | 'deckbox'

const OUTLINE = '#0a1218'

const PALETTE: Record<string, string> = {
  Y: '#ffc233', // gold
  W: '#fff3d0', // highlight
  R: '#ff4d40', // red
  D: '#b3231a', // dark red / shade (overridden per sprite below)
  G: '#3ed598', // leaf green
  S: '#3b6b2a', // stem
  B: '#1e9bff', // blue
  C: '#4dd8ff', // cyan
  O: '#ff9430', // orange
  N: '#3d4455', // slate (black suits)
  M: '#8a95ab', // slate highlight
}

const SHADE: Record<SpriteId, Record<string, string>> = {
  star: { D: '#b98410' },
  cherry: {},
  seven: { D: '#b3231a' },
  bar: {},
  diamond: { D: '#1e8fc4' },
  bell: { D: '#b85c0a' },
  ball: { D: '#b3231a' },
  spade: {},
  heart: {},
  club: {},
  suitDiamond: { D: '#b3231a' },
  deckbox: { D: '#b85c0a' },
  coin: { D: '#b98410' },
  arrow: { D: '#b98410' },
  goldBadge: { D: '#b98410' },
  silverBadge: { Y: '#cfd8e3', D: '#7d8a9a', W: '#ffffff' },
}

// Built from glyphs so the letters stay lined up.
const GLYPHS: Record<string, string[]> = {
  B: ['WW.', 'W.W', 'WW.', 'W.W', 'WW.'],
  A: ['.W.', 'W.W', 'WWW', 'W.W', 'W.W'],
  R: ['WW.', 'W.W', 'WW.', 'WW.', 'W.W'],
}

function barRows(): string[] {
  const text = ['B', 'A', 'R']
  const rows = ['................', '................', '................', '................']
  rows.push('.BBBBBBBBBBBBBB.')
  for (let r = 0; r < 5; r++) {
    // 1px pad, then each glyph with 1px gaps between them
    const line = text.map((g) => GLYPHS[g][r].replace(/\./g, 'B')).join('B')
    rows.push('.BB' + line + 'B.')
  }
  rows.push('.BBBBBBBBBBBBBB.')
  while (rows.length < 16) rows.push('................')
  return rows
}

/** A round medal (15x15): shaded disc, a light arc, a little star, and two ribbon tails. Gold/silver differ only by palette. */
function medalRows(): string[] {
  const N = 15
  const cx = 7
  const cy = 6
  const g: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'))
  // ribbon tails, behind the disc
  for (let y = 10; y <= 13; y++) {
    for (const x of [4, 5, 6, 8, 9, 10]) g[y][x] = 'R'
  }
  g[13][5] = '.'
  g[13][9] = '.'
  // disc
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 > 25) continue
      if (dx + dy >= 5 && d2 >= 16) g[y][x] = 'D' // shade, lower right
      else if (dx <= -3 && dy <= -2 && d2 >= 13) g[y][x] = 'W' // highlight arc, upper left
      else g[y][x] = 'Y'
    }
  }
  // star in the middle
  const star = ['..W..', 'WWWWW', '.WWW.', '.W.W.']
  star.forEach((row, r) => [...row].forEach((ch, c) => ch === 'W' && (g[cy - 2 + r][cx - 2 + c] = 'W')))
  return g.map((row) => row.join(''))
}

const FILLS: Record<SpriteId, string[]> = {
  star: [
    '................',
    '.......YY.......',
    '......YYYY......',
    '......YWYY......',
    '.YYYYYYWYYYYYY..',
    '..YYYYYYYYYYYY..',
    '...YYYYYYYYYY...',
    '....YYYYYYYY....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '...YYYY..YYYY...',
    '..YYYY....YYYY..',
    '..YYY......YYY..',
    '................',
    '................',
    '................',
  ],
  cherry: [
    '................',
    '..........GGGG..',
    '.........GGGGGG.',
    '........SS......',
    '.......S.S......',
    '......S...S.....',
    '.....S.....S....',
    '....S.......S...',
    '...........RRR..',
    '...RRR....RWRRR.',
    '..RWRRR...RWRRR.',
    '..RWRRR...RRRRR.',
    '..RRRRR....RRR..',
    '...RRR..........',
    '................',
    '................',
  ],
  seven: [
    '................',
    '................',
    '..RRRRRRRRRRRR..',
    '..RWWWWWWWWRRD..',
    '..RRRRRRRRRRRD..',
    '..........RRDD..',
    '.........RRRD...',
    '........RRRD....',
    '.......RRRD.....',
    '......RRRD......',
    '......RRRD......',
    '.....RRRD.......',
    '.....RRRD.......',
    '................',
    '................',
    '................',
  ],
  bar: barRows(),
  diamond: [
    '................',
    '................',
    '....CCCCCCCC....',
    '...CCCWWCCCCD...',
    '..CCCCWCCCCCDD..',
    '.CCCCCCCCCCCCDD.',
    '.CCCCCCCCCCCCCD.',
    '..CCCCCCCCCCDD..',
    '...CCCCCCCCDD...',
    '....CCCCCCDD....',
    '.....CCCCDD.....',
    '......CCDD......',
    '.......CD.......',
    '................',
    '................',
    '................',
  ],
  bell: [
    '................',
    '.......OO.......',
    '.....OOOOOO.....',
    '....OOWWOOOO....',
    '...OOWOOOOOOD...',
    '...OWOOOOOOOD...',
    '...OWOOOOOOOD...',
    '..OOWOOOOOOODD..',
    '..OOOOOOOOOOOD..',
    '..OOOOOOOOOOOD..',
    '.OOOOOOOOOOOOOD.',
    '.OOOOOOOOOOOOOD.',
    '.DDDDDDDDDDDDDD.',
    '......YYYY......',
    '......YYYY......',
    '................',
  ],
  // Card suits (11x11), used as corner jewels on the home page frame
  heart: [
    '...........',
    '...........',
    '..RR...RR..',
    '.RRRR.RRRR.',
    '.RWRRRRRRR.',
    '.RRRRRRRRR.',
    '..RRRRRRR..',
    '...RRRRR...',
    '....RRR....',
    '.....R.....',
    '...........',
  ],
  spade: [
    '...........',
    '.....N.....',
    '....NNN....',
    '...NNNNN...',
    '..NNMNNNN..',
    '.NNNNNNNNN.',
    '.NNNNNNNNN.',
    '..NNNNNNN..',
    '.....N.....',
    '....NNN....',
    '...........',
  ],
  club: [
    '...........',
    '....NNN....',
    '....NMN....',
    '....NNN....',
    '..NN.N.NN..',
    '.NNMNNNNNN.',
    '.NNNNNNNNN.',
    '..NN.N.NN..',
    '.....N.....',
    '....NNN....',
    '...........',
  ],
  suitDiamond: [
    '...........',
    '.....R.....',
    '....RRR....',
    '...RWRRR...',
    '..RRRRRRD..',
    '.RRRRRRRRD.',
    '..RRRRRRD..',
    '...RRRRD...',
    '....RRD....',
    '.....D.....',
    '...........',
  ],
  // A gold coin seen face-on (8x8): the same coin as the slot machine's
  coin: [
    '........',
    '..YYYY..',
    '.YWWYYY.',
    '.YWWYYY.',
    '.YYYYYY.',
    '.YYDYYY.',
    '..YYYY..',
    '........',
  ],
  goldBadge: medalRows(),
  silverBadge: medalRows(),
  // A chunky arrow pointing left (11x11)
  arrow: [
    '...........',
    '...........',
    '....Y......',
    '...YY......',
    '..YYYYYYY..',
    '.YWYYYYYYY.',
    '..YYYYYYD..',
    '...YD......',
    '....D......',
    '...........',
    '...........',
  ],
  // A card deckbox (13x13): orange lid, blue body, gold clasp
  deckbox: [
    '.............',
    '.............',
    '.OOOOOOOOOOO.',
    '.OWWWWWWWWWO.',
    '.OOOOOOOOOOO.',
    '.DDDDDDDDDDD.',
    '.BBBBBBBBBBB.',
    '.BBBBBYBBBBB.',
    '.BBBBYYYBBBB.',
    '.BBBBBYBBBBB.',
    '.BBBBBBBBBBB.',
    '.DDDDDDDDDDD.',
    '.............',
  ],
  // The lever knob (8x8)
  ball: [
    '........',
    '..RRRR..',
    '.RWRRRD.',
    '.RWRRRD.',
    '.RRRRRD.',
    '.RRRRDD.',
    '..DDDD..',
    '........',
  ],
}

/** Fill pixels of each colour, plus the auto outline, merged into one SVG path per colour. */
function build(rows: string[], shade: Record<string, string>): Sprite {
  const h = rows.length
  const w = rows[0].length
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? rows[y][x] : '.')
  const byColor = new Map<string, string>()
  const add = (color: string, x: number, y: number) => {
    // One 1x1 square per pixel; same-colour pixels share a path so the DOM stays tiny.
    byColor.set(color, (byColor.get(color) ?? '') + `M${x} ${y}h1v1h-1z`)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y)
      if (c !== '.') {
        add(shade[c] ?? PALETTE[c], x, y)
        continue
      }
      // Empty pixel touching a non-stem pixel becomes outline.
      const near = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
      if (near.some((n) => n !== '.' && n !== 'S')) add(OUTLINE, x, y)
    }
  }
  // Outline first so fills sit on top of any overlap.
  const paths = [...byColor.entries()]
    .sort(([a], [b]) => (a === OUTLINE ? -1 : b === OUTLINE ? 1 : 0))
    .map(([color, d]) => ({ color, d }))
  return { size: w, paths }
}

export const SPRITES: Record<SpriteId, Sprite> = Object.fromEntries(
  (Object.keys(FILLS) as SpriteId[]).map((id) => [id, build(FILLS[id], SHADE[id])]),
) as Record<SpriteId, Sprite>
