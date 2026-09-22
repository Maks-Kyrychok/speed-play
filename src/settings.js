// Settings storage, shared by the popup and the content script.
//
// Speeds are kept per context, because the three places this runs are watched
// very differently: a lecture at 2x, Shorts at whatever suits them, music
// usually left alone.
//
// chrome.storage.sync carries them between a user's machines and needs no
// permission beyond the `storage` one local already required. It does impose
// write quotas, so writes are debounced: stepping with the keyboard would
// otherwise write on every keypress.

(() => {
  "use strict";

  const Speed = globalThis.SpeedyPlaySpeed;

  const AREA = chrome.storage.sync;
  const LEGACY = chrome.storage.local;
  const KEY = "contexts";

  const CONTEXTS = ["video", "shorts", "music"];

  const LABELS = { video: "Videos", shorts: "Shorts", music: "Music" };

  // Music starts at normal speed and opted out: speeding up a song is the
  // unusual choice, unlike speeding up a talk.
  const DEFAULTS = {
    video: { speed: 2, autoApply: true },
    shorts: { speed: 1.5, autoApply: true },
    music: { speed: 1, autoApply: false },
  };

  // Comfortably under the per-minute quota even while a shortcut is held.
  const WRITE_DELAY_MS = 1000;

  let pending = null;
  let timer = null;

  const clone = (contexts) =>
    Object.fromEntries(CONTEXTS.map((name) => [name, { ...contexts[name] }]));

  // Anything stored may come from an older version, a half-written sync, or a
  // hand edit, so every field is checked rather than trusted.
  function normalise(raw) {
    const out = clone(DEFAULTS);
    if (!raw || typeof raw !== "object") return out;
    for (const name of CONTEXTS) {
      const value = raw[name];
      if (!value || typeof value !== "object") continue;
      out[name].speed = Speed.normalise(value.speed, DEFAULTS[name].speed);
      if (typeof value.autoApply === "boolean") out[name].autoApply = value.autoApply;
    }
    return out;
  }

  // Settings before 1.3 were one speed and one switch for everything. They
  // describe how the user watches ordinary videos, so they become that
  // context; Shorts and Music start from their own defaults.
  function fromLegacy(flat) {
    const out = clone(DEFAULTS);
    if (!flat) return out;
    out.video.speed = Speed.normalise(flat.selectedSpeed, DEFAULTS.video.speed);
    if (typeof flat.autoApply === "boolean") out.video.autoApply = flat.autoApply;
    return out;
  }

  async function load() {
    try {
      const stored = await AREA.get([KEY, "selectedSpeed", "autoApply"]);
      if (stored[KEY]) return normalise(stored[KEY]);
      // Synced by 1.2, before contexts existed.
      if ("selectedSpeed" in stored || "autoApply" in stored) return fromLegacy(stored);
    } catch {
      // Sync unavailable; fall through to whatever local still holds.
    }
    try {
      const legacy = await LEGACY.get(["selectedSpeed", "autoApply"]);
      if ("selectedSpeed" in legacy || "autoApply" in legacy) return fromLegacy(legacy);
    } catch {
      // Nothing readable anywhere.
    }
    return clone(DEFAULTS);
  }

  function flush() {
    timer = null;
    const value = pending;
    pending = null;
    if (!value) return;
    try {
      AREA.set({ [KEY]: value });
    } catch {
      // Extension context gone; the values are lost, which is survivable.
    }
  }

  // Later calls replace the pending write rather than queueing another, so a
  // burst of changes costs one write.
  function save(contexts) {
    pending = clone(contexts);
    if (timer === null) timer = setTimeout(flush, WRITE_DELAY_MS);
  }

  // For anything that must not be lost, such as a popup about to close.
  function saveNow(contexts) {
    pending = clone(contexts);
    if (timer !== null) clearTimeout(timer);
    flush();
  }

  function onChange(handler) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !changes[KEY]) return;
        handler(normalise(changes[KEY].newValue));
      });
    } catch {
      // No storage events available here.
    }
  }

  globalThis.SpeedyPlaySettings = {
    KEY, CONTEXTS, LABELS, DEFAULTS,
    normalise, fromLegacy, load, save, saveNow, onChange,
  };
})();
