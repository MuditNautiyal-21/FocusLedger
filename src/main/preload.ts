import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — exposes a safe IPC bridge to the renderer
 * via window.electronAPI (contextIsolation: true).
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
});
