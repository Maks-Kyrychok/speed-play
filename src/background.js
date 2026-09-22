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

// Some browsers report openPopup's failure on a promise of their own rather
// than the one they hand back: the call resolves, and the rejection arrives
// here with nothing to attach a handler to. Only that one message is
// swallowed, so a real fault elsewhere still shows up.
self.addEventListener("unhandledrejection", (event) => {
  const message = event.reason && event.reason.message;
  if (typeof message === "string" && message.toLowerCase().includes("open popup")) {
    event.preventDefault();
  }
});

// The popup can only be opened from an extension context, so the content
// script asks for it rather than doing it itself.

const POPUP_SETTLE_MS = 150;

// openPopup resolving does not mean a popup appeared, so the answer comes
// from looking rather than from trusting the call.
async function popupIsOpen() {
  if (!chrome.runtime.getContexts) return null; // no way to tell here
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ["POPUP"] });
    return contexts.length > 0;
  } catch {
    return null;
  }
}

async function openPopup() {
  try {
    const opening = chrome.action.openPopup();
    if (opening && typeof opening.then === "function") await opening;
  } catch {
    return { opened: false };
  }
  // Long enough for the popup's own context to register, short enough not to
  // be noticed when it did not open.
  await new Promise((resolve) => setTimeout(resolve, POPUP_SETTLE_MS));
  const open = await popupIsOpen();
  // null is "cannot tell", which is not the same as failure.
  return { opened: open !== false };
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (!message || message.type !== "open-popup") return;
  openPopup().then(respond);
  return true;
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
