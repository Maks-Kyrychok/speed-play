// SpeedyPlay popup: picks the speed the in-player button and hotkey switch to.

"use strict";

const SPEED_OPTIONS = [1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const DEFAULTS = { selectedSpeed: 2.0, autoApply: true };

const chipsEl = document.getElementById("chips");
const autoApplyEl = document.getElementById("auto-apply");
const statusEl = document.getElementById("status");
const shortcutEl = document.getElementById("shortcut");

let selectedSpeed = DEFAULTS.selectedSpeed;
let statusTimer = null;

// 2.0 reads better as "2×" than "2.0×", while 1.25 keeps its decimals.
function formatSpeed(speed) {
  return `${Number(speed.toFixed(2))}×`;
}

function renderChips() {
  chipsEl.replaceChildren(
    ...SPEED_OPTIONS.map((speed) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.role = "radio";
      chip.textContent = formatSpeed(speed);
      chip.dataset.speed = String(speed);
      chip.addEventListener("click", () => {
        selectedSpeed = speed;
        syncChips();
      });
      return chip;
    }),
  );
  syncChips();
}

function syncChips() {
  for (const chip of chipsEl.children) {
    const isSelected = Number(chip.dataset.speed) === selectedSpeed;
    chip.setAttribute("aria-checked", String(isSelected));
    chip.tabIndex = isSelected ? 0 : -1;
  }
}

function showStatus(message) {
  statusEl.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  selectedSpeed = SPEED_OPTIONS.includes(stored.selectedSpeed)
    ? stored.selectedSpeed
    : DEFAULTS.selectedSpeed;
  autoApplyEl.checked = stored.autoApply !== false;
  syncChips();
}

async function save() {
  await chrome.storage.local.set({
    selectedSpeed,
    autoApply: autoApplyEl.checked,
  });
  showStatus("Saved");
}

// Shows the shortcut the user actually has, which may differ from the default
// or be unassigned if it clashed with another extension.
async function loadShortcut() {
  const commands = await chrome.commands.getAll();
  const toggle = commands.find((command) => command.name === "toggle-speed");
  shortcutEl.textContent = toggle && toggle.shortcut ? toggle.shortcut : "not set";
}

document.getElementById("save").addEventListener("click", save);

document.getElementById("edit-shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

renderChips();
loadSettings();
loadShortcut();
