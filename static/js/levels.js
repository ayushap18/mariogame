/**
 * Level data and loader for the platformer.
 * Each level is a tile map using character codes:
 *   . = empty, # = ground, B = brick, ? = question block,
 *   P = pipe top, p = pipe body, C = coin, E = enemy,
 *   F = flag, M = mushroom block, = = bridge/platform,
 *   1 = player start, 2 = AI start
 *
 * Levels 1-3 are hand-crafted. Level 4+ are procedurally generated
 * with increasing difficulty (more gaps, enemies, pipes).
 */

const LEVELS = [
  {
    name: 'World 1-1',
    sky: '#5C94FC',
    ground: '#C84C0C',
    time: 400,
    map: [
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '..........C.C.C...................C.C.C...................C.C.C.................',
      '................................................................................',
      '........................................................................F.......',
      '..........C.C.C...................C.C.C....................C.C.C..=.=.=.=.##....',
      '..........?..?............E.......?B?B?..............E.........?..?.............',
      '................................................................................',
      '12..............................................................................',
      '##############..############..##############..################..###############.',
      '##############..############..##############..################..###############.',
    ],
  },
  {
    name: 'World 1-2',
    sky: '#000000',
    ground: '#C84C0C',
    time: 350,
    map: [
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '.........C.C.C.......................C.C.C.......................C.C.C...........',
      '................................................................................',
      '........................................................................F.......',
      '.........C.C.C..................C.C.C.......................C.C.C.=.=.=.=.##....',
      '.........?B?........E..........BB?BB..........E.............?B?B?..............',
      '................................................................................',
      '................................................................................',
      '12..............................................................................',
      '#############...##########...#############..PP..################..#############.',
      '#############...##########...#############..PP..################..#############.',
    ],
  },
  {
    name: 'World 1-3',
    sky: '#5C94FC',
    ground: '#C84C0C',
    time: 300,
    map: [
      '................................................................................',
      '................................................................................',
      '................................................................................',
      '...C.........C.C.C......................C.C.C.C..............................C...',
      '................................................................................',
      '..........C.C.C.............C.C.C.......................C.C.C...................',
      '.......................................................................F........',
      '..........C.C.C.............C.C.C..............C.C.C..........=.=.=.=.=.##.....',
      '......?B?B?.......E...........BB?BB.......E...........?B?B?........E...........',
      '...........?..?..?..................?..?..?..................?..?.................',
      '................................................................................',
      '12..............................................................................',
      '############..PP..##########..PP..############..PP..############..#############.',
      '############..PP..##########..PP..############..PP..############..#############.',
    ],
  },
];

// Seeded random for reproducible level generation
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Procedurally generate a level for the given index (0-based).
 * Difficulty scales with levelIndex: more enemies, gaps, pipes, less time.
 */
