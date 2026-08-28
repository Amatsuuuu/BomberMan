import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { initDB, createRoom as dbCreateRoom, getRoom as dbGetRoom, updateRoomStatus, deleteRoom, saveResult, cleanupExpiredRooms } from './db.js';
import {
  createRoom, getRoom, getRoomBySocket, joinRoom, leaveRoom,
  removeRoom, getAllRoomCodes, MAX_PLAYERS, GRACE_PERIOD_MS
} from './rooms.js';
import { createGame, startGameLoop, stopGameLoop, queueInput, detonateRemote } from './game/engine.js';
import { getMapInfo } from './game/grid.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'https://bomber-man-six.vercel.app'], methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000,
  transports: ['websocket', 'polling'],
  perMessageDeflate: { threshold: 1024 },
});

app.use(cors());
app.use(express.json());

const games = new Map();

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/maps', (req, res) => res.json(getMapInfo()));

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('create-room', ({ playerName }, cb) => {
    if (!playerName || playerName.length > 20) return cb({ error: 'Invalid name' });

    const room = createRoom(socket.id, playerName);
    const code = room.code;

    dbCreateRoom(code).catch(err => console.error('[DB] Failed to persist room:', err.message));

    socket.join(code);
    cb({ code, players: getPlayerList(room), hostId: socket.id });

    console.log(`[Room] ${playerName} created room ${code}`);
  });

  socket.on('join-room', ({ code, playerName }, cb) => {
    if (!playerName || playerName.length > 20) return cb({ error: 'Invalid name' });

    const upperCode = code.toUpperCase().trim();
    if (upperCode.length < 4) return cb({ error: 'Invalid room code' });

    const result = joinRoom(upperCode, socket.id, playerName);
    if (result.error) return cb({ error: result.error });

    const room = result.room;
    socket.join(upperCode);

    cb({ code: upperCode, players: getPlayerList(room), hostId: room.hostSocketId });

    io.to(upperCode).emit('player-joined', {
      players: getPlayerList(room),
      hostId: room.hostSocketId,
      joinedPlayer: { id: socket.id, name: playerName },
    });

    console.log(`[Room] ${playerName} joined room ${upperCode}`);
  });

  socket.on('start-game', ({ mapId, nukeCount } = {}, cb) => {
    if (!cb) return;
    const room = getRoomBySocket(socket.id);
    if (!room) return cb({ error: 'Not in a room' });
    if (room.hostSocketId !== socket.id) return cb({ error: 'Only host can start' });
    if (room.players.size < 2) return cb({ error: 'Need at least 2 players' });
    if (room.status !== 'lobby') return cb({ error: 'Game already started' });

    room.status = 'in_progress';
    updateRoomStatus(room.code, 'in_progress').catch(err => console.error('[DB] Failed to update status:', err.message));

    const parsedNukeCount = Math.max(0, Math.min(parseInt(nukeCount, 10) || 0, 10));
    const game = createGame(room.code, [...room.players.entries()], mapId || 'classic', parsedNukeCount);
    games.set(room.code, game);

    game.onStateUpdate = (state) => {
      io.to(room.code).emit('game-state', state);
    };

    game.onGameOver = (result) => {
      room.status = 'finished';
      io.to(room.code).emit('game-over', result);

      if (result.winnerName) {
        saveResult(room.code, result.winnerName, result.playerCount)
          .catch(err => console.error('[DB] Failed to save result:', err.message));
      }

      games.delete(room.code);
    };

    startGameLoop(game);

    const initPlayers = Object.fromEntries(
      [...game.players.entries()].map(([id, p]) => [id, {
        id: p.id, name: p.name, x: p.x, y: p.y, alive: p.alive,
        maxBombs: p.maxBombs, activeBombs: p.activeBombs, blastRadius: p.blastRadius,
        speed: p.speed, canKick: p.canKick, canDetonate: p.canDetonate, hasNuke: p.hasNuke,
      }])
    );
    io.to(room.code).emit('game-started', {
      grid: game.grid,
      cols: game.cols,
      rows: game.rows,
      players: initPlayers,
      bombs: [],
      explosions: [],
      deaths: [],
    });

    if (cb) cb({ ok: true });
    console.log(`[Game] Started in room ${room.code}`);
  });

  socket.on('player-input', (input) => {
    const game = games.get(getRoomBySocket(socket.id)?.code);
    if (game && game.status === 'active') {
      queueInput(game, socket.id, input);
    }
  });

  socket.on('remote-detonate', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    const game = games.get(room.code);
    if (game && game.status === 'active') {
      detonateRemote(game, socket.id);
    }
  });

  socket.on('voice-offer', ({ to, offer }) => {
    io.to(to).emit('voice-offer', { from: socket.id, offer });
  });

  socket.on('voice-answer', ({ to, answer }) => {
    io.to(to).emit('voice-answer', { from: socket.id, answer });
  });

  socket.on('voice-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('voice-ice-candidate', { from: socket.id, candidate });
  });

  socket.on('toggle-ready', (_, cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return cb?.({ error: 'Not in a room' });

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = !player.ready;
    }

    io.to(room.code).emit('player-updated', {
      players: getPlayerList(room),
      hostId: room.hostSocketId,
    });
    cb?.({ ok: true });
  });

  socket.on('play-again', (_, cb) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return cb?.({ error: 'Not in a room' });
    if (room.hostSocketId !== socket.id) return cb?.({ error: 'Only host can restart' });

    room.status = 'lobby';
    for (const player of room.players.values()) {
      player.ready = false;
      player.alive = true;
    }

    io.to(room.code).emit('back-to-lobby', { players: getPlayerList(room), hostId: room.hostSocketId });
    cb?.({ ok: true });
  });

  socket.on('disconnect', async () => {
    const result = leaveRoom(socket.id);
    if (!result) return;

    const { room, empty } = result;

    if (games.has(room.code)) {
      const game = games.get(room.code);
      const player = game.players.get(socket.id);
      if (player) {
        player.alive = false;
        game.players.delete(socket.id);
        io.to(room.code).emit('game-state', {
          grid: game.grid,
          players: Object.fromEntries([...game.players.entries()].map(([id, p]) => [id, {
            id: p.id, name: p.name, x: p.x, y: p.y, alive: p.alive,
            maxBombs: p.maxBombs, activeBombs: p.activeBombs, blastRadius: p.blastRadius,
          }])),
          bombs: game.bombs.filter(b => !b._exploding).map(b => ({
            x: b.x, y: b.y, ownerId: b.ownerId, timer: b.timer, placedAt: b.placedAt,
          })),
          explosions: game.explosions.map(e => ({ cells: e.cells, createdAt: e.createdAt, duration: e.duration })),
        });
      }
    }

    io.to(room.code).emit('player-left', {
      playerId: socket.id,
      players: getPlayerList(room),
      hostId: room.hostSocketId,
    });

    if (empty) {
      setTimeout(async () => {
        const current = getRoom(room.code);
        if (current && current.players.size === 0) {
          if (games.has(room.code)) {
            stopGameLoop(games.get(room.code));
            games.delete(room.code);
          }
          removeRoom(room.code);
          deleteRoom(room.code).catch(err => console.error('[DB] Failed to delete room:', err.message));
          console.log(`[Room] Cleaned up empty room ${room.code}`);
        }
      }, GRACE_PERIOD_MS);
    }
  });
});

function getPlayerList(room) {
  return [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    ready: p.ready,
    alive: p.alive,
  }));
}

async function start() {
  await initDB();

  setInterval(async () => {
    await cleanupExpiredRooms();
  }, 5 * 60 * 1000);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
