import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useRoomStore = defineStore('room', () => {
  const code = ref('');
  const players = ref([]);
  const hostId = ref('');
  const playerName = ref('');
  const myId = ref('');

  const isHost = computed(() => {
    return myId.value && hostId.value === myId.value;
  });

  const allReady = computed(() => {
    return players.value.filter(p => p.id !== hostId.value).every(p => p.ready);
  });

  function setMyId(id) {
    myId.value = id;
  }

  function setRoom(data) {
    code.value = data.code;
    players.value = data.players;
    hostId.value = data.hostId;
  }

  function updatePlayers(data) {
    players.value = data.players;
    hostId.value = data.hostId;
  }

  function reset() {
    code.value = '';
    players.value = [];
    hostId.value = '';
    myId.value = '';
  }

  return { code, players, hostId, playerName, myId, isHost, allReady, setMyId, setRoom, updatePlayers, reset };
});
