<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket } from './composables/useSocket.js';
import { useRoomStore } from './stores/room.js';
import { useGameStore } from './stores/game.js';

const router = useRouter();
const socket = useSocket();
const roomStore = useRoomStore();
const gameStore = useGameStore();

onMounted(() => {
  socket.on('connect', () => {
    roomStore.setMyId(socket.id);
  });

  socket.on('player-joined', (data) => {
    roomStore.updatePlayers(data);
  });

  socket.on('player-left', (data) => {
    roomStore.updatePlayers(data);
  });

  socket.on('player-updated', (data) => {
    roomStore.updatePlayers(data);
  });

  socket.on('game-started', (data) => {
    gameStore.setMyId(socket.id);
    gameStore.setGameStarted(data);
    router.push('/game');
  });

  socket.on('game-state', (state) => {
    gameStore.updateState(state);
  });

  socket.on('game-over', (data) => {
    gameStore.setGameOver(data);
    router.push('/end');
  });

  socket.on('back-to-lobby', (data) => {
    roomStore.updatePlayers(data);
    gameStore.reset();
    router.push('/lobby');
  });
});
</script>
