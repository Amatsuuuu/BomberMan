import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      code CHAR(6) PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'lobby',
      max_players SMALLINT NOT NULL DEFAULT 10,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS room_results (
      id BIGSERIAL PRIMARY KEY,
      room_code CHAR(6) REFERENCES rooms(code) ON DELETE CASCADE,
      winner_name TEXT,
      player_count SMALLINT,
      finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log('[DB] Tables initialized');
}

export async function createRoom(code) {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO rooms (code, status, expires_at)
    VALUES (${code}, 'lobby', ${expiresAt})
    ON CONFLICT (code) DO NOTHING
  `;
}

export async function getRoom(code) {
  const rows = await sql`SELECT * FROM rooms WHERE code = ${code}`;
  return rows[0] || null;
}

export async function updateRoomStatus(code, status) {
  await sql`UPDATE rooms SET status = ${status} WHERE code = ${code}`;
}

export async function deleteRoom(code) {
  await sql`DELETE FROM rooms WHERE code = ${code}`;
}

export async function saveResult(roomCode, winnerName, playerCount) {
  await sql`
    INSERT INTO room_results (room_code, winner_name, player_count)
    VALUES (${roomCode}, ${winnerName}, ${playerCount})
  `;
}

export async function cleanupExpiredRooms() {
  await sql`DELETE FROM rooms WHERE expires_at < now()`;
}
