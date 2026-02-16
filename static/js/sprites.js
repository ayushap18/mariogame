/**
 * Sprite rendering system using pixel art defined as character arrays.
 * Each sprite is a grid of characters mapped to colors via a palette.
 * Sprites are pre-rendered to offscreen canvases for performance.
 */

const PALETTES = {
  mario: {
    '.': 'transparent',
    'r': '#E52521',
    'b': '#6B3300',
    's': '#FDB294',
    'B': '#0038A8',
    'y': '#FBD000',
    'w': '#FFFFFF',
    'k': '#000000',
  },
  world: {
    '.': 'transparent',
    'b': '#6B3300',
    'o': '#D87B2A',
    'y': '#FBD000',
    't': '#C88448',
    'g': '#00A800',
    'G': '#005800',
    'k': '#000000',
    'w': '#FFFFFF',
    'r': '#E52521',
    'B': '#5C94FC',
    's': '#FDB294',
    'c': '#87CEEB',
    'd': '#A0522D',
    'n': '#808080',
    'N': '#A0A0A0',
  }
};

const SPRITE_DATA = {
  hero_stand: {
    palette: 'mario',
    pixels: [
      '....rrrr....',
      '...rrrrrr...',
      '...bbbssb...',
      '..bsbsssbs..',
      '..bsbsssbbs.',
      '..bbssssbb..',
      '....ssssss..',
      '..rrBrBr....',
      '.srrBrrBrs..',
      '.ssrBBBBrss.',
      '.ssrBrBBrss.',
      '..rrBBBBrr..',
      '...BBBBBB...',
      '..bb..bb....',
      '.bbb..bbb...',
      '................',
    ],
  },
  hero_run1: {
    palette: 'mario',
    pixels: [
      '....rrrr....',
      '...rrrrrr...',
      '...bbbssb...',
      '..bsbsssbs..',
      '..bsbsssbbs.',
      '..bbssssbb..',
      '....ssssss..',
      '...rrBrrr...',
      '..rrrBrrrBs.',
      '.srrBBBBBss.',
      '.ssBBrBBBs..',
      '..rBBBBBr...',
      '..BBBB......',
      '..BBBbb.....',
      '...bbb.bbb..',
      '................',
    ],
  },
  hero_jump: {
    palette: 'mario',
    pixels: [
      '....rrrr....',
      '...rrrrrr...',
      '...bbbssb...',
      '..bsbsssbs..',
      '..bsbsssbbs.',
      '..bbssssbb..',
      '....ssssss..',
      '..rrBrrrss..',
      '.rrrBrBBBBs.',
      '.rrrBBBBBBs.',
      '.rrrBBrBBs..',
      '...rBBBBr...',
      '..bbb.BBB...',
      '.bbb...bbb..',
      '................',
      '................',
    ],
  },
  goomba: {
    palette: 'world',
    pixels: [
      '......bbbb......',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '..bbbwwbbwwbbb..',
      '..bbwwwbbwwwbb..',
      '.bbbwkwbbwkwbbb.',
      '.bbbbbbbbbbbbbbb',
      '.bbbbbbbbbbbbbbb',
      '..bbbbbbbbbbbbb.',
      '....bbbbbbbbb...',
      '..ssbbbbbbbbss..',
      '.ssssbbbbbssss..',
      'sssss......ssss.',
      'ssss........sss.',
      '................',
      '................',
    ],
  },
  coin: {
    palette: 'world',
    pixels: [
      '......yyyy......',
      '....yyyyyyyy....',
      '...yyyoooyyyy...',
      '..yyyyooyyyyyy..',
      '..yyyyooyyyyyy..',
      '.yyyyyooyyyyyyyy',
      '.yyyyyooyyyyyyyy',
      '.yyyyyooyyyyyyyy',
      '.yyyyyooyyyyyyyy',
      '..yyyyooyyyyyy..',
      '..yyyyooyyyyyy..',
      '...yyyoooyyyy...',
      '....yyyyyyyy....',
      '......yyyy......',
      '................',
      '................',
    ],
  },
  question_block: {
    palette: 'world',
    pixels: [
      'oooooooooooooooo',
      'okkkkkkkkkkkkkko',
      'ok..........okko',
      'ok.oyyyo....okko',
      'ok.oyyoyo...okko',
      'ok....oyo...okko',
      'ok...oyo....okko',
      'ok..oyo.....okko',
      'ok..oyo.....okko',
      'ok..........okko',
      'ok..oyo.....okko',
      'ok..........okko',
      'ok..........okko',
      'okkooooooooookko',
      'okkkkkkkkkkkkkko',
      'oooooooooooooooo',
    ],
  },
  brick: {
    palette: 'world',
    pixels: [
      'bbbbbbbbbbbbbbbb',
      'bttttttbbtttttbb',
      'bttttttbbtttttbb',
      'bttttttbbtttttbb',
      'bbbbbbbbbbbbbbbb',
      'btttbbttttttbbtt',
      'btttbbttttttbbtt',
      'btttbbttttttbbtt',
      'bbbbbbbbbbbbbbbb',
      'bttttttbbtttttbb',
      'bttttttbbtttttbb',
      'bttttttbbtttttbb',
      'bbbbbbbbbbbbbbbb',
      'btttbbttttttbbtt',
      'btttbbttttttbbtt',
      'bbbbbbbbbbbbbbbb',
    ],
  },
  ground: {
    palette: 'world',
    pixels: [
      'ggGgggGgggGgggGg',
      'gGgGgGgGgGgGgGgG',
      'GgggGgggGgggGgggG',
      'ggGgggGgggGgggGgg',
      'bbbbbbbbbbbbbbbbbb',
      'btttttbbtttttttbb',
      'bttttttbbtttttbb',
      'btttttbbtttttttbb',
      'bbbbbbbbbbbbbbbb',
      'btttbbttttttbbtt',
      'btttbbttttttbbtt',
      'btttbbttttttbbtt',
      'bbbbbbbbbbbbbbbb',
      'bttttttbbtttttbb',
      'bttttttbbtttttbb',
      'bbbbbbbbbbbbbbbb',
    ],
  },
  pipe_top_l: {
    palette: 'world',
    pixels: [
      'kGGGGGGGGGGGGGGk',
      'kGggggggggggggGGk',
      'kGggggggggggggGGk',
      'kGggggggggggggGGk',
      'kGGGGGGGGGGGGGGk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
      'kkGgggggggggGGkk',
    ],
  },
  flag_pole: {
    palette: 'world',
    pixels: [
      '........kk......',
      '......gggkk.....',
      '......gggkk.....',
      '......gggkk.....',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
      '........kk......',
    ],
  },
  cloud: {
    palette: 'world',
    pixels: [
      '......wwww......',
      '....wwwwwwww....',
      '..wwwwwwwwwwww..',
      '.wwwwwwwwwwwwww.',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      '.wwwwwwwwwwwwww.',
      '..wwwwwwwwwwww..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  mushroom: {
    palette: 'world',
    pixels: [
      '....rrrrrr......',
      '..rrrrrrrrrr....',
      '.rrrwwrrrwwrrr..',
      'rrrwwwrrrwwwrrr.',
      'rrrwwwrrrwwwrrrr',
      'rrrwwwrrrwwwrrrr',
      'rrrrrrrrrrrrrrr.',
      '.rrrrrrrrrrrrr..',
      '..ssssssssssss..',
      '..ssssssssssss..',
      '..sssttssstttss.',
      '..sssttsssttss..',
      '..sssttsssttss..',
      '..sssttsssttss..',
      '..ssssssssssss..',
      '................',
    ],
  },
  star_powerup: {
    palette: 'world',
    pixels: [
      '......yyyy......',
      '......yyyy......',
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      'yyyyyyyyyyyyyyyy',
      '.yyyyyyyyyyyyyyo',
      '..yyyyyyyyyyyy..',
      '...yyyyyyyyyy...',
      '..yyyyyy.yyyyy..',
      '.yyyyy...oyyyyy.',
      '.yyyy.....yyyyy.',
      'yyyy.......yyyy.',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  used_block: {
    palette: 'world',
    pixels: [
      'bbbbbbbbbbbbbbbb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bddddddddddddb.',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bdddddddddddddb',
      'bddddddddddddb.',
      'bdddddddddddddb',
      'bbbbbbbbbbbbbbbb',
    ],
  },
};

const spriteCache = new Map();

function renderSprite(name, scale) {
  scale = scale || 1;
  const cacheKey = `${name}_${scale}`;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);

  const data = SPRITE_DATA[name];
  if (!data) return null;

  const palette = PALETTES[data.palette];
  const pixels = data.pixels;
  const rows = pixels.length;
  const cols = Math.max(...pixels.map(r => r.length));

  const canvas = document.createElement('canvas');
  canvas.width = cols * scale;
  canvas.height = rows * scale;
  const ctx = canvas.getContext('2d');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < pixels[r].length; c++) {
      const ch = pixels[r][c];
      const color = palette[ch];
      if (!color || color === 'transparent') continue;
      ctx.fillStyle = color;
      ctx.fillRect(c * scale, r * scale, scale, scale);
    }
  }

  spriteCache.set(cacheKey, canvas);
  return canvas;
}

function clearSpriteCache() {
  spriteCache.clear();
}

export { SPRITE_DATA, PALETTES, renderSprite, clearSpriteCache };
