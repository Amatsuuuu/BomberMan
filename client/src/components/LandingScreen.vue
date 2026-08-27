<template>
  <div class="landing">
    <div class="card">
      <h1>BOMB<span class="accent">MAN</span></h1>
      <p class="subtitle">Multiplayer Bomberman</p>

      <div class="status" :class="{ ok: isConnected }">
        {{ isConnected ? 'Connected to server' : 'Connecting to server...' }}
      </div>

      <div class="form-group">
        <label>Display Name</label>
        <input v-model="name" maxlength="20" placeholder="Enter your name" @keyup.enter="tryCreateRoom" />
      </div>

      <div class="actions">
        <button class="btn primary" :disabled="!name.trim() || !isConnected || processing" @click="tryCreateRoom">
          {{ processing ? 'Creating...' : 'Create Room' }}
        </button>

        <div class="divider">or</div>

        <div class="form-group">
          <label>Room Code</label>
          <input
            v-model="joinCode"
            maxlength="6"
            placeholder="e.g. X7K2Q"
            @keyup.enter="tryJoinRoom"
            style="text-transform: uppercase; letter-spacing: 4px; text-align: center; font-size: 1.3rem;"
          />
        </div>

        <button class="btn secondary" :disabled="!name.trim() || !joinCode.trim() || !isConnected || processing" @click="tryJoinRoom">
          {{ processing ? 'Joining...' : 'Join Room' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket, useSocketConnected } from '../composables/useSocket.js';
import { useRoomStore } from '../stores/room.js';
import { useGameStore } from '../stores/game.js';

const router = useRouter();
const socket = useSocket();
const isConnected = useSocketConnected();
const roomStore = useRoomStore();
const gameStore = useGameStore();

const name = ref('');
const joinCode = ref('');
const error = ref('');
const processing = ref(false);

function tryCreateRoom() {
  if (!name.value.trim() || !isConnected.value || processing.value) return;
  error.value = '';
  processing.value = true;

  const timeout = setTimeout(() => {
    processing.value = false;
    error.value = 'Server not responding (timeout).';
  }, 5000);

  socket.emit('create-room', { playerName: name.value.trim() }, (res) => {
    clearTimeout(timeout);
    processing.value = false;

    if (!res) {
      error.value = 'No response from server.';
      return;
    }
    if (res.error) {
      error.value = res.error;
      return;
    }
    roomStore.playerName = name.value.trim();
    roomStore.setRoom(res);
    roomStore.setMyId(socket.id);
    gameStore.setMyId(socket.id);
    router.push('/lobby');
  });
}

function tryJoinRoom() {
  if (!name.value.trim() || !joinCode.value.trim() || !isConnected.value || processing.value) return;
  error.value = '';
  processing.value = true;

  const timeout = setTimeout(() => {
    processing.value = false;
    error.value = 'Server not responding (timeout).';
  }, 5000);

  socket.emit('join-room', { code: joinCode.value.toUpperCase().trim(), playerName: name.value.trim() }, (res) => {
    clearTimeout(timeout);
    processing.value = false;

    if (!res) {
      error.value = 'No response from server.';
      return;
    }
    if (res.error) {
      error.value = res.error;
      return;
    }
    roomStore.playerName = name.value.trim();
    roomStore.setRoom(res);
    roomStore.setMyId(socket.id);
    gameStore.setMyId(socket.id);
    router.push('/lobby');
  });
}
</script>

<style scoped>
.landing {
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
  padding: 40px;
  width: 400px;
  max-width: 90vw;
}
h1 {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 4px;
  letter-spacing: 6px;
}
.accent { color: #ff6b35; }
.subtitle {
  text-align: center;
  color: #aaa;
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.status {
  text-align: center;
  font-size: 0.8rem;
  color: #ff6666;
  margin-bottom: 24px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(255, 50, 50, 0.1);
}
.status.ok {
  color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #bbb;
}
.form-group input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.07);
  color: #fff;
  font-size: 1rem;
  outline: none;
}
.form-group input:focus {
  border-color: #ff6b35;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn {
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.primary {
  background: #ff6b35;
  color: #fff;
}
.primary:hover:not(:disabled) { background: #e55a2b; }
.secondary {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
}
.secondary:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
.divider {
  text-align: center;
  color: #666;
  font-size: 0.8rem;
  margin: 4px 0;
}
.error {
  color: #ff4444;
  text-align: center;
  margin-top: 12px;
  font-size: 0.9rem;
}
</style>
