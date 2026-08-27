import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useGameStore = defineStore('game', () => {
  const grid = ref(null);
  const gridCols = ref(15);
  const gridRows = ref(13);
  const players = ref({});
  const bombs = ref([]);
  const explosions = ref([]);
  const deaths = ref([]);
  const status = ref('idle');
  const winner = ref(null);
  const myId = ref('');
  const myBombs = ref(0);
  const myMaxBombs = ref(1);
  const myBlastRadius = ref(1);
  const mySpeed = ref(1);
  const myCanKick = ref(false);
  const myCanDetonate = ref(false);
  const myHasNuke = ref(false);

  function updateState(state) {
    grid.value = state.grid;
    if (state.cols) gridCols.value = state.cols;
    if (state.rows) gridRows.value = state.rows;
    players.value = state.players;
    bombs.value = state.bombs || [];
    explosions.value = state.explosions || [];
    deaths.value = state.deaths || [];

    const me = state.players[myId.value];
    if (me) {
      myBombs.value = me.activeBombs;
      myMaxBombs.value = me.maxBombs;
      myBlastRadius.value = me.blastRadius;
      mySpeed.value = me.speed;
      myCanKick.value = me.canKick;
      myCanDetonate.value = me.canDetonate;
      myHasNuke.value = me.hasNuke || false;
    }
  }

  function setGameStarted(data) {
    grid.value = data.grid;
    if (data.cols) gridCols.value = data.cols;
    if (data.rows) gridRows.value = data.rows;
    players.value = data.players || {};
    bombs.value = data.bombs || [];
    explosions.value = data.explosions || [];
    deaths.value = data.deaths || [];
    status.value = 'active';

    const me = data.players?.[myId.value];
    if (me) {
      myBombs.value = me.activeBombs;
      myMaxBombs.value = me.maxBombs;
      myBlastRadius.value = me.blastRadius;
      mySpeed.value = me.speed;
      myCanKick.value = me.canKick;
      myCanDetonate.value = me.canDetonate;
      myHasNuke.value = me.hasNuke || false;
    }
  }

  function setGameOver(data) {
    status.value = 'finished';
    winner.value = data;
  }

  function setMyId(id) {
    myId.value = id;
  }

  function reset() {
    grid.value = null;
    gridCols.value = 15;
    gridRows.value = 13;
    players.value = {};
    bombs.value = [];
    explosions.value = [];
    deaths.value = [];
    status.value = 'idle';
    winner.value = null;
  }

  return {
    grid, gridCols, gridRows, players, bombs, explosions, deaths, status, winner, myId,
    myBombs, myMaxBombs, myBlastRadius, mySpeed, myCanKick, myCanDetonate, myHasNuke,
    updateState, setGameStarted, setGameOver, setMyId, reset,
  };
});
