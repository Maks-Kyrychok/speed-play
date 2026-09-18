// Speed helpers shared by the popup and the content script. Both load this
// file, so the two can never disagree about what counts as a valid speed.

(() => {
  "use strict";

  const NORMAL = 1;
  // Chrome accepts a far wider playbackRate, but below 0.25 speech is
  // unintelligible and above 4 the browser stops rendering audio.
  const MIN = 0.25;
  const MAX = 4;
  const STEP = 0.25;

  const PRESETS = [0.5, 0.75, 1.25, 1.5, 1.75, 2, 2.5, 3];

  // Two decimals is as fine as the UI goes, and it stops repeated stepping
  // from drifting into 1.3499999999999999.
  const round = (speed) => Math.round(speed * 100) / 100;

  const isValid = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= MIN && value <= MAX;

  const clamp = (value) => round(Math.min(MAX, Math.max(MIN, value)));

  // Falls back instead of throwing: a stored value may come from an older
  // version, or from someone editing storage by hand.
  const normalise = (value, fallback) => (isValid(value) ? round(value) : fallback);

  const step = (speed, direction) => clamp(round(speed) + direction * STEP);

  // 2 reads better than 2.00, while 1.25 keeps its decimals.
  const format = (speed) => `${Number(round(speed).toFixed(2))}×`;

  globalThis.SpeedyPlaySpeed = {
    NORMAL, MIN, MAX, STEP, PRESETS,
    round, isValid, clamp, normalise, step, format,
  };
})();
