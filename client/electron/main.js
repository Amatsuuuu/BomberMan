import { app, BrowserWindow, dialog, session } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const windowOpts = {
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'BombMan',
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (fs.existsSync(iconPath)) windowOpts.icon = iconPath;

  mainWindow = new BrowserWindow({ ...windowOpts, show: false });

  // Splash / loading screen
  const splash = new BrowserWindow({
    width: 400, height: 300, frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, show: true, backgroundColor: '#00000000',
    icon: windowOpts.icon,
  });
  splash.loadFile(path.join(__dirname, 'loading.html'));
  const showMain = () => {
    if (splash && !splash.isDestroyed()) splash.close();
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  };
  mainWindow.once('ready-to-show', () => setTimeout(showMain, 600));
  // Fallback: show after 5s even if ready-to-show didn't fire
  setTimeout(showMain, 5000);

  mainWindow.setMenuBarVisibility(false);

  // Allow microphone for WebRTC voice chat (supports both callback and promise-style handlers)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    return callback(false);
  });
  // Note: setPermissionCheckHandler is intentionally not set — default Electron
  // behavior is correct for all permissions except 'media' handled above.

  // Graceful offline handling
  const handleOffline = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'No Internet Connection',
        message: "Can't connect to game server — check your internet connection.",
        buttons: ['Retry', 'Close'],
      }).then(({ response }) => {
        if (response === 0) {
          if (isDev) mainWindow.loadURL('http://localhost:5173');
          else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        } else app.quit();
      });
    }
  };

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) handleOffline(); // -3 = aborted
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
