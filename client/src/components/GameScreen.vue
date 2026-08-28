<template>
  <div class="game-container" @contextmenu.prevent>
    <div ref="boardWrap" class="board-wrap">
      <canvas ref="canvas"></canvas>
      <div class="bomb-layer">
        <img
          v-for="(bomb, i) in gameStore.bombs"
          :key="i + '-' + bomb.x + '-' + bomb.y"
          :src="bombGif"
          class="bomb-gif"
          :style="bombStyle(bomb)"
          draggable="false"
        />
      </div>
      <!-- Nuke explosions: DOM overlay so nuke_explosion.gif animates (canvas drawImage freezes GIF) -->
      <div class="nuke-layer">
        <template v-for="(exp, ei) in gameStore.explosions.filter(e => e.isNuke)" :key="ei + '-' + exp.createdAt">
          <img
            v-for="(cell, ci) in exp.cells"
            :key="ei + '-' + ci"
            :src="nukeExplosionGif"
            class="nuke-gif"
            :style="nukeStyle(cell, exp)"
            draggable="false"
          />
        </template>
      </div>
    </div>
    <Hud />

    <div v-if="!isMobile" class="powerup-legend" :class="{ collapsed: legendCollapsed }">
      <button class="legend-toggle" @click="legendCollapsed = !legendCollapsed">{{ legendCollapsed ? 'Power-Ups' : '—' }}</button>
      <template v-if="!legendCollapsed">
        <div class="legend-item"><span class="legend-dot" style="background:#ff4444"></span> B &mdash; Extra Bomb</div>
        <div class="legend-item"><span class="legend-dot" style="background:#ff8800"></span> R &mdash; Blast Radius</div>
        <div class="legend-item"><span class="legend-dot" style="background:#44ff44"></span> S &mdash; Speed Up</div>
        <div class="legend-item"><span class="legend-dot" style="background:#4488ff"></span> K &mdash; Kick Bombs</div>
        <div class="legend-item"><span class="legend-dot" style="background:#ff44ff"></span> D &mdash; Remote Detonate</div>
        <div class="legend-item"><span class="legend-dot" style="background:#00ff88"></span> N &mdash; Nuke (10-tile radius!)</div>
      </template>
    </div>

    <div class="voice-control">
      <button class="voice-btn" @click="toggleVoice">
        {{ voiceEnabled ? (voiceMuted ? 'Muted' : 'Mic On') : 'Mic Off' }}
      </button>
    </div>

    <div v-if="isMobile" class="touch-controls">
      <div class="dpad">
        <button class="dpad-btn up" @touchstart.prevent="touchMove(0,-1)" @touchend.prevent="touchStop">&#9650;</button>
        <button class="dpad-btn left" @touchstart.prevent="touchMove(-1,0)" @touchend.prevent="touchStop">&#9664;</button>
        <button class="dpad-btn right" @touchstart.prevent="touchMove(1,0)" @touchend.prevent="touchStop">&#9654;</button>
        <button class="dpad-btn down" @touchstart.prevent="touchMove(0,1)" @touchend.prevent="touchStop">&#9660;</button>
      </div>
      <button class="bomb-btn" @touchstart.prevent="placeBomb">Bomb</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket } from '../composables/useSocket.js';
import { useGameStore } from '../stores/game.js';
import { useVoiceStore } from '../stores/voice.js';
import { useWebRTC } from '../composables/useWebRTC.js';
import { TILE } from '../tileConstants.js';
import Hud from './Hud.vue';

import bomberRed from '../assets/bomber_red.svg';
import bomberBlue from '../assets/bomber_blue.svg';
import bomberGreen from '../assets/bomber_green.svg';
import bomberYellow from '../assets/bomber_yellow.svg';
import bomberOrange from '../assets/bomber_orange.svg';
import bomberPink from '../assets/bomber_pink.svg';
import bomberPurple from '../assets/bomber_purple.svg';
import bomberCyan from '../assets/bomber_cyan.svg';
import bomberWhite from '../assets/bomber_white.svg';
import bomberBlack from '../assets/bomber_black.svg';
import bombGif from '../assets/bomb_animated.gif';
import nukeExplosionGif from '../assets/nuke_explosion.gif';

const CHARACTER_SVGS = [
  bomberRed, bomberBlue, bomberGreen, bomberYellow, bomberOrange,
  bomberPink, bomberPurple, bomberCyan, bomberWhite, bomberBlack,
];

const router = useRouter();
const socket = useSocket();
const gameStore = useGameStore();
const voiceStore = useVoiceStore();
const { setupSignaling, initiateCall, peerConnections } = useWebRTC(socket);

