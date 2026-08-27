export const TILE = {
  FLOOR: 0,
  WALL: 1,
  BLOCK: 2,
  POWERUP_BOMB: 3,
  POWERUP_RADIUS: 4,
  POWERUP_SPEED: 5,
  POWERUP_KICK: 6,
  POWERUP_DETONATE: 7,
  EXPLOSION: 8,
  POWERUP_NUKE: 9,
};

export function getGridDimensions(playerCount) {
  if (playerCount <= 2) return { cols: 15, rows: 13 };
  if (playerCount <= 4) return { cols: 19, rows: 15 };
  if (playerCount <= 6) return { cols: 23, rows: 17 };
  if (playerCount <= 8) return { cols: 27, rows: 19 };
  return { cols: 31, rows: 21 };
}

const POWERUP_TYPES = [
  TILE.POWERUP_BOMB,
  TILE.POWERUP_RADIUS,
  TILE.POWERUP_SPEED,
  TILE.POWERUP_KICK,
  TILE.POWERUP_DETONATE,
];

function isEdge(x, y, cols, rows) {
  return x === 0 || x === cols - 1 || y === 0 || y === rows - 1;
}

function isCornerSafe(x, y, cols, rows) {
  return (x <= 2 && y <= 2) ||
    (x >= cols - 3 && y <= 2) ||
    (x <= 2 && y >= rows - 3) ||
    (x >= cols - 3 && y >= rows - 3);
}

function isSpawnOrAdjacent(x, y, spawns) {
  for (const s of spawns) {
    if (Math.abs(x - s.x) <= 1 && Math.abs(y - s.y) <= 1) return true;
  }
  return false;
}

const MAP_LAYOUTS = {
  classic: {
    name: 'Classic',
    desc: 'Standard bomberman grid',
    blockDensity: 0.55,
    generateWalls(cols, rows) {
      const walls = [];
      for (let y = 2; y < rows - 2; y += 2) {
        for (let x = 2; x < cols - 2; x += 2) {
          walls.push([x, y]);
        }
      }
      return walls;
    },
  },

  arena: {
    name: 'Arena',
    desc: 'Open center, walled edges',
    blockDensity: 0.45,
    generateWalls(cols, rows) {
      const walls = [];
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      for (let y = 2; y < rows - 2; y += 2) {
        for (let x = 2; x < cols - 2; x += 2) {
          if (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3) continue;
          walls.push([x, y]);
        }
      }
      const armLen = Math.floor(Math.min(cols, rows) / 4);
      for (let i = 1; i <= armLen; i++) {
        if (cy - i > 1) walls.push([cx, cy - i]);
        if (cy + i < rows - 2) walls.push([cx, cy + i]);
        if (cx - i > 1) walls.push([cx - i, cy]);
        if (cx + i < cols - 2) walls.push([cx + i, cy]);
      }
      return walls;
    },
  },

  maze: {
    name: 'Maze',
    desc: 'Tight corridors and dead ends',
    blockDensity: 0.40,
    generateWalls(cols, rows) {
      const walls = [];
      for (let x = 2; x < cols - 2; x += 2) {
        for (let y = 2; y < rows - 2; y++) {
          if (y % 3 === 0) continue;
          if (x % 4 === 0 && (y % 3 === 1)) continue;
          walls.push([x, y]);
        }
      }
      return walls;
    },
  },

  fortress: {
    name: 'Fortress',
    desc: 'Central stronghold with rooms',
    blockDensity: 0.50,
    generateWalls(cols, rows) {
      const walls = [];
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      const r = Math.floor(Math.min(cols, rows) / 4);
      for (let y = 2; y < rows - 2; y += 2) {
        for (let x = 2; x < cols - 2; x += 2) {
          walls.push([x, y]);
        }
      }
      for (let i = -r; i <= r; i++) {
        const fx = cx + i;
        const fy = cy + i;
        if (fx > 1 && fx < cols - 2 && cy - r > 1) walls.push([fx, cy - r]);
        if (fx > 1 && fx < cols - 2 && cy + r < rows - 2) walls.push([fx, cy + r]);
        if (fy > 1 && fy < rows - 2 && cx - r > 1) walls.push([cx - r, fy]);
        if (fy > 1 && fy < rows - 2 && cx + r < cols - 2) walls.push([cx + r, fy]);
      }
      return walls;
    },
  },

  scattered: {
    name: 'Scattered',
    desc: 'Random wall placement',
    blockDensity: 0.50,
    generateWalls(cols, rows) {
      const walls = [];
      for (let y = 2; y < rows - 2; y++) {
        for (let x = 2; x < cols - 2; x++) {
          if (x % 2 === 0 && y % 2 === 0) {
            walls.push([x, y]);
          } else if (Math.random() < 0.12) {
            walls.push([x, y]);
          }
        }
      }
      return walls;
    },
  },

  islands: {
    name: 'Islands',
    desc: 'Clusters of walls like islands',
    blockDensity: 0.45,
    generateWalls(cols, rows) {
      const walls = [];
      const stepX = Math.max(4, Math.floor(cols / 4));
      const stepY = Math.max(4, Math.floor(rows / 3));
      for (let cy = stepY; cy < rows - 2; cy += stepY) {
        for (let cx = stepX; cx < cols - 2; cx += stepX) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const x = cx + dx;
              const y = cy + dy;
              if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2) {
                walls.push([x, y]);
              }
            }
          }
        }
      }
      return walls;
    },
  },

  crossfire: {
    name: 'Crossfire',
    desc: 'Cross-shaped corridors',
    blockDensity: 0.50,
    generateWalls(cols, rows) {
      const walls = [];
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      const armLen = Math.floor(Math.min(cols, rows) / 4);
      for (let y = 2; y < rows - 2; y += 2) {
        for (let x = 2; x < cols - 2; x += 2) {
          const dx = Math.abs(x - cx);
          const dy = Math.abs(y - cy);
          if (dx >= armLen || dy >= armLen) {
            walls.push([x, y]);
          }
        }
      }
      for (let i = 1; i < armLen; i++) {
        if (cy - i > 1) walls.push([cx, cy - i]);
        if (cy + i < rows - 2) walls.push([cx, cy + i]);
        if (cx - i > 1) walls.push([cx - i, cy]);
        if (cx + i < cols - 2) walls.push([cx + i, cy]);
      }
      return walls;
    },
  },

  blitz: {
    name: 'Blitz',
    desc: 'Minimal walls, fast action',
    blockDensity: 0.30,
    generateWalls(cols, rows) {
      const walls = [];
      for (let y = 2; y < rows - 2; y += 4) {
        for (let x = 2; x < cols - 2; x += 4) {
          walls.push([x, y]);
        }
      }
      const cx = Math.floor(cols / 2);
      const cy = Math.floor(rows / 2);
      walls.push([cx, cy - 2]);
      walls.push([cx, cy + 2]);
      return walls;
    },
  },
};

