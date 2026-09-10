# BombMan — Electron Wrapper

Wraps the existing Vue 3 + Vite web app in Electron without affecting the Vercel deployment. `npm run dev` / `npm run build` / `vite preview` keep working exactly as before.

## Prerequisites

```bash
cd client
npm install
```

Requires Node 18+.

## Run in development

```bash
npm run electron:dev
```

- Starts Vite on `http://localhost:5173`
- Waits for the dev server (`wait-on`) then launches Electron
- Uses `concurrently -k` so both processes are killed together on exit
- Window: 1280×800, resizable, menu bar hidden, title "BombMan"

## Build the desktop installer

```bash
npm run electron:build
```

This runs `vite build` then `electron-builder`.

**Output:** `client/release/`

| Platform | File |
|----------|------|
| Windows  | `release/BombMan Setup 1.0.0.exe` (NSIS installer, `oneClick: false`) |
| macOS    | `release/BombMan-1.0.0.dmg` |
| Linux    | `release/BombMan-1.0.0.AppImage` |

On Windows only the `.exe` is produced; macOS/Linux targets are skipped unless built on that OS (or via CI).

## How it works

- **Dev:** `electron/main.js` loads `http://localhost:5173`
- **Prod:** loads `dist/index.html` via `file://` (`loadFile`) — does not depend on the Vercel URL, so the `.exe` keeps working even if the Vercel deployment changes
- Only `dist/`, `electron/`, and `package.json` are bundled (`build.files` in `package.json`)

## Offline / network

The game requires internet (Socket.io + Neon). If the dev server or network is unreachable, Electron shows a dialog:

> "Can't connect to game server — check your internet connection." [Retry / Close]

In production the `file://` page always loads; in-game socket connection errors are handled by the existing Vue UI.

## Voice chat (WebRTC)

Microphone access is explicitly allowed via:

```js
session.defaultSession.setPermissionRequestHandler(...) // allow 'media'
session.defaultSession.setPermissionCheckHandler(...)    // allow 'media'
```

Without this, Electron would silently deny `getUserMedia` even though browsers prompt automatically.

## Icon

Place an icon at `client/public/icon.png` (or `.ico`/`.icns` via `build.win.icon` / `build.mac.icon`). If no icon file exists, the default Electron icon is used — no error.

## Vercel deployment

Not affected. `vercel.json` / `vite build` output is unchanged. Electron is an additional build target only.
