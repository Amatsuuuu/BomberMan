import { TILE } from './grid.js';

const BOMB_TIMER_MS = 2500;

export function createBomb(x, y, radius, ownerId, timer = BOMB_TIMER_MS) {
  return {
    x, y, radius, ownerId,
    placedAt: Date.now(),
    timer,
    remote: false,
    isNuke: false,
  };
}

export function calculateExplosion(bomb, grid) {
  const cells = [];
  cells.push({ x: bomb.x, y: bomb.y });

  const gridRows = grid.length;
  const gridCols = grid[0] ? grid[0].length : 0;
  const isNuke = bomb.isNuke;

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  if (isNuke) {
    directions.push(
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    );
  }

  for (const { dx, dy } of directions) {
    for (let i = 1; i <= bomb.radius; i++) {
      const nx = bomb.x + dx * i;
      const ny = bomb.y + dy * i;

      if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) break;

      const tile = grid[ny][nx];

      if (tile === TILE.WALL) {
        if (isNuke) {
          cells.push({ x: nx, y: ny });
          continue;
        }
        break;
      }
      if (tile === TILE.BLOCK) {
        cells.push({ x: nx, y: ny });
        if (!isNuke) break;
      } else {
        cells.push({ x: nx, y: ny });
      }
    }
  }

  return cells;
}

export function processExplosion(explosionCells, grid, players, bombs) {
  const killedPlayers = [];
  const destroyedBlocks = [];
  const chainBombs = [];

  for (const cell of explosionCells) {
    const { x, y } = cell;
    const tile = grid[y][x];

    if (tile === TILE.BLOCK) {
      destroyedBlocks.push({ x, y });
    }

    for (const [id, player] of players) {
      if (player.alive && player.x === x && player.y === y) {
        killedPlayers.push(id);
      }
    }

    for (const bomb of bombs) {
      if (bomb.x === x && bomb.y === y && !bomb._exploding) {
        chainBombs.push(bomb);
      }
    }
  }

  return { killedPlayers, destroyedBlocks, chainBombs };
}
