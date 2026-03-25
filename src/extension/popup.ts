// FocusLedger Popup
// Compiled as a standalone script

(() => {

const HOST = 'com.focusledger.bridge';

async function updateStatus() {
  const dot = document.getElementById('statusDot')!;
  const text = document.getElementById('statusText')!;
  try {
    const p = chrome.runtime.connectNative(HOST);
    dot.className = 'dot green';
    text.innerHTML = '<strong>Connected</strong> to FocusLedger';
    p.disconnect();
  } catch {
    dot.className = 'dot red';
    text.innerHTML = '<strong>Disconnected</strong> — Is FocusLedger running?';
  }
}

async function updateTab() {
  const label = document.getElementById('clsLabel')!;
  const domainEl = document.getElementById('domainText')!;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) { label.textContent = 'No tab'; return; }
    domainEl.textContent = new URL(tab.url).hostname;
    const badge = await chrome.action.getBadgeText({});
    if (badge === '\u2713') { label.textContent = '\u2705 Productive'; label.className = 'cls-label productive'; }
    else if (badge === '\u2717') { label.textContent = '\u274C Non-Productive'; label.className = 'cls-label non-productive'; }
    else { label.textContent = '\u26AA Neutral / Unclassified'; label.className = 'cls-label neutral'; }
  } catch { label.textContent = 'Unable to read tab'; }
}

updateStatus();
updateTab();

document.getElementById('openApp')?.addEventListener('click', () => {
  chrome.runtime.sendNativeMessage(HOST, { type: 'FOCUS_APP' }, () => window.close());
});

})();

export {};
