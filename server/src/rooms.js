const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_PLAYERS = 10;
const GRACE_PERIOD_MS = 60_000;

const rooms = new Map();

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function createRoom(hostSocketId, hostName) {
  let code;
  do { code = generateCode(); } while (rooms.has(code));

  const room = {
    code,
    hostSocketId,
    status: 'lobby',
    players: new Map(),
    emptySince: null,
  };
  room.players.set(hostSocketId, {
    id: hostSocketId,
    name: hostName,
    ready: false,
    alive: true,
  });

  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get(code.toUpperCase()) || null;
}

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

export function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'lobby') return { error: 'Game already in progress' };
  if (room.players.size >= MAX_PLAYERS) return { error: 'Room is full' };

  room.players.set(socketId, {
    id: socketId,
    name: playerName,
    ready: false,
    alive: true,
  });
  room.emptySince = null;
  return { room };
}

export function leaveRoom(socketId) {
  const room = getRoomBySocket(socketId);
  if (!room) return null;

  room.players.delete(socketId);

  if (room.players.size === 0) {
    room.emptySince = Date.now();
    return { room, empty: true };
  }

  if (room.hostSocketId === socketId) {
    const [newHost] = room.players.keys();
    room.hostSocketId = newHost;
  }

  return { room, empty: false };
}

export function removeRoom(code) {
  rooms.delete(code);
}

export function getActiveRooms() {
  return rooms;
}

export function getAllRoomCodes() {
  return [...rooms.keys()];
}

export { MAX_PLAYERS, GRACE_PERIOD_MS };