const canvas = ref(null);
const isMobile = ref(false);
const legendCollapsed = ref(false);
const voiceEnabled = ref(false);
const voiceMuted = computed(() => voiceStore.muted);
let animFrame = null;
let inputInterval = null;
let currentInput = null;

let ts = 48;
let cols = 15;
let rows = 13;

const loadedImages = {};
let bombImage = null;
let nukeExplosionImage = null;
const characterMap = {};

const TILE_COLORS = {
  [TILE.FLOOR]: '#2d2d44',
  [TILE.WALL]: '#555577',
  [TILE.BLOCK]: '#8B6914',
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function buildCharacterMap(playerIds) {
  const sorted = [...playerIds].sort();
  sorted.forEach((id, i) => {
    characterMap[id] = CHARACTER_SVGS[i % CHARACTER_SVGS.length];
  });
}

onMounted(async () => {
  isMobile.value = 'ontouchstart' in window;
  setupSignaling();
  setupInput();
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  renderLoop();

  const allSrcs = [...CHARACTER_SVGS, bombGif, nukeExplosionGif];
  const imgs = await Promise.all(allSrcs.map(src => loadImage(src)));
  allSrcs.forEach((src, i) => { loadedImages[src] = imgs[i]; });
  bombImage = loadedImages[bombGif];
  nukeExplosionImage = loadedImages[nukeExplosionGif];

  buildCharacterMap(Object.keys(gameStore.players));

  socket.on('game-over', () => {});
});

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame);
  if (inputInterval) clearInterval(inputInterval);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('resize', updateCanvasSize);
});

function setupInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function onKeyDown(e) {
  if (e.repeat) return;
  const map = {
    'ArrowUp': { type: 'move', dx: 0, dy: -1 },
    'ArrowDown': { type: 'move', dx: 0, dy: 1 },
    'ArrowLeft': { type: 'move', dx: -1, dy: 0 },
    'ArrowRight': { type: 'move', dx: 1, dy: 0 },
    'w': { type: 'move', dx: 0, dy: -1 },
    's': { type: 'move', dx: 0, dy: 1 },
    'a': { type: 'move', dx: -1, dy: 0 },
    'd': { type: 'move', dx: 1, dy: 0 },
  };

  if (map[e.key]) {
    e.preventDefault();
    currentInput = map[e.key];
    startMoveLoop();
    sendInput(currentInput);
  }

  if (e.key === ' ') {
    e.preventDefault();
    placeBomb();
  }

  if (e.key === 'e' && gameStore.myCanDetonate) {
    socket.emit('remote-detonate');
  }
}

function onKeyUp(e) {
  const map = {
    'ArrowUp': { type: 'move', dx: 0, dy: -1 },
    'ArrowDown': { type: 'move', dx: 0, dy: 1 },
    'ArrowLeft': { type: 'move', dx: -1, dy: 0 },
    'ArrowRight': { type: 'move', dx: 1, dy: 0 },
    'w': { type: 'move', dx: 0, dy: -1 },
    's': { type: 'move', dx: 0, dy: 1 },
    'a': { type: 'move', dx: -1, dy: 0 },
    'd': { type: 'move', dx: 1, dy: 0 },
  };

  if (map[e.key] && currentInput && map[e.key].dx === currentInput.dx && map[e.key].dy === currentInput.dy) {
    currentInput = null;
    stopMoveLoop();
  }
}

function startMoveLoop() {
  stopMoveLoop();
  inputInterval = setInterval(() => {
    if (currentInput) sendInput(currentInput);
  }, 120);
}

function stopMoveLoop() {
  if (inputInterval) {
    clearInterval(inputInterval);
    inputInterval = null;
  }
}

function sendInput(input) {
  socket.emit('player-input', input);
}

function placeBomb() {
  socket.emit('player-input', { type: 'bomb' });
}

function touchMove(dx, dy) {
  currentInput = { type: 'move', dx, dy };
  sendInput(currentInput);
  startMoveLoop();
}

function touchStop() {
  currentInput = null;
  stopMoveLoop();
}

async function toggleVoice() {
  if (voiceEnabled.value) {
    const { stopVoice } = useWebRTC(socket);
    stopVoice();
    voiceEnabled.value = false;
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceStore.setLocalStream(stream);
    voiceStore.setEnabled(true);
    voiceEnabled.value = true;
    for (const [peerId] of peerConnections.value) {
      initiateCall(peerId);
    }
  }
}

