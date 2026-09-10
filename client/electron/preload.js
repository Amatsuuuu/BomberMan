// Minimal preload — expose isElectron flag securely
import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', { isElectron: true });
