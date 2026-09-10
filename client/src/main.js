import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import LandingScreen from './components/LandingScreen.vue';
import LobbyScreen from './components/LobbyScreen.vue';
import GameScreen from './components/GameScreen.vue';
import RoundEnd from './components/RoundEnd.vue';

const isElectron = window.electronAPI?.isElectron || location.protocol === 'file:';
const router = createRouter({
  history: isElectron ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: '/', component: LandingScreen },
    { path: '/lobby', component: LobbyScreen },
    { path: '/game', component: GameScreen },
    { path: '/end', component: RoundEnd },
  ],
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
