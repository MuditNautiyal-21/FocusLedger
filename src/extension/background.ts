// FocusLedger Browser Companion — Service Worker
// Compiled as a standalone script (no module imports)

(() => {

const HOST_NAME = 'com.focusledger.bridge';
const RECONNECT_MS = 5000;

// ─── Types ───────────────────────────────────────────────────────────

interface TabChangeMsg {
  type: 'TAB_CHANGE';
  url: string;
  title: string;
  domain: string;
  tabId: number;
  timestamp: number;
}

interface ClassificationMsg {
  type: 'CLASSIFICATION_UPDATE';
  domain: string;
  classification: string;
}

// ─── State ───────────────────────────────────────────────────────────

let port: chrome.runtime.Port | null = null;
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Badge ───────────────────────────────────────────────────────────

function setBadge(text: string, color: string) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function badgeForClass(cls: string) {
  if (cls === 'productive') setBadge('\u2713', '#10B981');
  else if (cls === 'non-productive') setBadge('\u2717', '#EF4444');
  else setBadge('?', '#6B7280');
}

// ─── Native messaging ────────────────────────────────────────────────

function connect() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST_NAME);
    connected = true;
    console.log('[FL] Connected');
    setBadge('', '#10B981');

    port.onMessage.addListener((msg: ClassificationMsg) => {
      if (msg.type === 'CLASSIFICATION_UPDATE') badgeForClass(msg.classification);
    });

    port.onDisconnect.addListener(() => {
      console.log('[FL] Disconnected:', chrome.runtime.lastError?.message ?? '');
      port = null;
      connected = false;
      setBadge('!', '#F59E0B');
      scheduleReconnect();
    });

    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  } catch {
    port = null;
    connected = false;
    setBadge('!', '#F59E0B');
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, RECONNECT_MS);
}

function send(msg: TabChangeMsg) {
  if (!port || !connected) { connect(); return; }
  try { port.postMessage(msg); } catch { port = null; connected = false; scheduleReconnect(); }
}

// ─── Tab tracking ────────────────────────────────────────────────────

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function sendTab(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
    send({
      type: 'TAB_CHANGE',
      url: tab.url,
      title: tab.title ?? '',
      domain: getDomain(tab.url),
      tabId,
      timestamp: Date.now(),
    });
  } catch { /* tab closed */ }
}

chrome.tabs.onActivated.addListener((info) => sendTab(info.tabId));
chrome.webNavigation.onCompleted.addListener((d) => { if (d.frameId === 0) sendTab(d.tabId); });
chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.status === 'complete' && tab.active) sendTab(id); });

connect();
console.log('[FL] Browser companion loaded');

})();

export {};