function bombStyle(bomb) {
  const s = ts * 0.85;
  return {
    left: bomb.x * ts + (ts - s) / 2 + 'px',
    top: bomb.y * ts + (ts - s) / 2 + 'px',
    width: s + 'px',
    height: s + 'px',
  };
}
function nukeStyle(cell, exp) {
  const elapsed = Date.now() - exp.createdAt;
  const alpha = Math.max(0, 1 - elapsed / exp.duration);
  return {
    left: cell.x * ts + 'px',
    top: cell.y * ts + 'px',
    width: ts + 'px',
    height: ts + 'px',
    opacity: alpha,
  };
}

function updateCanvasSize() {
  const cvs = canvas.value;
  if (!cvs) return;
  cols = gameStore.gridCols;
  rows = gameStore.gridRows;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 120;
  ts = Math.min(Math.max(Math.min(Math.floor(maxW / cols), Math.floor(maxH / rows)), 24), 48);
  const cw = cols * ts;
  const ch = rows * ts;
  if (cvs.width !== cw || cvs.height !== ch) {
    cvs.width = cw;
    cvs.height = ch;
  }
}

function renderLoop() {
  render();
  animFrame = requestAnimationFrame(renderLoop);
}

function render() {
  const cvs = canvas.value;
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const grid = gameStore.grid;

  if (!grid) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Starting game...', cw / 2, ch / 2);
    return;
  }

  const playerIds = Object.keys(gameStore.players);
  if (playerIds.length > 0 && Object.keys(characterMap).length === 0) {
    buildCharacterMap(playerIds);
  }

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, cw, ch);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = grid[y][x];
      const px = x * ts;
      const py = y * ts;

      if (tile === TILE.WALL) {
        drawWall(ctx, px, py);
      } else if (tile === TILE.BLOCK) {
        drawBlock(ctx, px, py);
      } else if ((tile >= TILE.POWERUP_BOMB && tile <= TILE.POWERUP_DETONATE) || tile === TILE.POWERUP_NUKE) {
        drawFloor(ctx, px, py);
        drawPowerup(ctx, px, py, tile);
      } else {
        drawFloor(ctx, px, py);
      }
    }
  }

  // bombs are rendered as DOM <img> overlay (GIF animates natively, canvas drawImage would freeze on first frame)

  for (const explosion of gameStore.explosions) {
    if (explosion.isNuke) continue; // nukes rendered as DOM overlay (GIF animates)
    const elapsed = Date.now() - explosion.createdAt;
    const alpha = Math.max(0, 1 - elapsed / explosion.duration);
    for (const cell of explosion.cells) {
      const px = cell.x * ts;
      const py = cell.y * ts;
      ctx.fillStyle = `rgba(255, 200, 0, ${alpha * 0.7})`;
      ctx.fillRect(px, py, ts, ts);
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.5})`;
      ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
    }
  }

  for (const death of gameStore.deaths) {
    drawDeath(ctx, death);
  }

  for (const [id, p] of Object.entries(gameStore.players)) {
    if (!p.alive) continue;
    drawCharacter(ctx, id, p);
  }
}

function drawFloor(ctx, px, py) {
  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(px, py, ts, ts);
  ctx.strokeStyle = '#353555';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
}

function drawWall(ctx, px, py) {
  ctx.fillStyle = '#3a3a5c';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = '#4a4a7c';
  ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
  ctx.fillStyle = '#555590';
  ctx.fillRect(px + 4, py + 4, ts / 2 - 5, ts / 2 - 5);
  ctx.fillRect(px + ts / 2 + 1, py + ts / 2 + 1, ts / 2 - 5, ts / 2 - 5);
}

function drawBlock(ctx, px, py) {
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(px, py, ts, ts);
  ctx.fillStyle = '#A07A1A';
  ctx.fillRect(px + 2, py + 2, ts / 2 - 3, ts / 2 - 3);
  ctx.fillRect(px + ts / 2 + 1, py + ts / 2 + 1, ts / 2 - 3, ts / 2 - 3);
  ctx.strokeStyle = '#6B5010';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
}

function drawPowerup(ctx, px, py, tile) {
  const colors = {
    [TILE.POWERUP_BOMB]: '#ff4444',
    [TILE.POWERUP_RADIUS]: '#ff8800',
    [TILE.POWERUP_SPEED]: '#44ff44',
    [TILE.POWERUP_KICK]: '#4488ff',
    [TILE.POWERUP_DETONATE]: '#ff44ff',
    [TILE.POWERUP_NUKE]: '#00ff88',
  };
  const labels = {
    [TILE.POWERUP_BOMB]: 'B',
    [TILE.POWERUP_RADIUS]: 'R',
    [TILE.POWERUP_SPEED]: 'S',
    [TILE.POWERUP_KICK]: 'K',
    [TILE.POWERUP_DETONATE]: 'D',
    [TILE.POWERUP_NUKE]: 'N',
  };

  const cx = px + ts / 2;
  const cy = py + ts / 2;
  const r = ts / 4;

  const glow = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
  ctx.shadowColor = colors[tile];
  ctx.shadowBlur = 8 * glow;
  ctx.fillStyle = colors[tile];
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labels[tile] || '?', cx, cy);
}

// drawBomb removed — bombs now rendered as DOM <img :src="bomb_animated.gif"> overlay so GIF animates (canvas drawImage freezes GIF to frame 0)

function drawCharacter(ctx, id, p) {
  const px = p.x * ts;
  const py = p.y * ts;
  const isMe = id === gameStore.myId;

  const src = characterMap[id] || CHARACTER_SVGS[0];
  const img = loadedImages[src];

  const size = ts * 0.9;
  const cx = px + ts / 2;
  const cy = py + ts / 2;

  if (isMe) {
    ctx.shadowColor = '#ff6b35';
    ctx.shadowBlur = 10;
  }

  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(cx, cy, ts / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText(p.name, cx, py - 2);
  ctx.fillText(p.name, cx, py - 2);
}

function drawDeath(ctx, death) {
  const now = Date.now();
  const elapsed = now - death.createdAt;
  const duration = 2000;
  if (elapsed >= duration) return;

  const progress = elapsed / duration;
  const px = death.x * ts + ts / 2;
  const py = death.y * ts + ts / 2;

  const numParticles = 12;
  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2;
    const dist = progress * ts * 1.5;
    const particleX = px + Math.cos(angle) * dist;
    const particleY = py + Math.sin(angle) * dist;
    const size = ts * 0.15 * (1 - progress);
    const alpha = 1 - progress;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 2 === 0 ? '#ff4444' : '#ff8800';
    ctx.beginPath();
    ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const flash = progress < 0.3;
  if (flash) {
    const flashAlpha = (0.3 - progress) / 0.3;
    ctx.globalAlpha = flashAlpha * 0.6;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(px, py, ts * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const ringProgress = Math.min(1, progress * 2);
  const ringRadius = ts * 0.3 + ringProgress * ts * 0.6;
  const ringAlpha = Math.max(0, 1 - ringProgress);
  ctx.globalAlpha = ringAlpha;
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  const textAlpha = Math.max(0, 1 - progress * 1.5);
  ctx.globalAlpha = textAlpha;
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', px, py - progress * ts * 0.3);

  ctx.globalAlpha = 1;
}
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0f0c29;
  position: relative;
}
.board-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
}
canvas {
  border: 2px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  image-rendering: auto;
  display: block;
}
.bomb-layer {
  position: absolute;
  inset: 2px;
  pointer-events: none;
}
.bomb-gif {
  position: absolute;
  object-fit: contain;
  image-rendering: auto;
  pointer-events: none;
  user-select: none;
}
.nuke-layer {
  position: absolute;
  inset: 2px;
  pointer-events: none;
}
.nuke-gif {
  position: absolute;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
.powerup-legend {
  position: fixed;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.65);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.78rem;
  color: #ddd;
  min-width: 170px;
  transition: min-width 0.2s, padding 0.2s;
}
.powerup-legend.collapsed {
  min-width: 0;
  padding: 8px 12px;
}
.legend-toggle {
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  align-self: flex-end;
}
.legend-toggle:hover { background: rgba(255,255,255,0.1); }
.collapsed .legend-toggle { margin-bottom: 0; }
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}
.voice-control {
  position: fixed;
  top: 12px;
  right: 12px;
}
.voice-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  font-size: 0.75rem;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.voice-btn:hover { background: rgba(255,255,255,0.15); }
.touch-controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 40px;
}
.dpad {
  display: grid;
  grid-template-areas:
    '. up .'
    'left . right'
    '. down .';
  gap: 4px;
}
.dpad-btn {
  width: 56px;
  height: 56px;
  font-size: 1.4rem;
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  border-radius: 12px;
  cursor: pointer;
}
.dpad-btn.up { grid-area: up; }
.dpad-btn.down { grid-area: down; }
.dpad-btn.left { grid-area: left; }
.dpad-btn.right { grid-area: right; }
.bomb-btn {
  width: 72px;
  height: 72px;
  font-size: 1rem;
  font-weight: 700;
  background: rgba(255, 100, 50, 0.3);
  border: 2px solid rgba(255, 100, 50, 0.5);
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
}
</style>
