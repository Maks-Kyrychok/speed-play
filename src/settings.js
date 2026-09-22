// Settings storage, shared by the popup and the content script.
//
// chrome.storage.sync carries the settings between a user's machines and needs
// no permission beyond the `storage` one that local already required. It does
// impose write quotas, so writes are debounced: stepping the speed with the
// keyboard would otherwise write on every keypress.

(() => {
  "use strict";

  const AREA = chrome.storage.sync;
  const LEGACY = chrome.storage.local;
  const KEYS = ["selectedSpeed", "autoApply"];

  // Comfortably under the per-minute quota even while a shortcut is held.
  const WRITE_DELAY_MS = 1000;

  let pending = null;
  let timer = null;

  async function load(defaults) {
    let stored = {};
    try {
      stored = await AREA.get(KEYS);
    } catch {
      // Sync unavailable; fall through to whatever local still holds.
    }
    if (KEYS.some((key) => key in stored)) return { ...defaults, ...stored };

    // Nothing synced yet. Settings saved by an earlier version live in local,
    // and the service worker moves them across on update; this covers the gap
    // if a page loads before that has happened.
    try {
      const legacy = await LEGACY.get(KEYS);
      return { ...defaults, ...legacy };
    } catch {
      return { ...defaults };
    }
  }

  function flush() {
    timer = null;
    const values = pending;
    pending = null;
    if (!values) return;
    try {
      AREA.set(values);
    } catch {
      // Extension context gone; the values are lost, which is survivable.
    }
  }

  // Later calls merge into the pending write rather than queueing another, so
  // a burst of changes costs one write.
  function save(values) {
    pending = { ...(pending || {}), ...values };
    if (timer === null) timer = setTimeout(flush, WRITE_DELAY_MS);
  }

  // For anything that must not be lost, such as a popup about to close.
  function saveNow(values) {
    pending = { ...(pending || {}), ...values };
    if (timer !== null) clearTimeout(timer);
    flush();
  }

  function onChange(handler) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        handler(changes);
      });
    } catch {
      // No storage events available here.
    }
  }

  globalThis.SpeedyPlaySettings = { KEYS, load, save, saveNow, onChange };
})();
