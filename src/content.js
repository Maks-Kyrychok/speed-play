// SpeedyPlay content script.
// Injects a speed-toggle button into the YouTube player and applies the saved
// speed to new videos, both on watch pages and on Shorts.

(() => {
  "use strict";

  const BUTTON_ID = "speedyplay-button";
  const LABEL_ID = "speedyplay-label";
  const ACTIVE_COLOR = "#ff0000";
  const NORMAL_SPEED = 1.0;
  const DEFAULTS = { selectedSpeed: 2.0, autoApply: true };

  // YouTube remembers its own playback rate and restores it while the player
  // finishes initialising, which lands after our first attempt and overwrites
  // it. So the speed is re-applied for a short while after each video starts,
  // and left alone once that window closes.
  const REASSERT_MS = 5000;

  const settings = { ...DEFAULTS };

  // Auto-apply waits for the stored settings, otherwise the first video of the
  // session would briefly get the default speed instead of the chosen one.
  let settingsLoaded = false;

  // Shorts keeps several reels in the DOM at once, so more than one video may
  // need listeners over the life of the page.
  const watched = new WeakSet();
  let currentVideo = null;
  let reassertUntil = 0;

  const formatRate = (rate) => `${Number(rate.toFixed(2))}×`;

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  function loadSettings() {
    try {
      chrome.storage.local.get(DEFAULTS, (stored) => {
        if (chrome.runtime.lastError) return;
        Object.assign(settings, stored);
        settingsLoaded = true;
        beginReassert();
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

  const onShorts = () => location.pathname.startsWith("/shorts/");

  // Shorts stacks reels on top of each other. Rather than rely on YouTube's
  // internal attribute names, pick the reel that is actually playing, falling
  // back to whichever one is on screen.
  function getShortsVideo() {
    const videos = [...document.querySelectorAll("#shorts-player video, ytd-reel-video-renderer video")];
    if (!videos.length) return null;
    return (
      videos.find((v) => !v.paused && !v.ended) ||
      videos.find((v) => {
        const box = v.getBoundingClientRect();
        return box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
      }) ||
      videos[0]
    );
  }

  // On watch pages YouTube keeps other <video> elements around (miniplayer,
  // hover previews), so prefer the one inside the main player.
  function getVideo() {
    if (onShorts()) return getShortsVideo();
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

  /* ------------------------------------------------------------------ *
   * Speed
   * ------------------------------------------------------------------ */

  function beginReassert() {
    reassertUntil = Date.now() + REASSERT_MS;
  }

  function setSpeed(video, rate) {
    if (!video) return;
    video.playbackRate = rate;
    syncButton();
  }

  function toggleSpeed() {
    const video = getVideo();
    if (!video || isAdShowing()) return;
    // An explicit toggle wins: stop re-applying, or dropping back to 1x would
    // immediately be undone.
    reassertUntil = 0;
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

  const PLAYER_BUTTON_CSS =
    "display:inline-flex;align-items:center;justify-content:center;" +
    "width:48px;height:100%;padding:0;vertical-align:top;";

  const CHEVRONS_SVG =
    '<svg viewBox="0 0 36 36" style="pointer-events:none;width:100%;height:100%">' +
    '<path class="ytp-svg-fill" d="M 11 24 L 19 18 L 11 12 Z M 19 24 L 27 18 L 19 12 Z"></path>' +
    "</svg>";

  // YouTube marks dark mode with a `dark` attribute on <html>. The Shorts
  // action column sits on the page background, not over the video, so it has
  // to follow the site theme rather than always being light on dark.
  function shortsTheme() {
    return document.documentElement.hasAttribute("dark")
      ? { bg: "rgba(255,255,255,0.1)", hover: "rgba(255,255,255,0.2)", fg: "#ffffff" }
      : { bg: "rgba(0,0,0,0.05)", hover: "rgba(0,0,0,0.1)", fg: "#0f0f0f" };
  }

  function markRoot(element, variant) {
    element.dataset.speedyplayRoot = "";
    element.dataset.variant = variant;
    return element;
  }

  const getRoot = () => document.querySelector("[data-speedyplay-root]");

  function onToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleSpeed();
  }

  function buildPlayerButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    // Flexbox keeps the icon centred and the hover ring the same size as the
    // neighbouring YouTube controls.
    button.className = "ytp-button";
    button.style.cssText = PLAYER_BUTTON_CSS;
    button.innerHTML = CHEVRONS_SVG;
    button.addEventListener("click", onToggle);
    return markRoot(button, "player");
  }

  // Built to sit in the Shorts action column alongside like, dislike, comment
  // and share: a round icon button with a label underneath, same as they have.
  function buildShortsAction() {
    const theme = shortsTheme();

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;flex-direction:column;align-items:center;margin-bottom:16px;";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;" +
      "width:48px;height:48px;padding:12px;border:0;border-radius:50%;" +
      `background:${theme.bg};color:${theme.fg};cursor:pointer;`;
    button.innerHTML = CHEVRONS_SVG;
    button.addEventListener("click", onToggle);
    // Inline styles cannot carry a :hover rule.
    button.addEventListener("mouseenter", () => { button.style.background = theme.hover; });
    button.addEventListener("mouseleave", () => { button.style.background = theme.bg; });

    const label = document.createElement("span");
    label.id = LABEL_ID;
    label.style.cssText =
      `margin-top:6px;color:${theme.fg};` +
      "font:500 12px/1 Roboto,Arial,sans-serif;";

    wrap.append(button, label);
    return markRoot(wrap, "shorts");
  }

  // Reflects the real playback rate, whoever changed it.
  function syncButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const video = getVideo();
    const rate = video ? video.playbackRate : NORMAL_SPEED;
    const active = rate !== NORMAL_SPEED;

    const path = button.querySelector("path");
    if (path) path.style.fill = active ? ACTIVE_COLOR : "";

    const label = document.getElementById(LABEL_ID);
    if (label) {
      label.textContent = formatRate(rate);
      label.style.color = active ? ACTIVE_COLOR : shortsTheme().fg;
    }

    button.title = active
      ? `SpeedyPlay: ${formatRate(rate)} \u2014 click for 1\u00d7`
      : `SpeedyPlay: click for ${formatRate(settings.selectedSpeed)}`;
  }

  // The overlay that holds like/dislike/comment/share. YouTube renames these
  // containers from time to time, so try the known shapes in turn.
  const SHORTS_ACTION_SELECTORS = [
    "ytd-reel-player-overlay-renderer #actions",
    "#actions.ytd-reel-player-overlay-renderer",
    "#actions",
  ];

  function getShortsActionHost() {
    const video = getVideo();
    if (!video) return null;
    const reel = video.closest("ytd-reel-video-renderer") || document;
    for (const selector of SHORTS_ACTION_SELECTORS) {
      const host = reel.querySelector(selector);
      if (host) return host;
    }
    return null;
  }

  function ensureButton() {
    const shorts = onShorts();
    const variant = shorts ? "shorts" : "player";
    const host = shorts
      ? getShortsActionHost()
      : document.querySelector(".ytp-right-controls");
    const existing = getRoot();

    if (!host) {
      // Left the player behind, or moved between Shorts and watch pages.
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      if (existing.parentElement === host && existing.dataset.variant === variant) {
        syncButton();
        return;
      }
      existing.remove();
    }
    // In the player bar the button goes first; in the action column it goes
    // last, under the buttons that were already there.
    if (shorts) host.append(buildShortsAction());
    else host.prepend(buildPlayerButton());
    syncButton();
  }

  /* ------------------------------------------------------------------ *
   * Video lifecycle
   * ------------------------------------------------------------------ */

  function onVideoStart() {
    beginReassert();
    maybeAutoApply();
  }

  function onRateChange() {
    syncButton();
    // Inside the window this catches YouTube restoring its own rate; outside
    // it, a rate the viewer chose is simply reflected on the button.
    if (Date.now() < reassertUntil) maybeAutoApply();
  }

  // Also runs when Shorts scrolls to the next reel, which is a new video even
  // though the page never navigated.
  function trackCurrentVideo() {
    const video = getVideo();
    if (video === currentVideo) return;
    currentVideo = video;
    if (!video) return;
    if (!watched.has(video)) {
      watched.add(video);
      video.addEventListener("loadeddata", onVideoStart);
      video.addEventListener("ratechange", onRateChange);
    }
    onVideoStart();
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  // YouTube mutates the DOM constantly, so the observer only ever schedules one
  // cheap pass per animation frame.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      trackCurrentVideo();
      ensureButton();
      syncButton();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("yt-navigate-finish", () => {
    currentVideo = null;
    trackCurrentVideo();
    schedule();
  });

  loadSettings();
  schedule();
})();
