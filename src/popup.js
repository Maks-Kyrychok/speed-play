// SpeedyPlay popup. Speeds are kept per context, so the popup edits one at a
// time and opens on whichever the current tab belongs to.

"use strict";

const Speed = globalThis.SpeedyPlaySpeed;
const Settings = globalThis.SpeedyPlaySettings;

const MUSIC_ORIGIN = "*://music.youtube.com/*";

const tabsEl = document.getElementById("tabs");
const chipsEl = document.getElementById("chips");
const customEl = document.getElementById("custom-speed");
const autoApplyEl = document.getElementById("auto-apply");
const autoApplyLabelEl = document.getElementById("auto-apply-label");
const nowEl = document.getElementById("now");
const controlsEl = document.getElementById("controls");
const permissionEl = document.getElementById("permission");

let contexts = Settings.normalise(null);
let selected = "video";

const current = () => contexts[selected];

function save() {
  // The popup can be dismissed at any moment, so nothing here waits.
  Settings.saveNow(contexts);
}

/* -------------------------------------------------------------------- *
 * Talking to the tab being watched
 * -------------------------------------------------------------------- */

async function activeTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab && tab.id !== undefined ? tab : null;
  } catch {
    return null;
  }
}

// Returns null when that tab is not a YouTube page, which is not an error
// worth showing.
async function send(message) {
  const tab = await activeTab();
  if (!tab) {
    showRate(undefined);
    return null;
  }
  try {
    const reply = await chrome.tabs.sendMessage(tab.id, message);
    showRate(reply && reply.rate);
    return reply;
  } catch {
    showRate(undefined);
    return null;
  }
}

function showRate(rate) {
  if (typeof rate === "number") {
    nowEl.innerHTML = `Now playing at <strong>${Speed.format(rate)}</strong>`;
  } else {
    nowEl.textContent = "Open a YouTube video to control its speed.";
  }
}

/* -------------------------------------------------------------------- *
 * Context tabs
 * -------------------------------------------------------------------- */

function renderTabs() {
  tabsEl.replaceChildren(
    ...Settings.CONTEXTS.map((name) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab";
      tab.textContent = Settings.LABELS[name];
      tab.dataset.context = name;
      tab.addEventListener("click", () => selectContext(name));
      return tab;
    }),
  );
}

function selectContext(name) {
  selected = name;
  sync();
  refreshPermissionNotice();
}

// Guesses from the URL of the tab being watched, so the popup opens on what
// the viewer is actually looking at.
function contextOf(url) {
  if (!url) return null;
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname === "music.youtube.com") return "music";
    if (!hostname.endsWith("youtube.com")) return null;
    return pathname.startsWith("/shorts/") ? "shorts" : "video";
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- *
 * Access to YouTube Music
 * -------------------------------------------------------------------- */

// Music is an optional permission: requiring it up front would have disabled
// the extension for everyone who already had it, pending re-acceptance.
async function hasMusicAccess() {
  try {
    return await chrome.permissions.contains({ origins: [MUSIC_ORIGIN] });
  } catch {
    return false;
  }
}

async function refreshPermissionNotice() {
  const needed = selected === "music" && !(await hasMusicAccess());
  permissionEl.hidden = !needed;
  controlsEl.hidden = needed;
}

document.getElementById("grant").addEventListener("click", async () => {
  try {
    // Must be called straight from the click, or Chrome refuses the prompt.
    const granted = await chrome.permissions.request({ origins: [MUSIC_ORIGIN] });
    if (granted) refreshPermissionNotice();
  } catch {
    // Prompt unavailable; the notice stays up.
  }
});

/* -------------------------------------------------------------------- *
 * Speed controls
 * -------------------------------------------------------------------- */

function renderChips() {
  chipsEl.replaceChildren(
    ...Speed.PRESETS.map((speed) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = Speed.format(speed);
      chip.dataset.speed = String(speed);
      chip.addEventListener("click", () => setSpeed(speed));
      return chip;
    }),
  );
}

function setSpeed(speed) {
  current().speed = Speed.clamp(speed);
  sync();
  save();
  // Only the context on screen can be applied to what is on screen.
  if (selected === openedOn) send({ type: "set-speed", speed: current().speed });
}

// Runs on Enter and on losing focus, not on every keystroke: typing "1" on the
// way to "1.5" should not be taken as a choice.
function applyCustom() {
  const typed = Number.parseFloat(customEl.value);
  // An unusable entry falls back to what was already set rather than to a
  // default, so a stray keystroke cannot lose the speed.
  const next = Speed.isValid(typed) ? Speed.round(typed) : current().speed;
  customEl.value = String(next);
  setSpeed(next);
}

function sync() {
  for (const tab of tabsEl.children) {
    tab.setAttribute("aria-selected", String(tab.dataset.context === selected));
  }
  for (const chip of chipsEl.children) {
    chip.setAttribute("aria-pressed", String(Number(chip.dataset.speed) === current().speed));
  }
  if (document.activeElement !== customEl) customEl.value = String(current().speed);
  autoApplyEl.checked = current().autoApply;
  autoApplyLabelEl.textContent =
    selected === "music"
      ? "Apply automatically to new tracks"
      : "Apply automatically to new videos";
}

/* -------------------------------------------------------------------- *
 * Wiring
 * -------------------------------------------------------------------- */

let openedOn = null;

autoApplyEl.addEventListener("change", () => {
  current().autoApply = autoApplyEl.checked;
  save();
});

customEl.addEventListener("change", applyCustom);
customEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") customEl.blur();
});

document.getElementById("edit-shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// The rate can change from the player button or a shortcut while this is open.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "rate-changed") showRate(message.rate);
});

// So can the settings, from another window or another machine.
Settings.onChange((next) => {
  contexts = next;
  sync();
});

// Controls are rendered only once the stored values are in, so an early click
// cannot save settings that were still at their defaults.
async function init() {
  contexts = await Settings.load();
  const tab = await activeTab();
  openedOn = contextOf(tab && tab.url);
  selected = openedOn || "video";
  renderTabs();
  renderChips();
  sync();
  await refreshPermissionNotice();
  send({ type: "get-rate" });
}

init();
