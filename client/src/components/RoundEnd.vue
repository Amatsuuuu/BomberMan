<template>
  <div class="round-end">
    <div class="card">
      <h1 v-if="winner">🏆 {{ winner.winnerName }} Wins!</h1>
      <h1 v-else>Draw!</h1>

      <p class="stats">{{ winner?.playerCount }} players competed</p>

      <div class="actions">
        <button v-if="roomStore.isHost" class="btn primary" @click="playAgain">Play Again</button>
        <button class="btn secondary" @click="leaveRoom">Leave Room</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket } from '../composables/useSocket.js';
import { useRoomStore } from '../stores/room.js';
import { useGameStore } from '../stores/game.js';

const router = useRouter();
const socket = useSocket();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const winner = computed(() => gameStore.winner);

onMounted(() => {
  socket.on('back-to-lobby', () => {
    router.push('/lobby');
  });
});

onUnmounted(() => {
  socket.off('back-to-lobby');
});

function playAgain() {
  socket.emit('play-again', null, (res) => {
    if (res?.error) console.error(res.error);
  });
}

function leaveRoom() {
  socket.disconnect();
  socket.connect();
  roomStore.reset();
  gameStore.reset();
  router.push('/');
}
</script>

<style scoped>
.round-end {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
}
.card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 48px;
  text-align: center;
  min-width: 360px;
}
h1 {
  font-size: 2.2rem;
  margin-bottom: 12px;
}
.stats {
  color: #aaa;
  margin-bottom: 32px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn {
  padding: 14px 28px;
  border-radius: 8px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.primary { background: #ff6b35; color: #fff; }
.primary:hover { background: #e55a2b; }
.secondary { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
.secondary:hover { background: rgba(255,255,255,0.15); }
</style>
