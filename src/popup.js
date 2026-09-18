// SpeedyPlay popup: picks the speed the in-player button switches to.
// Every change is saved right away, so there is nothing to confirm.

"use strict";

const Speed = globalThis.SpeedyPlaySpeed;
const DEFAULTS = { selectedSpeed: 2.0, autoApply: true };

const chipsEl = document.getElementById("chips");
const customEl = document.getElementById("custom-speed");
const autoApplyEl = document.getElementById("auto-apply");

let selectedSpeed = DEFAULTS.selectedSpeed;

function save() {
  return chrome.storage.local.set({
    selectedSpeed,
    autoApply: autoApplyEl.checked,
  });
}

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
  selectedSpeed = Speed.clamp(speed);
  sync();
  save();
}

// Keeps the chips and the number field showing the same value, whichever one
// it was set from. A speed that is not a preset simply lights no chip.
function sync() {
  for (const chip of chipsEl.children) {
    chip.setAttribute("aria-pressed", String(Number(chip.dataset.speed) === selectedSpeed));
  }
  if (document.activeElement !== customEl) customEl.value = String(selectedSpeed);
}

// Runs on Enter and on losing focus, not on every keystroke: typing "1" on the
// way to "1.5" should not be taken as a choice.
function applyCustom() {
  const typed = Number.parseFloat(customEl.value);
  // An unusable entry falls back to what was already set rather than to a
  // default, so a stray keystroke cannot lose the user's speed.
  selectedSpeed = Speed.isValid(typed) ? Speed.round(typed) : selectedSpeed;
  customEl.value = String(selectedSpeed);
  sync();
  save();
}

// Settings are read before the chips exist, so a very early click cannot save
// values that were still at their defaults.
async function init() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  selectedSpeed = Speed.normalise(stored.selectedSpeed, DEFAULTS.selectedSpeed);
  autoApplyEl.checked = stored.autoApply !== false;
  renderChips();
  sync();
}

// Shows the shortcuts the user actually has: they are remappable, and Chrome
// leaves one unassigned if it collided with another extension.
async function loadShortcuts() {
  const byName = {
    "toggle-speed": document.getElementById("sc-toggle"),
    "speed-up": document.getElementById("sc-up"),
    "speed-down": document.getElementById("sc-down"),
  };
  const commands = await chrome.commands.getAll();
  for (const command of commands) {
    const el = byName[command.name];
    if (el) el.textContent = command.shortcut || "not set";
  }
}

document.getElementById("edit-shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

customEl.addEventListener("change", applyCustom);
customEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") customEl.blur();
});

// Assigning `checked` in init() does not fire this, so there is no save loop.
autoApplyEl.addEventListener("change", save);

// Another surface may change the speed while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.selectedSpeed) return;
  selectedSpeed = Speed.normalise(changes.selectedSpeed.newValue, selectedSpeed);
  sync();
});

init();
loadShortcuts();
