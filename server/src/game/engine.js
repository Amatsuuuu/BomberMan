import { createGrid, spawnPowerup, isWalkable, getSpawnPositions, TILE } from './grid.js';
import { createBomb, calculateExplosion, processExplosion } from './bombs.js';
import { applyPowerup } from './powerups.js';

const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;
const MOVE_INTERVAL_BASE = 150;
const POWERUP_TYPES = [TILE.POWERUP_BOMB, TILE.POWERUP_RADIUS, TILE.POWERUP_SPEED, TILE.POWERUP_KICK, TILE.POWERUP_DETONATE];

export function createGame(roomCode, playerEntries, mapId, nukeCount = 1) {
  const playerCount = playerEntries.length;
  const { grid, nukePos, nukePositions, cols, rows } = createGrid(mapId, playerCount, nukeCount);
  const spawns = getSpawnPositions(playerCount, cols, rows);

  const players = new Map();
  playerEntries.forEach(([id, info], i) => {
    const spawn = spawns[i];
    players.set(id, {
      id,
      name: info.name,
      x: spawn.x,
      y: spawn.y,
      alive: true,
      maxBombs: 1,
      activeBombs: 0,
      blastRadius: 1,
      speed: 1,
      canKick: false,
      canDetonate: false,
      hasNuke: false,
      lastMove: 0,
      inputQueue: [],
    });
  });

  const state = {
    roomCode,
    grid,
    players,
    bombs: [],
    explosions: [],
    deaths: [],
    nukePos,
    nukePositions: nukePositions || (nukePos ? [nukePos] : []),
    revealedNukes: new Set(),
    cols,
    rows,
    status: 'active',
    startedAt: Date.now(),
    tickInterval: null,
    onStateUpdate: null,
    onGameOver: null,
  };

  return state;
}

export function startGameLoop(state) {
  state.tickInterval = setInterval(() => tick(state), TICK_MS);
}

export function stopGameLoop(state) {
  if (state.tickInterval) {
    clearInterval(state.tickInterval);
    state.tickInterval = null;
  }
}

let _lastBroadcast = 0;
function tick(state) {
  const now = Date.now();
  processBombs(state, now);
  processPlayers(state, now);
  checkWinCondition(state);

  state.explosions = state.explosions.filter(e => now - e.createdAt < e.duration);
  state.deaths = state.deaths.filter(d => now - d.createdAt < 2000);

  if (state.onStateUpdate && state.status === 'active' && !state._pendingBroadcast) {
    // throttle to tick rate, avoid double emit from explodeBomb in same tick
    if (now - _lastBroadcast >= TICK_MS - 2) {
      _lastBroadcast = now;
      state.onStateUpdate(serializeState(state));
    } else {
      state._pendingBroadcast = true;
      setTimeout(() => {
        state._pendingBroadcast = false;
        if (state.status === 'active' && state.onStateUpdate) {
          _lastBroadcast = Date.now();
          state.onStateUpdate(serializeState(state));
        }
      }, TICK_MS - (now - _lastBroadcast));
    }
  }
}

function processBombs(state, now) {
  const toExplode = [];

  for (const bomb of state.bombs) {
    if (!bomb.remote && now - bomb.placedAt >= bomb.timer) {
      toExplode.push(bomb);
    }
  }

  for (const bomb of toExplode) {
    explodeBomb(state, bomb, now);
  }

  state.bombs = state.bombs.filter(b => !b._exploding);
}

function explodeBomb(state, bomb, now) {
  bomb._exploding = true;

  const explosionCells = calculateExplosion(bomb, state.grid);

  const { killedPlayers, destroyedBlocks, chainBombs } = processExplosion(
    explosionCells, state.grid, state.players, state.bombs
  );

  for (const { x, y } of destroyedBlocks) {
    const nukeIdx = state.nukePositions.findIndex(p => p.x === x && p.y === y);
    if (nukeIdx !== -1 && !state.revealedNukes.has(nukeIdx)) {
      state.grid[y][x] = TILE.POWERUP_NUKE;
      state.revealedNukes.add(nukeIdx);
    } else {
      spawnPowerup(state.grid, x, y);
    }
  }

  for (const id of killedPlayers) {
    const player = state.players.get(id);
    if (player) {
      state.deaths.push({
        x: player.x,
        y: player.y,
        name: player.name,
        createdAt: now,
      });
      player.alive = false;
    }
  }

  state.explosions.push({
    cells: explosionCells,
    createdAt: now,
    duration: bomb.isNuke ? 2200 : 500,
    isNuke: !!bomb.isNuke,
  });

  const owner = state.players.get(bomb.ownerId);
  if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

  for (const chainBomb of chainBombs) {
    chainBomb._exploding = true;
    explodeBomb(state, chainBomb, now);
  }

  state.explosions = state.explosions.filter(e => now - e.createdAt < e.duration);
  // broadcast is handled by tick loop to avoid duplicate emits
}

