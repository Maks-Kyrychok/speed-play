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
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (!message || message.type !== "open-popup") return;
  try {
    const opening = chrome.action.openPopup();
    // openPopup reports failure by rejecting, which a plain try/catch around
    // the call never sees; the rejection then surfaces as an uncaught error.
    if (opening && typeof opening.catch === "function") {
      opening.then(() => respond({ opened: true })).catch(() => respond({ opened: false }));
      return true;
    }
    respond({ opened: true });
  } catch {
    // Some builds throw synchronously instead of rejecting.
    respond({ opened: false });
  }
});

// Settings moved twice: out of local storage into sync, and from one speed
// for everything to one per context. Both are carried across on update, so a
// speed someone already chose is not lost.
chrome.runtime.onInstalled.addListener(async () => {
  const FLAT = ["selectedSpeed", "autoApply"];
  try {
    const synced = await chrome.storage.sync.get(["contexts", ...FLAT]);
    if (synced.contexts) return;

    let flat = FLAT.some((key) => key in synced) ? synced : null;
    if (!flat) {
      const local = await chrome.storage.local.get(FLAT);
      if (FLAT.some((key) => key in local)) flat = local;
    }
    if (!flat) return;

    const speed = typeof flat.selectedSpeed === "number" ? flat.selectedSpeed : 2;
    const autoApply = flat.autoApply !== false;
    await chrome.storage.sync.set({
      contexts: {
        video: { speed, autoApply },
        shorts: { speed: 1.5, autoApply: true },
        music: { speed: 1, autoApply: false },
      },
    });
    await chrome.storage.sync.remove(FLAT);
    await chrome.storage.local.remove(FLAT);
  } catch {
    // Sync unavailable. The old values stay put and still read back.
  }
});
