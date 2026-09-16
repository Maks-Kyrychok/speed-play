// SpeedyPlay popup: picks the speed the in-player button switches to.
// Every change is saved right away, so there is nothing to confirm.

"use strict";

const SPEED_OPTIONS = [0.5, 0.75, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const DEFAULTS = { selectedSpeed: 2.0, autoApply: true };

const chipsEl = document.getElementById("chips");
const autoApplyEl = document.getElementById("auto-apply");

let selectedSpeed = DEFAULTS.selectedSpeed;

// 2.0 reads better as "2×" than "2.0×", while 1.25 keeps its decimals.
function formatSpeed(speed) {
  return `${Number(speed.toFixed(2))}×`;
}

function save() {
  return chrome.storage.local.set({
    selectedSpeed,
    autoApply: autoApplyEl.checked,
  });
}

function renderChips() {
  chipsEl.replaceChildren(
    ...SPEED_OPTIONS.map((speed) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = formatSpeed(speed);
      chip.dataset.speed = String(speed);
      chip.addEventListener("click", () => {
        selectedSpeed = speed;
        syncChips();
        save();
      });
      return chip;
    }),
  );
  syncChips();
}

function syncChips() {
  for (const chip of chipsEl.children) {
    chip.setAttribute("aria-pressed", String(Number(chip.dataset.speed) === selectedSpeed));
  }
}

// Chips are rendered only once the stored values are in, so a very early click
// cannot save settings that were still at their defaults.
async function init() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  selectedSpeed = SPEED_OPTIONS.includes(stored.selectedSpeed)
    ? stored.selectedSpeed
    : DEFAULTS.selectedSpeed;
  autoApplyEl.checked = stored.autoApply !== false;
  renderChips();
}

// Assigning `checked` in init() does not fire this, so there is no save loop.
autoApplyEl.addEventListener("change", save);

init();
