#!/usr/bin/env node
/**
 * FocusLedger Native Messaging Host
 *
 * This script is launched by Chrome/Edge when the extension sends
 * a native message. It bridges Chrome's native messaging protocol
 * (4-byte length prefix + JSON on stdin/stdout) to the FocusLedger
 * Electron app via a local TCP pipe.
 *
 * Flow:
 *   Chrome Extension ←→ [stdin/stdout] ←→ native-host.js ←→ [pipe] ←→ Electron App
 */

const net = require('net');

const PIPE_NAME = process.platform === 'win32'
  ? '\\\\.\\pipe\\focusledger-bridge'
  : '/tmp/focusledger-bridge.sock';

let pipe = null;
let connected = false;

// ─── Chrome Native Messaging Protocol ────────────────────────────────

/**
 * Read a message from stdin (Chrome sends: 4-byte LE length + JSON)
 */
function readMessage(callback) {
  let pendingLength = null;
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      if (pendingLength === null) {
        if (buffer.length < 4) return;
        pendingLength = buffer.readUInt32LE(0);
        buffer = buffer.slice(4);
      }

      if (buffer.length < pendingLength) return;

      const json = buffer.slice(0, pendingLength).toString('utf-8');
      buffer = buffer.slice(pendingLength);
      pendingLength = null;

      try {
        const msg = JSON.parse(json);
        callback(msg);
      } catch (err) {
        // malformed JSON — ignore
      }
    }
  });
}

/**
 * Write a message to stdout (Chrome expects: 4-byte LE length + JSON)
 */
function writeMessage(msg) {
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

// ─── Connect to FocusLedger pipe ─────────────────────────────────────

function connectToPipe() {
  pipe = net.createConnection(PIPE_NAME, () => {
    connected = true;
  });

  let pipeBuffer = '';

  pipe.on('data', (data) => {
    pipeBuffer += data.toString();
    const lines = pipeBuffer.split('\n');
    pipeBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        // Forward classification updates to Chrome
        writeMessage(msg);
      } catch { /* ignore */ }
    }
  });

  pipe.on('close', () => {
    connected = false;
    // Retry in 2 seconds
    setTimeout(connectToPipe, 2000);
  });

  pipe.on('error', () => {
    connected = false;
    pipe = null;
    // Retry
    setTimeout(connectToPipe, 2000);
  });
}

// ─── Main ────────────────────────────────────────────────────────────

connectToPipe();

readMessage((msg) => {
  // Forward extension messages to the FocusLedger pipe
  if (pipe && connected) {
    pipe.write(JSON.stringify(msg) + '\n');
  }
});

// Keep alive
process.stdin.resume();
