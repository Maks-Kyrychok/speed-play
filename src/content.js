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

  // Class names of one native Shorts action, used as a template. They are read
  // off a live button whenever possible so the button keeps matching after
  // YouTube renames them; these values are only the fallback.
  const NATIVE_CLASSES = {
    wrap: "ytSpecButtonViewModelHost ytwReelActionBarViewModelHostDesktopActionButton",
    label: "ytSpecButtonShapeWithLabelHost ytSpecButtonShapeWithLabelIsOverlay",
    button:
      "ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal " +
      "ytSpecButtonShapeNextOverlayDark ytSpecButtonShapeNextSizeL " +
      "ytSpecButtonShapeNextIconButton ytSpecButtonShapeNextMainstageIconSize " +
      "ytSpecButtonShapeNextMainstagePadding",
    icon: "ytSpecButtonShapeNextIcon ytSpecButtonShapeNextElevatedContent",
    labelBox: "ytSpecButtonShapeWithLabelLabel",
    labelText:
      "ytAttributedStringHost ytAttributedStringWhiteSpacePreWrap " +
      "ytAttributedStringTextAlignmentCenter ytAttributedStringWordWrapping",
  };

  function nativeClasses(host) {
    // The like button nests an extra view model, so take a plain action.
    const sample = host.querySelector(":scope > button-view-model") ||
                   host.querySelector("button-view-model");
    if (!sample) return NATIVE_CLASSES;
    const pick = (selector, fallback) => {
      const found = sample.querySelector(selector);
      return found && found.className ? found.className : fallback;
    };
    return {
      wrap: sample.className || NATIVE_CLASSES.wrap,
      label: pick("label", NATIVE_CLASSES.label),
      button: pick("button", NATIVE_CLASSES.button),
      icon: pick("[class*='Icon']", NATIVE_CLASSES.icon),
      labelBox: pick("[class*='WithLabelLabel']", NATIVE_CLASSES.labelBox),
      labelText: pick("[class*='WithLabelLabel'] span", NATIVE_CLASSES.labelText),
    };
  }

  // Same shape as a native action: round icon button with a caption under it,
  // where like and comment show their counts and this one shows the speed.
  function buildShortsAction(host) {
    const css = nativeClasses(host);

    // A plain <div> rather than <button-view-model>: constructing YouTube's own
    // custom element could let their framework re-render over our contents.
    const wrap = document.createElement("div");
    wrap.className = css.wrap;

    const label = document.createElement("label");
    label.className = css.label;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = css.button;
    button.innerHTML =
      `<div aria-hidden="true" class="${css.icon}">` +
      '<span class="ytIconWrapperHost" style="width:24px;height:24px">' +
      '<span class="yt-icon-shape ytSpecIconShapeHost">' +
      '<div style="width:100%;height:100%;display:block;' +
      'filter:drop-shadow(0px 1px 4px rgba(0,0,0,0.3));fill:currentcolor">' +
      // The 36-unit artwork is scaled into the 24px box YouTube's icons use.
      '<svg viewBox="0 0 36 36" width="24" height="24" focusable="false" aria-hidden="true" ' +
      'style="pointer-events:none;display:inherit;width:100%;height:100%">' +
      '<path d="M 11 24 L 19 18 L 11 12 Z M 19 24 L 27 18 L 19 12 Z"></path>' +
      "</svg></div></span></span></div>";
    button.addEventListener("click", onToggle);

    const labelBox = document.createElement("div");
    labelBox.className = css.labelBox;
    const labelText = document.createElement("span");
    labelText.id = LABEL_ID;
    labelText.className = css.labelText;
    labelText.setAttribute("role", "text");
    labelBox.append(labelText);

    label.append(button, labelBox);
    wrap.append(label);
    return markRoot(wrap, "shorts");
  }

  // Reflects the real playback rate, whoever changed it.
  function syncButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const video = getVideo();
    const rate = video ? video.playbackRate : NORMAL_SPEED;
    const active = rate !== NORMAL_SPEED;

    // Cleared rather than set to a colour, so YouTube's own styling applies
    // while the video runs at normal speed.
    const path = button.querySelector("path");
    if (path) path.style.fill = active ? ACTIVE_COLOR : "";

    const label = document.getElementById(LABEL_ID);
    if (label) {
      label.textContent = formatRate(rate);
      label.style.color = active ? ACTIVE_COLOR : "";
    }

    const title = active
      ? `SpeedyPlay: ${formatRate(rate)} — click for 1×`
      : `SpeedyPlay: click for ${formatRate(settings.selectedSpeed)}`;
    button.title = title;
    button.setAttribute("aria-label", title);
  }

  // The column holding like, dislike, comment and share.
  const SHORTS_ACTION_SELECTORS = [
    "reel-action-bar-view-model",
    ".ytReelPlayerOverlayViewModelActionsContainer",
    "ytd-reel-player-overlay-renderer #actions",
    "#actions",
  ];

  const isOnScreen = (element) => {
    const box = element.getBoundingClientRect();
    return box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
  };

  function getShortsActionHost() {
    const video = getVideo();
    if (!video) return null;
    // Prefer the column belonging to the active reel; fall back to a page-wide
    // search for layouts where the overlay sits outside the reel element.
    const reel = video.closest("ytd-reel-video-renderer");
    for (const scope of reel ? [reel, document] : [document]) {
      for (const selector of SHORTS_ACTION_SELECTORS) {
        const found = [...scope.querySelectorAll(selector)];
        const host = found.find(isOnScreen) || found[0];
        if (host) return host.querySelector("reel-action-bar-view-model") || host;
      }
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
    if (shorts) {
      const action = buildShortsAction(host);
      const pivot = host.querySelector(":scope > pivot-button-view-model");
      if (pivot) host.insertBefore(action, pivot);
      else host.append(action);
    } else {
      host.prepend(buildPlayerButton());
    }
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
