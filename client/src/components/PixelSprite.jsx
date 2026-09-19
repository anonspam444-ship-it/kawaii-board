// Tiny pixel-art renderer: a sprite is an array of equal-length strings plus a
// legend mapping each character to a colour ('.' is transparent). Every run of
// identical pixels in a row becomes one <rect>, which keeps the DOM small and
// the shapes crisp at any size.
//
// The sprites are drawn here rather than fetched because the alternative —
// hotlinking Nexon's artwork — breaks the moment the host blocks it, and this
// board is a public repo. These are homemade lookalikes.
export default function PixelSprite({ rows, legend, title, className, style }) {
  const width = rows[0].length
  const height = rows.length
  const rects = []

  rows.forEach((row, y) => {
    let x = 0
    while (x < width) {
      const char = row[x]
      // Measure the run first, then emit one rect for the whole thing.
      let run = 1
      while (x + run < width && row[x + run] === char) run += 1
      const fill = legend[char]
      if (fill) {
        rects.push(<rect key={`${x},${y}`} x={x} y={y} width={run} height={1} fill={fill} />)
      }
      x += run
    }
  })

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {rects}
    </svg>
  )
}

// --- the cast ---------------------------------------------------------------

export const MUSHROOM = {
  title: 'A little orange mushroom',
  legend: { O: '#e8762c', D: '#a8410f', S: '#ffd8a0', C: '#fbeacd', E: '#2a1a10', P: '#d9607a' },
  rows: [
    '................',
    '.....OOOOOO.....',
    '...OOSSOOSSOO...',
    '..OOSSOOOOSSOO..',
    '.OOOOSSOOSSOOOO.',
    '.OOOOOOOOOOOOOO.',
    '.DDDDDDDDDDDDDD.',
    '..CCCCCCCCCCCC..',
    '..CCEECCCCEECC..',
    '..CCEECCCCEECC..',
    '..CCCCCCCCCCCC..',
    '..CCCCPPPPCCCC..',
    '..CCCCCCCCCCCC..',
    '...CC.CCCC.CC...',
    '...DD......DD...',
  ],
}

export const SLIME = {
  title: 'A green slime',
  legend: { G: '#6fbf3f', L: '#c4f08a', E: '#1c2a12', M: '#2f4a1c', D: '#3d7a22' },
  rows: [
    '......GG......',
    '....GGGGGG....',
    '...GGLLGGGG...',
    '..GGLLGGGGGG..',
    '..GGGGGGGGGG..',
    '.GGGGGGGGGGGG.',
    '.GGEEGGGGEEGG.',
    '.GGEEGGGGEEGG.',
    '.GGGGGGGGGGGG.',
    '.GGGGMMMMGGGG.',
    '.GGGGGGGGGGGG.',
    '.DDDDDDDDDDDD.',
  ],
}

export const LEAF = {
  legend: { R: '#e9612a', S: '#7a4a1c' },
  rows: [
    '.....R.....',
    '....RRR....',
    '.R..RRR..R.',
    '.RR.RRR.RR.',
    '.RRRRRRRRR.',
    'RRRRRRRRRRR',
    '.RRRRRRRRR.',
    '..RRRRRRR..',
    '...RR.RR...',
    '.....S.....',
    '.....S.....',
  ],
}

// Same leaf, gone gold — mixed into the fall so the drift isn't one flat colour.
export const LEAF_GOLD = {
  legend: { R: '#f2b134', S: '#7a4a1c' },
  rows: LEAF.rows,
}

// A blue snail, the first thing anything on Maple Island ever killed.
export const SNAIL = {
  title: 'A blue snail',
  legend: { S: '#2f6ea8', B: '#7fc4f0', C: '#f6e3c2', D: '#c9a878', E: '#22303a' },
  rows: [
    '..............E.E.',
    '....SSSSSS....E.E.',
    '..SSBBBBBBSS..E.E.',
    '.SSBBSSSSBBSS.EEE.',
    '.SBBSSBBSSBBS.CCC.',
    '.SBBSSBBSSBBSCCCCC',
    '.SBBSSSSSSBBSCCCCC',
    '.SSBBBBBBBBSSCCCCC',
    '..SSBBBBBBSS.CCCCC',
    '...SSSSSSSS..CCCC.',
    '.CCCCCCCCCCCCCCCC.',
    'CCCCCCCCCCCCCCCCCC',
    '.CCCCCCCCCCCCCCCC.',
    '..DDDDDDDDDDDDDD..',
  ],
}

// A stump. Grumpier than it looks.
export const STUMP = {
  title: 'A tree stump',
  legend: { B: '#5c3a1d', L: '#dba765', T: '#965c2c', E: '#1a0f07', M: '#2e1a0c' },
  rows: [
    '...BBBBBBBB...',
    '..BLLLLLLLLB..',
    '.BLLLBBBBLLLB.',
    '.BLLBLLLLBLLB.',
    '.BBBBBBBBBBBB.',
    '.BTTTTTTTTTTB.',
    '.BTEETTTTEETB.',
    '.BTEETTTTEETB.',
    '.BTTTTTTTTTTB.',
    '.BTTTMMMMTTTB.',
    '.BTTTTTTTTTTB.',
    '.BBTTTTTTTTBB.',
    'BB.BB....BB.BB',
  ],
}

// A pig. Pink, round, blameless.
export const PIG = {
  title: 'A pink pig',
  legend: { P: '#f4a0bc', D: '#c76a90', E: '#2a1620', N: '#e2789e', K: '#8d3f5c' },
  rows: [
    '...PP......PP...',
    '..PPPP....PPPP..',
    '..PPPPPPPPPPPP..',
    '.PPPPPPPPPPPPPP.',
    '.PPPPPPPPPPPPPP.',
    '.PPEEPPPPPPEEPP.',
    '.PPEEPPPPPPEEPP.',
    '.PPPPPPPPPPPPPP.',
    '.PPPPNNNNNNPPPP.',
    '.PPPPNKNNKNPPPP.',
    '.PPPPNNNNNNPPPP.',
    '.PPPPPPPPPPPPPP.',
    '..DDD.DDDD.DDD..',
  ],
}

// Drifting decoration for the kawaii layer.
export const HEART = {
  legend: { H: '#ff7fb0', L: '#ffd3e4' },
  rows: [
    '.HH...HH.',
    'HHLHHHHHH',
    'HHLHHHHHH',
    'HHHHHHHHH',
    '.HHHHHHH.',
    '..HHHHH..',
    '...HHH...',
    '....H....',
  ],
}

export const SPARKLE = {
  legend: { S: '#fff3b0', W: '#ffffff' },
  rows: [
    '...S...',
    '...S...',
    '..SSS..',
    'SSSWSSS',
    '..SSS..',
    '...S...',
    '...S...',
  ],
}
