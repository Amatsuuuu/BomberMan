import { io } from 'socket.io-client';
import { ref } from 'vue';

const socket = ref(null);
const connected = ref(false);

export function useSocket() {
  if (socket.value) return socket.value;

  const url = import.meta.env.DEV ? 'http://localhost:3001' : (import.meta.env.VITE_SERVER_URL || window.location.origin);

  const s = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });

  s.on('connect', () => {
    console.log('[Socket] Connected:', s.id);
    connected.value = true;
  });

  s.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    connected.value = false;
  });

  s.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    connected.value = false;
  });

  socket.value = s;
  return s;
}

export function useSocketConnected() {
  return connected;
}
