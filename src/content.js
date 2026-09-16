// SpeedyPlay content script.
// Injects a speed-toggle button into the YouTube player, applies the saved
// speed to new videos, and responds to the keyboard shortcut.

(() => {
  "use strict";

  const BUTTON_ID = "speedyplay-button";
  const NORMAL_SPEED = 1.0;
  const DEFAULTS = { selectedSpeed: 2.0, autoApply: true };

  const settings = { ...DEFAULTS };

  // Auto-apply waits for the stored settings, otherwise the first video of the
  // session would briefly get the default speed instead of the chosen one.
  let settingsLoaded = false;

  // The video element YouTube reuses across navigations. Tracked so listeners
  // are attached exactly once per element.
  let watchedVideo = null;

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  function loadSettings() {
    try {
      chrome.storage.local.get(DEFAULTS, (stored) => {
        if (chrome.runtime.lastError) return;
        Object.assign(settings, stored);
        settingsLoaded = true;
        syncButton();
        maybeAutoApply();
      });
    } catch {
      // Extension context gone (reload/update); keep the defaults.
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.selectedSpeed) settings.selectedSpeed = changes.selectedSpeed.newValue;
      if (changes.autoApply) settings.autoApply = changes.autoApply.newValue;
      syncButton();
    });
  } catch {
    // No storage events available; the popup will still work.
  }

  /* ------------------------------------------------------------------ *
   * Player access
   * ------------------------------------------------------------------ */

  // YouTube keeps several <video> elements around (miniplayer, previews), so
  // prefer the one inside the main player rather than the first on the page.
  function getVideo() {
    return (
      document.querySelector("#movie_player video.html5-main-video") ||
      document.querySelector("video.html5-main-video") ||
      null
    );
  }

  // Ads play through the same element; changing their speed is not wanted.
  function isAdShowing() {
    const player = document.querySelector("#movie_player");
    return !!player && player.classList.contains("ad-showing");
  }

  function setSpeed(video, rate) {
    if (!video) return;
    video.playbackRate = rate;
    syncButton();
  }

  function toggleSpeed() {
    const video = getVideo();
    if (!video || isAdShowing()) return;
    const target = settings.selectedSpeed;
    setSpeed(video, video.playbackRate === target ? NORMAL_SPEED : target);
  }

  function maybeAutoApply() {
    if (!settingsLoaded || !settings.autoApply) return;
    const video = getVideo();
    // Only step in while the video is at normal speed, so a speed the viewer
    // picked by hand is never overridden.
    if (!video || isAdShowing() || video.playbackRate !== NORMAL_SPEED) return;
    setSpeed(video, settings.selectedSpeed);
  }

  /* ------------------------------------------------------------------ *
   * Button
   * ------------------------------------------------------------------ */

  function buildButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "ytp-button";
    // Flexbox keeps the icon centred and the hover ring the same size as the
    // neighbouring YouTube controls.
    button.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;" +
      "width:48px;height:100%;padding:0;vertical-align:top;";
    button.innerHTML =
      '<svg height="100%" viewBox="0 0 36 36" width="100%" style="pointer-events:none">' +
      '<path class="ytp-svg-fill" d="M 11 24 L 19 18 L 11 12 Z M 19 24 L 27 18 L 19 12 Z"></path>' +
      "</svg>";
    button.addEventListener("click", toggleSpeed);
    return button;
  }

  // Reflects the current playback rate: red icon while sped up, plus a tooltip
  // naming the speed the button will switch to.
  function syncButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const video = getVideo();
    const rate = video ? video.playbackRate : NORMAL_SPEED;
    const active = rate !== NORMAL_SPEED;
    const path = button.querySelector("path");
    if (path) path.style.fill = active ? "#ff0000" : "";
    button.title = active
      ? `SpeedyPlay: ${rate}× — click for 1×`
      : `SpeedyPlay: click for ${settings.selectedSpeed}×`;
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const controls = document.querySelector(".ytp-right-controls");
    if (!controls) return;
    controls.prepend(buildButton());
    syncButton();
  }

  /* ------------------------------------------------------------------ *
   * Video lifecycle
   * ------------------------------------------------------------------ */

  function watchVideo() {
    const video = getVideo();
    if (!video || video === watchedVideo) return;
    watchedVideo = video;
    // `loadeddata` fires for every new video in the same element, which is how
    // SPA navigation looks from here.
    video.addEventListener("loadeddata", maybeAutoApply);
    video.addEventListener("ratechange", syncButton);
    maybeAutoApply();
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  // YouTube mutates the DOM constantly, so the observer only ever schedules one
  // cheap check per animation frame.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureButton();
      watchVideo();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Re-attaching to the same element is harmless: the DOM ignores a duplicate
  // listener registration with the same function reference.
  document.addEventListener("yt-navigate-finish", () => {
    watchedVideo = null;
    watchVideo();
    schedule();
  });

  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "toggle-speed") toggleSpeed();
    });
  } catch {
    // Messaging unavailable; the in-player button still works.
  }

  loadSettings();
  schedule();
})();
