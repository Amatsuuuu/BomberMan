<template>
  <div class="lobby">
    <div class="card">
      <h2>Room</h2>
      <div class="room-code" @click="copyCode" title="Click to copy">
        {{ roomStore.code }}
        <span class="copy-hint">click to copy</span>
      </div>

      <div class="players-section">
        <h3>Players ({{ roomStore.players.length }}/10)</h3>
        <ul class="player-list">
          <li v-for="p in roomStore.players" :key="p.id" :class="{ host: p.id === roomStore.hostId, ready: p.ready }">
            <span class="name">{{ p.name }}</span>
            <span v-if="p.id === roomStore.hostId" class="badge">HOST</span>
            <span v-else-if="p.ready" class="badge ready">READY</span>
          </li>
        </ul>
      </div>

      <div v-if="roomStore.isHost" class="map-section">
        <h3>Nukes on map</h3>
        <div class="nuke-control">
          <button class="btn nuke-btn" @click="nukeCount = Math.max(0, nukeCount - 1)">−</button>
          <span class="nuke-value">{{ nukeCount }}</span>
          <button class="btn nuke-btn" @click="nukeCount = Math.min(10, nukeCount + 1)">+</button>
          <span class="nuke-hint">hidden randomly under blocks</span>
        </div>
      </div>

      <div v-if="roomStore.isHost && maps.length" class="map-section">
        <h3>Choose Map</h3>
        <div class="map-grid">
          <button
            v-for="m in maps"
            :key="m.id"
            class="map-card"
            :class="{ selected: selectedMap === m.id }"
            @click="selectedMap = m.id"
          >
            <span class="map-name">{{ m.name }}</span>
            <span class="map-desc">{{ m.desc }}</span>
          </button>
        </div>
      </div>

      <div v-if="!roomStore.isHost && selectedMapName" class="map-section">
        <h3>Map</h3>
        <div class="map-info">{{ selectedMapName }}</div>
      </div>

      <div class="controls">
        <button
          v-if="!roomStore.isHost"
          class="btn"
          :class="myReady ? 'ready-btn' : 'secondary'"
          @click="toggleReady"
        >
          {{ myReady ? 'Unready' : 'Ready Up' }}
        </button>

        <button
          v-if="roomStore.isHost"
          class="btn primary"
          :disabled="roomStore.players.length < 2 || !allNonHostReady"
          @click="startGame"
        >
          Start Game
        </button>

        <button class="btn voice-btn" @click="toggleVoice">
          {{ voiceEnabled ? 'Voice ON' : 'Voice OFF' }}
        </button>

        <button class="btn danger" @click="leaveRoom">Leave Room</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSocket } from '../composables/useSocket.js';
import { useRoomStore } from '../stores/room.js';
import { useVoiceStore } from '../stores/voice.js';
import { useWebRTC } from '../composables/useWebRTC.js';
const router = useRouter();
const socket = useSocket();
const roomStore = useRoomStore();
const voiceStore = useVoiceStore();
const { startVoice, stopVoice } = useWebRTC(socket);

const error = ref('');
const myReady = ref(false);
const voiceEnabled = ref(false);
const maps = ref([]);
const selectedMap = ref('classic');
const nukeCount = ref(1);

const allNonHostReady = computed(() => {
  const nonHost = roomStore.players.filter(p => p.id !== roomStore.hostId);
  return nonHost.length > 0 && nonHost.every(p => p.ready);
});

const selectedMapName = computed(() => {
  const m = maps.value.find(m => m.id === selectedMap.value);
  return m ? m.name : '';
});

onMounted(async () => {
  try {
    const url = import.meta.env.DEV ? 'http://localhost:3001' : (import.meta.env.VITE_SERVER_URL || '');
    const res = await fetch(`${url}/maps`);
    maps.value = await res.json();
  } catch (e) {
    console.warn('Failed to load maps', e);
  }
});

function copyCode() {
  navigator.clipboard?.writeText(roomStore.code);
}

function toggleReady() {
  myReady.value = !myReady.value;
  socket.emit('toggle-ready');
}

function startGame() {
  socket.emit('start-game', { mapId: selectedMap.value, nukeCount: nukeCount.value }, (res) => {
    if (res?.error) {
      error.value = res.error;
    }
  });
}

async function toggleVoice() {
  if (voiceEnabled.value) {
    stopVoice();
    voiceEnabled.value = false;
  } else {
    await startVoice();
    voiceEnabled.value = voiceStore.enabled;
  }
}

function leaveRoom() {
  socket.disconnect();
  socket.connect();
  roomStore.reset();
  router.push('/');
}
</script>

<style scoped>
.lobby {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
}
.card {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 36px;
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
h2 {
  text-align: center;
  margin-bottom: 8px;
  font-size: 1.2rem;
  color: #bbb;
}
.room-code {
  text-align: center;
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: 12px;
  color: #ff6b35;
  cursor: pointer;
  margin-bottom: 24px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 107, 53, 0.1);
  border: 2px dashed rgba(255, 107, 53, 0.3);
  transition: all 0.2s;
}
.room-code:hover { background: rgba(255, 107, 53, 0.15); }
.copy-hint {
  display: block;
  font-size: 0.7rem;
  letter-spacing: 2px;
  color: #888;
  margin-top: 4px;
}
.players-section { margin-bottom: 20px; }
.players-section h3,
.map-section h3 {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 12px;
}
.player-list { list-style: none; }
.player-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.04);
  font-size: 0.95rem;
}
.player-list li.host { border-left: 3px solid #ff6b35; }
.player-list li.ready { border-left: 3px solid #4caf50; }
.badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: #ff6b35;
  color: #fff;
  font-weight: 700;
  letter-spacing: 1px;
}
.badge.ready { background: #4caf50; }

.map-section { margin-bottom: 20px; }
.map-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.map-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: #ccc;
  cursor: pointer;
  transition: all 0.15s;
}
.map-card:hover {
  border-color: rgba(255,107,53,0.3);
  background: rgba(255,107,53,0.05);
}
.map-card.selected {
  border-color: #ff6b35;
  background: rgba(255,107,53,0.12);
  color: #fff;
}
.map-name {
  font-size: 0.85rem;
  font-weight: 700;
}
.map-desc {
  font-size: 0.65rem;
  color: #888;
  margin-top: 2px;
}
.map-card.selected .map-desc { color: #bbb; }

.nuke-control { display:flex; align-items:center; gap:10px; }
.nuke-btn { width:36px; height:36px; padding:0; font-size:1.2rem; background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15); }
.nuke-value { font-size:1.4rem; font-weight:700; color:#ff6b35; min-width:24px; text-align:center; }
.nuke-hint { font-size:0.7rem; color:#888; }

.map-info {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255,107,53,0.1);
  color: #ff6b35;
  font-weight: 600;
  font-size: 1rem;
}

.controls { display: flex; flex-direction: column; gap: 10px; }
.btn {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.primary { background: #ff6b35; color: #fff; }
.primary:hover:not(:disabled) { background: #e55a2b; }
.secondary { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
.ready-btn { background: #4caf50; color: #fff; }
.voice-btn { background: rgba(255,255,255,0.07); color: #aaa; border: 1px solid rgba(255,255,255,0.1); }
.danger { background: rgba(255,50,50,0.15); color: #ff6666; border: 1px solid rgba(255,50,50,0.2); }
.danger:hover { background: rgba(255,50,50,0.25); }
.error { color: #ff4444; text-align: center; margin-top: 12px; font-size: 0.9rem; }
</style>
