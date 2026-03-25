import { EventEmitter } from 'events';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import type { Classification } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────

export interface TabChangeMessage {
  type: 'TAB_CHANGE';
  url: string;
  title: string;
  domain: string;
  tabId: number;
  timestamp: number;
}

export interface BrowserBridgeEvents {
  'tab-change': (data: TabChangeMessage) => void;
  'connected': () => void;
  'disconnected': () => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const HOST_NAME = 'com.focusledger.bridge';
const PIPE_NAME = '\\\\.\\pipe\\focusledger-bridge';
const SOCKET_PATH_UNIX = '/tmp/focusledger-bridge.sock';

// ─── BrowserBridge ───────────────────────────────────────────────────

/**
 * The BrowserBridge listens for messages from the browser extension
 * via a local IPC pipe/socket. The native messaging host (a small
 * Node script) connects to this pipe and relays extension messages.
 */
export class BrowserBridge extends EventEmitter {
  private server: net.Server | null = null;
  private client: net.Socket | null = null;
  private isRunning = false;

  /** Latest tab data received from the extension */
  private latestTabData: TabChangeMessage | null = null;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const pipePath = process.platform === 'win32' ? PIPE_NAME : SOCKET_PATH_UNIX;

    // Clean up stale socket on Unix
    if (process.platform !== 'win32') {
      try { fs.unlinkSync(pipePath); } catch { /* ignore */ }
    }

    this.server = net.createServer((socket) => {
      console.log('[Bridge] Extension native host connected');
      this.client = socket;
      this.emit('connected');

      let buffer = '';

      socket.on('data', (data) => {
        buffer += data.toString();
        // Messages are newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            this.handleMessage(msg);
          } catch (err) {
            console.error('[Bridge] Parse error:', err);
          }
        }
      });

      socket.on('close', () => {
        console.log('[Bridge] Extension native host disconnected');
        this.client = null;
        this.latestTabData = null;
        this.emit('disconnected');
      });

      socket.on('error', (err) => {
        console.error('[Bridge] Socket error:', err.message);
      });
    });

    this.server.listen(pipePath, () => {
      console.log(`[Bridge] Listening on ${pipePath}`);
    });

    this.server.on('error', (err) => {
      console.error('[Bridge] Server error:', err.message);
    });
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.client?.destroy();
    this.client = null;
    this.server?.close();
    this.server = null;
    console.log('[Bridge] Stopped');
  }

  /** Get the latest tab data from the extension (if any) */
  getLatestTabData(): TabChangeMessage | null {
    return this.latestTabData;
  }

  /** Is the extension currently connected? */
  isConnected(): boolean {
    return this.client !== null && !this.client.destroyed;
  }

  /** Send a classification update back to the extension */
  sendClassification(domain: string, classification: Classification): void {
    if (!this.client || this.client.destroyed) return;
    const msg = JSON.stringify({
      type: 'CLASSIFICATION_UPDATE',
      domain,
      classification,
    });
    this.client.write(msg + '\n');
  }

  // ── Message handling ──────────────────────────────────────────────

  private handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'TAB_CHANGE') {
      this.latestTabData = msg as unknown as TabChangeMessage;
      this.emit('tab-change', this.latestTabData);
    } else if (msg.type === 'FOCUS_APP') {
      // Bring the Electron app to front
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        wins[0].show();
        wins[0].focus();
      }
    }
  }

  // ── Host manifest installation ────────────────────────────────────

  /**
   * Install the native messaging host manifest so Chrome/Edge
   * can find our bridge. Call on first app launch.
   */
  static installHostManifest(): void {
    try {
      const nativeHostScript = path.join(
        app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..', '..'),
        'native-host.js',
      );

      const manifest = {
        name: HOST_NAME,
        description: 'FocusLedger Native Messaging Host',
        path: nativeHostScript,
        type: 'stdio',
        allowed_origins: [
          // Chrome extension IDs will be added after install
          // Using wildcard for dev
        ],
      };

      if (process.platform === 'win32') {
        BrowserBridge.installWindows(manifest, nativeHostScript);
      } else if (process.platform === 'darwin') {
        BrowserBridge.installMacOS(manifest);
      } else {
        BrowserBridge.installLinux(manifest);
      }

      console.log('[Bridge] Native messaging host manifest installed');
    } catch (err) {
      console.error('[Bridge] Failed to install host manifest:', err);
    }
  }

  private static installWindows(manifest: Record<string, unknown>, scriptPath: string): void {
    const manifestDir = path.join(app.getPath('userData'), 'native-messaging');
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);

    // Write manifest
    manifest.path = scriptPath;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Write registry key via reg command
    const { execSync } = require('child_process');
    const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
    try {
      execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'ignore' });
    } catch { /* registry write may fail in some environments */ }

    // Also register for Edge
    const edgeRegKey = `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`;
    try {
      execSync(`reg add "${edgeRegKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  private static installMacOS(manifest: Record<string, unknown>): void {
    const chromeDir = path.join(
      process.env.HOME || '~',
      'Library/Application Support/Google/Chrome/NativeMessagingHosts',
    );
    fs.mkdirSync(chromeDir, { recursive: true });
    fs.writeFileSync(
      path.join(chromeDir, `${HOST_NAME}.json`),
      JSON.stringify(manifest, null, 2),
    );
  }

  private static installLinux(manifest: Record<string, unknown>): void {
    const chromeDir = path.join(
      process.env.HOME || '~',
      '.config/google-chrome/NativeMessagingHosts',
    );
    fs.mkdirSync(chromeDir, { recursive: true });
    fs.writeFileSync(
      path.join(chromeDir, `${HOST_NAME}.json`),
      JSON.stringify(manifest, null, 2),
    );
  }
}
