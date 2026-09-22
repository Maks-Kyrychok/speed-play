// Relays keyboard shortcuts to the content script in the active tab.
// Content scripts cannot receive chrome.commands events themselves.

const COMMANDS = new Set(["toggle-speed", "speed-up", "speed-down"]);

chrome.commands.onCommand.addListener(async (command) => {
  if (!COMMANDS.has(command)) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: command });
  } catch {
    // Not a YouTube tab, so no content script is listening. Nothing to do.
  }
});

// The popup can only be opened from an extension context, so the content
// script asks for it rather than doing it itself.
chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "open-popup") return;
  try {
    chrome.action.openPopup();
  } catch {
    // Not supported in this browser; the toolbar icon still works.
  }
});

// Settings used to live in chrome.storage.local. Carry them across once, so
// the speed someone already chose survives the move to synced storage.
chrome.runtime.onInstalled.addListener(async () => {
  const keys = ["selectedSpeed", "autoApply"];
  try {
    const synced = await chrome.storage.sync.get(keys);
    if (keys.some((key) => key in synced)) return;

    const legacy = await chrome.storage.local.get(keys);
    if (!keys.some((key) => key in legacy)) return;

    await chrome.storage.sync.set(legacy);
    await chrome.storage.local.remove(keys);
  } catch {
    // Sync unavailable. The settings stay in local, which still reads back.
  }
});
