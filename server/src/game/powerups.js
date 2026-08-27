import { TILE } from './grid.js';

export function applyPowerup(player, tileType) {
  switch (tileType) {
    case TILE.POWERUP_BOMB:
      player.maxBombs = (player.maxBombs || 1) + 1;
      break;
    case TILE.POWERUP_RADIUS:
      player.blastRadius = (player.blastRadius || 1) + 1;
      break;
    case TILE.POWERUP_SPEED:
      player.speed = (player.speed || 1) + 0.5;
      break;
    case TILE.POWERUP_KICK:
      player.canKick = true;
      break;
    case TILE.POWERUP_DETONATE:
      player.canDetonate = true;
      break;
  }
}