function processPlayers(state, now) {
  for (const [id, player] of state.players) {
    if (!player.alive) continue;
    if (player.inputQueue.length === 0) continue;

    const moveInterval = MOVE_INTERVAL_BASE / player.speed;
    if (now - player.lastMove < moveInterval) continue;

    const input = player.inputQueue.shift();
    handleInput(state, player, input, now);
  }
}

function handleInput(state, player, input, now) {
  if (input.type === 'move') {
    const { dx, dy } = input;
    const nx = player.x + dx;
    const ny = player.y + dy;

    if (isWalkable(state.grid, nx, ny)) {
      const occupied = [...state.players.values()].some(
        p => p.alive && p.id !== player.id && p.x === nx && p.y === ny
      );
      const bombBlocking = state.bombs.some(
        b => !b._exploding && b.x === nx && b.y === ny
      );

      if (!occupied && !bombBlocking) {
        player.x = nx;
        player.y = ny;
        player.lastMove = now;

        checkPowerupPickup(state, player);
      } else if (bombBlocking && player.canKick) {
        kickBomb(state, player, dx, dy, nx, ny);
        player.lastMove = now;
      }
    }
  } else if (input.type === 'bomb') {
    placeBomb(state, player);
  }
}

function checkPowerupPickup(state, player) {
  const tile = state.grid[player.y][player.x];
  if (tile === TILE.POWERUP_NUKE) {
    player.hasNuke = true;
    state.grid[player.y][player.x] = TILE.FLOOR;
  } else if (tile >= TILE.POWERUP_BOMB && tile <= TILE.POWERUP_DETONATE) {
    applyPowerup(player, tile);
    state.grid[player.y][player.x] = TILE.FLOOR;
  }
}

function kickBomb(state, player, dx, dy, bx, by) {
  const bomb = state.bombs.find(b => !b._exploding && b.x === bx && b.y === by);
  if (!bomb) return;

  let nx = bx, ny = by;
  for (let i = 1; i < 4; i++) {
    const tx = bx + dx * i;
    const ty = by + dy * i;
    if (!isWalkable(state.grid, tx, ty)) break;
    if (state.bombs.some(b => !b._exploding && b !== bomb && b.x === tx && b.y === ty)) break;
    if ([...state.players.values()].some(p => p.alive && p.x === tx && p.y === ty)) break;
    nx = tx;
    ny = ty;
  }

  bomb.x = nx;
  bomb.y = ny;
}

function placeBomb(state, player) {
  if (player.activeBombs >= player.maxBombs) return;

  const alreadyThere = state.bombs.some(
    b => !b._exploding && b.x === player.x && b.y === player.y
  );
  if (alreadyThere) return;

  const radius = player.hasNuke ? 10 : player.blastRadius;
  const bomb = createBomb(player.x, player.y, radius, player.id);
  bomb.isNuke = player.hasNuke;
  state.bombs.push(bomb);
  player.activeBombs++;
  if (player.hasNuke) player.hasNuke = false;
}

function checkWinCondition(state) {
  const alive = [...state.players.values()].filter(p => p.alive);

  if (alive.length <= 1 && state.status === 'active') {
    state.status = 'finished';
    const winner = alive[0] || null;
    stopGameLoop(state);

    if (state.onGameOver) {
      state.onGameOver({
        winnerId: winner?.id || null,
        winnerName: winner?.name || null,
        playerCount: state.players.size,
      });
    }
  }
}

function serializeState(state) {
  return {
    grid: state.grid,
    cols: state.cols,
    rows: state.rows,
    players: Object.fromEntries(
      [...state.players.entries()].map(([id, p]) => [id, {
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        alive: p.alive,
        maxBombs: p.maxBombs,
        activeBombs: p.activeBombs,
        blastRadius: p.blastRadius,
        speed: p.speed,
        canKick: p.canKick,
        canDetonate: p.canDetonate,
        hasNuke: p.hasNuke,
      }])
    ),
    bombs: state.bombs.filter(b => !b._exploding).map(b => ({
      x: b.x,
      y: b.y,
      ownerId: b.ownerId,
      timer: b.timer,
      placedAt: b.placedAt,
      isNuke: b.isNuke || false,
    })),
    explosions: state.explosions.map(e => ({
      cells: e.cells,
      createdAt: e.createdAt,
      duration: e.duration,
      isNuke: e.isNuke || false,
    })),
    deaths: state.deaths.map(d => ({
      x: d.x,
      y: d.y,
      name: d.name,
      createdAt: d.createdAt,
    })),
  };
}

export function queueInput(state, playerId, input) {
  const player = state.players.get(playerId);
  if (!player || !player.alive) return;

  if (input.type === 'bomb') {
    handleInput(state, player, input, Date.now());
  } else {
    if (player.inputQueue.length < 3) {
      player.inputQueue.push(input);
    }
  }
}

export function detonateRemote(state, playerId) {
  const player = state.players.get(playerId);
  if (!player || !player.alive || !player.canDetonate) return;

  const playerBombs = state.bombs.filter(
    b => !b._exploding && b.ownerId === playerId
  );

  for (const bomb of playerBombs) {
    explodeBomb(state, bomb, Date.now());
  }

  state.bombs = state.bombs.filter(b => !b._exploding);
}
