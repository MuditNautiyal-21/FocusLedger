#!/usr/bin/env node
/**
 * install-native-host.js
 *
 * Installs the FocusLedger native messaging host manifest
 * so Chrome and Edge can communicate with the app.
 *
 * Usage: node scripts/install-native-host.js
 *        or: npm run install-host
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOST_NAME = 'com.focusledger.bridge';
const hostScriptPath = path.resolve(__dirname, 'native-host.js');

// Ensure the native host script exists
if (!fs.existsSync(hostScriptPath)) {
  console.error('ERROR: native-host.js not found at:', hostScriptPath);
  process.exit(1);
}

// Wrap in a batch/shell launcher so the registry points to an .exe/.bat
// Chrome on Windows requires the path to point to an .exe or .bat
const isWindows = process.platform === 'win32';

let executablePath = hostScriptPath;

if (isWindows) {
  // Create a .bat wrapper
  const batPath = path.resolve(__dirname, 'focusledger-host.bat');
  const nodeExe = process.execPath; // path to node.exe
  fs.writeFileSync(batPath, `@echo off\r\n"${nodeExe}" "${hostScriptPath}" %*\r\n`);
  executablePath = batPath;
  console.log('Created batch wrapper:', batPath);
}

const manifest = {
  name: HOST_NAME,
  description: 'FocusLedger Native Messaging Host',
  path: executablePath,
  type: 'stdio',
  allowed_origins: [
    // Placeholder — update with your extension ID after loading it
    'chrome-extension://*/',
  ],
};

// ─── Install per OS ──────────────────────────────────────────────────

if (isWindows) {
  // Write manifest to AppData
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const manifestDir = path.join(appData, 'FocusLedger', 'native-messaging');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Manifest written to:', manifestPath);

  // Register with Chrome
  try {
    const chromeKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
    execSync(`reg add "${chromeKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });
    console.log('Chrome registry key set');
  } catch (err) {
    console.warn('Could not set Chrome registry key:', err.message);
  }

  // Register with Edge
  try {
    const edgeKey = `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`;
    execSync(`reg add "${edgeKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'inherit' });
    console.log('Edge registry key set');
  } catch (err) {
    console.warn('Could not set Edge registry key:', err.message);
  }

} else if (process.platform === 'darwin') {
  const chromeDir = path.join(process.env.HOME || '~', 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
  fs.mkdirSync(chromeDir, { recursive: true });
  fs.writeFileSync(path.join(chromeDir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  console.log('Chrome manifest installed (macOS)');

  const edgeDir = path.join(process.env.HOME || '~', 'Library/Application Support/Microsoft Edge/NativeMessagingHosts');
  fs.mkdirSync(edgeDir, { recursive: true });
  fs.writeFileSync(path.join(edgeDir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  console.log('Edge manifest installed (macOS)');

} else {
  // Linux
  const chromeDir = path.join(process.env.HOME || '~', '.config/google-chrome/NativeMessagingHosts');
  fs.mkdirSync(chromeDir, { recursive: true });
  fs.writeFileSync(path.join(chromeDir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  console.log('Chrome manifest installed (Linux)');

  const chromiumDir = path.join(process.env.HOME || '~', '.config/chromium/NativeMessagingHosts');
  fs.mkdirSync(chromiumDir, { recursive: true });
  fs.writeFileSync(path.join(chromiumDir, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  console.log('Chromium manifest installed (Linux)');
}

// Make native-host.js executable on Unix
if (!isWindows) {
  fs.chmodSync(hostScriptPath, '755');
}

console.log('\n✅ Native messaging host installed successfully!');
console.log('\nNext steps:');
console.log('1. Load the extension in Chrome: chrome://extensions → Load unpacked → select dist/extension/');
console.log('2. Copy your extension ID');
console.log('3. Update "allowed_origins" in the manifest with: chrome-extension://<YOUR_ID>/');
