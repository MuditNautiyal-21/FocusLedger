import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const HOST_NAME = 'com.focusledger.bridge';

// ─── Paths ───────────────────────────────────────────────────────────

/** Where the extension files live inside the installed app */
function getBundledExtensionDir(): string {
  if (app.isPackaged) {
    // In packaged app: resources/extension/ (extraResources)
    return path.join(process.resourcesPath, 'extension');
  }
  // In dev: dist/extension/
  return path.join(__dirname, '..', '..', 'dist', 'extension');
}

/** Where we copy the extension for the user to load */
function getInstalledExtensionDir(): string {
  return path.join(app.getPath('userData'), 'extension');
}

/** Path to the native host bridge script */
function getNativeHostScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native-host.js');
  }
  return path.join(__dirname, '..', '..', 'scripts', 'native-host.js');
}

/** Path to the native host .bat wrapper (Windows only) */
function getNativeHostBatPath(): string {
  return path.join(app.getPath('userData'), 'focusledger-host.bat');
}

function getNativeManifestDir(): string {
  return path.join(app.getPath('userData'), 'native-messaging');
}

// ─── Extension installation ──────────────────────────────────────────

/**
 * Copy the bundled extension files to a stable user-writable location.
 * Returns the path to the installed extension directory.
 */
export function installExtensionFiles(): string {
  const src = getBundledExtensionDir();
  const dest = getInstalledExtensionDir();

  if (!fs.existsSync(src)) {
    console.warn('[ExtSetup] Bundled extension not found at:', src);
    return dest;
  }

  // Copy entire directory
  copyDirSync(src, dest);
  console.log(`[ExtSetup] Extension files copied to: ${dest}`);
  return dest;
}

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Native messaging host registration ──────────────────────────────

/**
 * Register the native messaging host manifest for Chrome and Edge.
 * Call this on first launch and after updates.
 */
export function registerNativeHost(): void {
  try {
    const hostScript = getNativeHostScriptPath();

    if (process.platform === 'win32') {
      registerWindows(hostScript);
    } else if (process.platform === 'darwin') {
      registerMacOS(hostScript);
    } else {
      registerLinux(hostScript);
    }

    console.log('[ExtSetup] Native messaging host registered');
  } catch (err) {
    console.error('[ExtSetup] Failed to register native host:', err);
  }
}

function registerWindows(hostScript: string): void {
  // Create a .bat wrapper (Chrome requires .exe or .bat on Windows)
  const batPath = getNativeHostBatPath();
  const nodeExe = process.execPath; // node.exe inside Electron
  // In packaged app, use the bundled Node from Electron
  const nodePath = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'resources', 'node.exe')
    : 'node';

  // Use system node if available, otherwise try Electron's node
  fs.writeFileSync(batPath, `@echo off\r\n"node" "${hostScript}" %*\r\n`);

  // Build the manifest
  const manifestDir = getNativeManifestDir();
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);

  const manifest = {
    name: HOST_NAME,
    description: 'FocusLedger Native Messaging Host',
    path: batPath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://*/',
    ],
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Register in Chrome registry
  try {
    execSync(
      `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}" /ve /t REG_SZ /d "${manifestPath}" /f`,
      { stdio: 'ignore' },
    );
  } catch { /* ignore */ }

  // Register in Edge registry
  try {
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}" /ve /t REG_SZ /d "${manifestPath}" /f`,
      { stdio: 'ignore' },
    );
  } catch { /* ignore */ }
}

function registerMacOS(hostScript: string): void {
  const manifest = {
    name: HOST_NAME,
    description: 'FocusLedger Native Messaging Host',
    path: hostScript,
    type: 'stdio',
    allowed_origins: ['chrome-extension://*/'],
  };

  // Make script executable
  try { fs.chmodSync(hostScript, '755'); } catch { /* ignore */ }

  const dirs = [
    path.join(process.env.HOME || '~', 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
    path.join(process.env.HOME || '~', 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  }
}

function registerLinux(hostScript: string): void {
  const manifest = {
    name: HOST_NAME,
    description: 'FocusLedger Native Messaging Host',
    path: hostScript,
    type: 'stdio',
    allowed_origins: ['chrome-extension://*/'],
  };

  try { fs.chmodSync(hostScript, '755'); } catch { /* ignore */ }

  const dirs = [
    path.join(process.env.HOME || '~', '.config/google-chrome/NativeMessagingHosts'),
    path.join(process.env.HOME || '~', '.config/chromium/NativeMessagingHosts'),
    path.join(process.env.HOME || '~', '.config/microsoft-edge/NativeMessagingHosts'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  }
}

// ─── Open browser to load extension ──────────────────────────────────

/**
 * Opens Chrome or Edge extension management page so the user can
 * load the unpacked extension.
 */
export function openBrowserExtensionPage(browser: 'chrome' | 'edge' = 'chrome'): void {
  const url = browser === 'edge'
    ? 'edge://extensions/'
    : 'chrome://extensions/';

  // chrome:// URLs can't be opened via shell.openExternal — need to launch the browser directly
  if (process.platform === 'win32') {
    const exe = browser === 'edge'
      ? 'msedge.exe'
      : 'chrome.exe';
    try {
      execSync(`start "" "${exe}" "${url}"`, { stdio: 'ignore' });
    } catch {
      // Fallback: try via shell
      shell.openExternal(`https://google.com`).catch(() => {});
    }
  } else if (process.platform === 'darwin') {
    const appName = browser === 'edge'
      ? 'Microsoft Edge'
      : 'Google Chrome';
    try {
      execSync(`open -a "${appName}" "${url}"`, { stdio: 'ignore' });
    } catch {
      shell.openExternal(`https://google.com`).catch(() => {});
    }
  } else {
    const bin = browser === 'edge' ? 'microsoft-edge' : 'google-chrome';
    try {
      execSync(`${bin} "${url}" &`, { stdio: 'ignore' });
    } catch {
      shell.openExternal(`https://google.com`).catch(() => {});
    }
  }
}

/**
 * Open the folder containing the extension files so the user
 * can browse to it in "Load unpacked".
 */
export function openExtensionFolder(): void {
  const dir = getInstalledExtensionDir();
  shell.openPath(dir).catch(() => {
    shell.showItemInFolder(dir);
  });
}

/**
 * Returns the setup status for the renderer to display.
 */
export function getExtensionSetupStatus(): {
  extensionInstalled: boolean;
  extensionPath: string;
  nativeHostRegistered: boolean;
} {
  const extDir = getInstalledExtensionDir();
  const extInstalled = fs.existsSync(path.join(extDir, 'manifest.json'));

  const manifestDir = getNativeManifestDir();
  const hostRegistered = fs.existsSync(path.join(manifestDir, `${HOST_NAME}.json`));

  return {
    extensionInstalled: extInstalled,
    extensionPath: extDir,
    nativeHostRegistered: hostRegistered,
  };
}

/**
 * Full setup: install extension files + register native host.
 * Called from onboarding or settings.
 */
export function runFullExtensionSetup(): {
  extensionPath: string;
  success: boolean;
} {
  try {
    const extPath = installExtensionFiles();
    registerNativeHost();
    return { extensionPath: extPath, success: true };
  } catch (err) {
    console.error('[ExtSetup] Full setup failed:', err);
    return { extensionPath: '', success: false };
  }
}
