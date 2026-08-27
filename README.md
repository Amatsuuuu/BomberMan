# BombMan — Deploy Guide (Vue + Neon + Vercel + Render)

Stack: `client/` = Vue 3 + Vite + Pinia + socket.io-client | `server/` = Node + Express + Socket.IO (`server/src/index.js:19`) + Neon (`server/src/db.js:1`) with WebRTC voice (`client/src/composables/useWebRTC.js:1` + `server/src/index.js:140`)

> Cannot be Vercel-only. `server/` is stateful (Socket.IO + in-memory `games` Map + voice signaling). Vercel is serverless and kills websockets. Correct split: **Vercel (frontend) + Render (backend) + Neon (DB)**.

## 1. Prerequisites
- Neon project + `DATABASE_URL` (pooled, `?sslmode=require`)
- GitHub repo with this code
- Vercel and Render accounts

## 2. Deploy Backend to Render (uses `render.yaml:1`)
1. Push to GitHub. In Render: New > Blueprint > connect repo (it reads `render.yaml:1`). **If you use Manual Web Service instead of Blueprint, leave `Root Directory` empty and set Build/Start manually — do NOT set it to `src`.**
2. Set env vars in Render dashboard (or `render.yaml:9`):
   - `DATABASE_URL` = your Neon pooled URL
   - `CLIENT_URL` = your Vercel URL e.g. `https://bomber-man-six.vercel.app` (must match `server/src/index.js:20` cors origin)
   - `PORT` = `3001` (already in yaml)
3. Deploy. Check `https://YOUR_RENDER_URL/health` → `{"ok":true}`.

If not using Blueprint, manual: New Web Service > Root Dir `server` > Build `npm install` > Start `node src/index.js` > Health check `/health`.

## 3. Deploy Frontend to Vercel
1. Vercel > Add New Project > import same repo.
2. Settings:
   - Framework: Vite
   - Root Directory: `client`
   - Build Command: `npm run build` (outputs `client/dist`)
   - Output Directory: `dist`
3. Environment Variable (critical):
   - `VITE_SERVER_URL` = `https://YOUR_RENDER_URL` (no trailing slash) — used in `client/src/composables/useSocket.js:11` and `client/src/components/LobbyScreen.vue:95`. **Must redeploy after changing.**
4. Deploy. Vercel auto-injects `CLIENT_URL` not needed on frontend; `server/src/index.js:20` cors must include this Vercel URL or sockets will fail with CORS.

## 4. Local Dev
```bash
# terminal 1 — server
cd server
# create server/.env:
# DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
# PORT=3001
# CLIENT_URL=http://localhost:5173
npm install
npm run dev # node --watch src/index.js

# terminal 2 — client
cd client
npm install
npm run dev # vite on http://localhost:5173
```
Voice chat requires `https` (or `localhost`) or `navigator.mediaDevices.getUserMedia` will be blocked.

## 5. Update CORS After Deploy
Edit `server/src/index.js:20` if your Vercel URL changes:
```js
cors: { origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'https://YOUR_NEW_URL.vercel.app'] }
```
Push → Render redeploys.

## 6. Verify
- Open Vercel URL in 2 browsers → Create room → copy code → Join → Ready → Start Game
- Voice: click `Voice ON` in lobby or `Mic On` in game (`client/src/composables/useWebRTC.js:16` uses Google STUN). Check browser mic permission.
- Check Neon: `SELECT * FROM rooms; SELECT * FROM room_results;` (created in `server/src/db.js:9`)

## 7. Common Pitfalls
- `connect_error` in console: `VITE_SERVER_URL` wrong or Render sleeping (free tier). `useSocket.js:29` logs it.
- Voice not connecting: not on HTTPS, or STUN blocked by firewall. Voice is P2P, it still needs `server/src/index.js:140` signaling — so server must be up.
- Want pure Vercel? Requires rewrite to Supabase Realtime/Pusher/Ably + host-authoritative game loop — not just a DB swap.

## 8. Env Summary
| Where | Var | Example |
|-------|-----|---------|
| Render | `DATABASE_URL` | `postgresql://...@ep-...pooler...neon.tech/neondb?sslmode=require` |
| Render | `CLIENT_URL` | `https://bomber-man-six.vercel.app` |
| Vercel | `VITE_SERVER_URL` | `https://bombman-server.onrender.com` |