function generateLevel(levelIndex) {
  const rand = seededRandom(levelIndex * 7919 + 31);
  const difficulty = Math.min(levelIndex - 2, 20); // 1 at level 4, up to 20
  const worldNum = Math.floor(levelIndex / 3) + 1;
  const stageNum = (levelIndex % 3) + 1;

  const width = 80 + Math.min(difficulty * 4, 40); // 84 to 120 tiles wide
  const height = 14;
  const skyColors = ['#5C94FC', '#000000', '#9B59B6', '#1A1A2E', '#2C3E50', '#0F3460'];
  const sky = skyColors[levelIndex % skyColors.length];

  // Initialize empty map
  const rows = [];
  for (let r = 0; r < height; r++) {
    rows.push(new Array(width).fill('.'));
  }

  // Ground rows (12 and 13)
  for (let c = 0; c < width; c++) {
    rows[12][c] = '#';
    rows[13][c] = '#';
  }

  // Player and AI start
  rows[11][0] = '1';
  rows[11][1] = '2';

  // Place flag near end
  rows[7][width - 6] = 'F';
  // Platform leading to flag
  for (let c = width - 10; c <= width - 5; c++) {
    if (c >= 0 && c < width) rows[8][c] = c < width - 7 ? '=' : '#';
  }

  // Generate gaps
  const gapCount = 2 + Math.floor(difficulty * 0.8);
  const gaps = [];
  for (let g = 0; g < gapCount; g++) {
    const pos = 14 + Math.floor(rand() * (width - 30));
    const gapWidth = 2 + (rand() < 0.3 + difficulty * 0.02 ? 1 : 0);
    let overlap = false;
    for (const prev of gaps) {
      if (Math.abs(pos - prev.pos) < 8) { overlap = true; break; }
    }
    if (overlap) continue;
    gaps.push({ pos, width: gapWidth });
    for (let i = 0; i < gapWidth; i++) {
      if (pos + i < width) {
        rows[12][pos + i] = '.';
        rows[13][pos + i] = '.';
      }
    }
  }

  // Place pipes
  const pipeCount = Math.floor(1 + difficulty * 0.5);
  const pipes = [];
  for (let p = 0; p < pipeCount; p++) {
    const pos = 18 + Math.floor(rand() * (width - 30));
    let valid = true;
    for (const prev of pipes) {
      if (Math.abs(pos - prev) < 6) { valid = false; break; }
    }
    for (const gap of gaps) {
      if (pos >= gap.pos - 2 && pos <= gap.pos + gap.width + 1) { valid = false; break; }
    }
    if (!valid) continue;
    pipes.push(pos);
    rows[10][pos] = 'P';
    rows[10][pos + 1] = 'P';
    rows[11][pos] = 'p';
    rows[11][pos + 1] = 'p';
  }

  // Place enemies
  const enemyCount = 2 + Math.floor(difficulty * 0.7);
  for (let e = 0; e < enemyCount; e++) {
    const pos = 10 + Math.floor(rand() * (width - 20));
    if (rows[12][pos] === '#' && rows[11][pos] === '.' && rows[10][pos] === '.') {
      rows[10][pos] = 'E';
    }
  }

  // Place question blocks and bricks
  const blockClusterCount = 3 + Math.floor(difficulty * 0.4);
  for (let b = 0; b < blockClusterCount; b++) {
    const pos = 8 + Math.floor(rand() * (width - 20));
    const row = rand() < 0.5 ? 8 : 9;
    const clusterWidth = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < clusterWidth; i++) {
      if (pos + i < width && rows[row][pos + i] === '.') {
        rows[row][pos + i] = rand() < 0.4 ? '?' : 'B';
      }
    }
  }

  // Place coins
  const coinClusterCount = 3 + Math.floor(difficulty * 0.3);
  for (let ci = 0; ci < coinClusterCount; ci++) {
    const pos = 8 + Math.floor(rand() * (width - 16));
    const coinRow = 5 + Math.floor(rand() * 3);
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      if (pos + i * 2 < width && rows[coinRow][pos + i * 2] === '.') {
        rows[coinRow][pos + i * 2] = 'C';
      }
    }
  }

  // Place floating platforms at higher difficulties
  if (difficulty >= 3) {
    const platCount = Math.floor(difficulty * 0.3);
    for (let p = 0; p < platCount; p++) {
      const pos = 12 + Math.floor(rand() * (width - 20));
      const platRow = 6 + Math.floor(rand() * 2);
      const platWidth = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < platWidth; i++) {
        if (pos + i < width && rows[platRow][pos + i] === '.') {
          rows[platRow][pos + i] = '=';
        }
      }
    }
  }

  const time = Math.max(180, 350 - difficulty * 12);

  return {
    name: `World ${worldNum}-${stageNum}`,
    sky,
    ground: '#C84C0C',
    time,
    map: rows.map(r => r.join('')),
  };
}

function parseLevel(levelIndex) {
  let level;
  if (levelIndex < LEVELS.length) {
    level = LEVELS[levelIndex];
  } else {
    level = generateLevel(levelIndex);
  }

  const map = level.map;
  const rows = map.length;
  const cols = Math.max(...map.map(r => r.length));

  const tiles = [];
  const entities = [];
  let playerStart = { x: 16, y: 160 };
  let aiStart = { x: 32, y: 160 };

  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c] || '.';
      tiles[r][c] = ch;

      const x = c * 16;
      const y = r * 16;

      switch (ch) {
        case 'E':
          entities.push({ type: 'enemy', subtype: 'goomba', x, y: y + 2, startX: x });
          tiles[r][c] = '.';
          break;
        case 'C':
          entities.push({ type: 'coin', x, y });
          tiles[r][c] = '.';
          break;
        case 'F':
          entities.push({ type: 'flag', x, y: y });
          tiles[r][c] = '.';
          break;
        case '1':
          playerStart = { x, y };
          tiles[r][c] = '.';
          break;
        case '2':
          aiStart = { x, y };
          tiles[r][c] = '.';
          break;
      }
    }
  }

  return {
    name: level.name,
    sky: level.sky,
    ground: level.ground,
    time: level.time,
    tiles,
    entities,
    playerStart,
    aiStart,
    rows,
    cols,
    width: cols * 16,
    height: rows * 16,
  };
}

function getLevelCount() {
  return Infinity;
}

export { LEVELS, parseLevel, getLevelCount, generateLevel };