export const MAP_IDS = Object.keys(MAP_LAYOUTS);

export function getMapInfo() {
  return MAP_IDS.map(id => ({
    id,
    name: MAP_LAYOUTS[id].name,
    desc: MAP_LAYOUTS[id].desc,
  }));
}

export function getSpawnPositions(playerCount, cols, rows) {
  const marginX = cols - 2;
  const marginY = rows - 2;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);

  const allSpawns = [
    { x: 1, y: 1 },
    { x: marginX, y: 1 },
    { x: 1, y: marginY },
    { x: marginX, y: marginY },
    { x: midX, y: 1 },
    { x: midX, y: marginY },
    { x: 1, y: midY },
    { x: marginX, y: midY },
    { x: Math.floor(cols / 4), y: Math.floor(rows / 4) },
    { x: Math.floor(cols * 3 / 4), y: Math.floor(rows * 3 / 4) },
  ];
  return allSpawns.slice(0, playerCount);
}

export function createGrid(mapId = 'classic', playerCount = 2, nukeCount = 1) {
  const layout = MAP_LAYOUTS[mapId] || MAP_LAYOUTS.classic;
  const { cols, rows } = getGridDimensions(playerCount);
  const spawns = getSpawnPositions(playerCount, cols, rows);

  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      if (isEdge(x, y, cols, rows)) {
        grid[y][x] = TILE.WALL;
      } else {
        grid[y][x] = TILE.FLOOR;
      }
    }
  }

  const walls = layout.generateWalls(cols, rows);
  for (const [x, y] of walls) {
    if (x >= 0 && x < cols && y >= 0 && y < rows && !isEdge(x, y, cols, rows)) {
      grid[y][x] = TILE.WALL;
    }
  }

  const density = layout.blockDensity;
  const floorTiles = [];
  for (let y = 2; y < rows - 2; y++) {
    for (let x = 2; x < cols - 2; x++) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      if (isCornerSafe(x, y, cols, rows)) continue;
      if (isSpawnOrAdjacent(x, y, spawns)) continue;
      if (Math.random() < density) {
        grid[y][x] = TILE.BLOCK;
        floorTiles.push([x, y]);
      }
    }
  }

  const count = Math.max(0, Math.min(Math.floor(nukeCount) || 0, floorTiles.length));
  const nukePositions = [];
  // shuffle floorTiles with Fisher-Yates then take first `count`
  for (let i = floorTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [floorTiles[i], floorTiles[j]] = [floorTiles[j], floorTiles[i]];
  }
  for (let i = 0; i < count; i++) {
    const [nx, ny] = floorTiles[i];
    grid[ny][nx] = TILE.BLOCK;
    nukePositions.push({ x: nx, y: ny });
  }

  // legacy single field for backwards compat
  const nukePos = nukePositions[0] || null;
  return { grid, nukePos, nukePositions, cols, rows };
}

export function spawnPowerup(grid, x, y) {
  if (Math.random() < 0.35) {
    grid[y][x] = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  } else {
    grid[y][x] = TILE.FLOOR;
  }
}

export function isWalkable(grid, x, y) {
  if (y < 0 || y >= grid.length || x < 0 || x >= (grid[0] ? grid[0].length : 0)) return false;
  const tile = grid[y][x];
  return tile === TILE.FLOOR || (tile >= TILE.POWERUP_BOMB && tile <= TILE.POWERUP_DETONATE) || tile === TILE.POWERUP_NUKE;
}
