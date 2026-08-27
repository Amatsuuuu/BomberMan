<template>
  <div class="hud">
    <div class="stat" title="Bombs">
      <span class="icon">💣</span>
      <span class="value">{{ gameStore.myMaxBombs - gameStore.myBombs }}/{{ gameStore.myMaxBombs }}</span>
    </div>
    <div class="stat" title="Blast Radius">
      <span class="icon">🔥</span>
      <span class="value">{{ gameStore.myBlastRadius }}</span>
    </div>
    <div class="stat" title="Speed">
      <span class="icon">⚡</span>
      <span class="value">{{ gameStore.mySpeed.toFixed(1) }}</span>
    </div>
    <div v-if="gameStore.myCanKick" class="stat power" title="Kick">
      <span class="icon">🦶</span>
    </div>
    <div v-if="gameStore.myCanDetonate" class="stat power" title="Remote Detonate (E)">
      <span class="icon">🎯</span>
    </div>
    <div v-if="gameStore.myHasNuke" class="stat nuke" title="Nuke Ready!">
      <span class="icon">☢️</span>
      <span class="value">NUKE</span>
    </div>
    <div class="stat alive" title="Players Remaining">
      <span class="icon">👥</span>
      <span class="value">{{ aliveCount }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGameStore } from '../stores/game.js';

const gameStore = useGameStore();

const aliveCount = computed(() => {
  return Object.values(gameStore.players).filter(p => p.alive).length;
});
</script>

<style scoped>
.hud {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  background: rgba(0,0,0,0.6);
  border-radius: 0 0 8px 8px;
  border: 1px solid rgba(255,255,255,0.1);
  border-top: none;
}
.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
}
.icon { font-size: 1.1rem; }
.value { font-weight: 600; color: #ff6b35; }
.power .icon { color: #ffcc00; }
.nuke .icon { color: #00ff88; }
.nuke .value { color: #00ff88; font-weight: 700; text-shadow: 0 0 6px #00ff88; }
.alive .value { color: #4ecdc4; }
</style>
