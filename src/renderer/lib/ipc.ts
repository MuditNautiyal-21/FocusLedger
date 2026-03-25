/**
 * Type-safe IPC bridge for the renderer process.
 * Uses window.electronAPI exposed by preload.ts.
 */

interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * Invoke an IPC handler on the main process.
 * Falls back to returning null if electronAPI is not available (e.g. during Vite HMR dev).
 */
export async function ipc<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  if (window.electronAPI) {
    return window.electronAPI.invoke(channel, ...args) as Promise<T>;
  }
  // Dev fallback when running in browser without Electron
  console.warn(`[IPC] electronAPI not available — channel: ${channel}`);
  return null as T;
}
