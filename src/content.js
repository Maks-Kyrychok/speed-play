// SpeedyPlay content script.
// Injects a speed-toggle button into the YouTube player and applies the saved
// speed to new videos, both on watch pages and on Shorts.

(() => {
  "use strict";

  const Speed = globalThis.SpeedyPlaySpeed;
  const Settings = globalThis.SpeedyPlaySettings;

  const BUTTON_ID = "speedyplay-button";
  const LABEL_ID = "speedyplay-label";
  const ACTIVE_COLOR = "#ff0000";
  const NORMAL_SPEED = Speed.NORMAL;
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

  async function loadSettings() {
    try {
      const stored = await Settings.load(DEFAULTS);
      Object.assign(settings, stored);
      // A speed written by an older version, or by hand, may be out of range.
      settings.selectedSpeed = Speed.normalise(stored.selectedSpeed, DEFAULTS.selectedSpeed);
      settingsLoaded = true;
      beginReassert();
      syncButton();
      maybeAutoApply();
    } catch {
      // Extension context gone (reload/update); keep the defaults.
    }
  }

  Settings.onChange((changes) => {
    if (changes.selectedSpeed) {
      settings.selectedSpeed = Speed.normalise(changes.selectedSpeed.newValue, settings.selectedSpeed);
    }
    if (changes.autoApply) settings.autoApply = changes.autoApply.newValue;
    syncButton();
  });

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

  const currentRate = () => {
    const video = getVideo();
    return video ? Speed.round(video.playbackRate) : null;
  };

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
    const next = video.playbackRate === target ? NORMAL_SPEED : target;
    setSpeed(video, next);
    showToast(formatRate(next));
  }

  function maybeAutoApply() {
    if (!settingsLoaded || !settings.autoApply) return;
    const video = getVideo();
    // Only step in while the video is at normal speed, so a speed the viewer
    // picked by hand is never overridden.
    if (!video || isAdShowing() || video.playbackRate !== NORMAL_SPEED) return;
    setSpeed(video, settings.selectedSpeed);
  }

  function persistSpeed(speed) {
    settings.selectedSpeed = speed;
    // Debounced: holding a shortcut would otherwise write on every keypress.
    Settings.save({ selectedSpeed: speed });
  }

  // Nudges the video that is playing, rather than the saved speed, so holding
  // the shortcut walks the rate up or down from wherever it already is.
  function stepSpeed(direction) {
    const video = getVideo();
    if (!video || isAdShowing()) return;
    reassertUntil = 0;
    const next = Speed.step(video.playbackRate, direction);
    setSpeed(video, next);
    showToast(formatRate(next));
    // Whatever was stepped to becomes the speed the button toggles to. Landing
    // on 1x is the exception: it would leave the toggle with nothing to do.
    if (next !== NORMAL_SPEED) persistSpeed(next);
  }

  /* ------------------------------------------------------------------ *
   * Speed menu on the player button
   * ------------------------------------------------------------------ */

  const MENU_ID = "speedyplay-menu";

  // 1x belongs here even though it is not a preset: it is the speed people
  // most often want back.
  const MENU_SPEEDS = [...Speed.PRESETS, Speed.NORMAL].sort((a, b) => a - b);

  const MENU_CSS =
    "position:absolute;z-index:2100;min-width:96px;padding:6px 0;" +
    "border-radius:12px;background:rgba(28,28,28,0.95);" +
    "font:13px/1 Roboto,Arial,sans-serif;color:#eee;" +
    "box-shadow:0 4px 32px rgba(0,0,0,0.4);";

  const ITEM_CSS =
    "display:flex;align-items:center;gap:8px;padding:9px 16px;" +
    "cursor:pointer;white-space:nowrap;";

  function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) menu.remove();
  }

  const menuIsOpen = () => !!document.getElementById(MENU_ID);

  // An explicit pick applies now and becomes what the button toggles to.
  // 1x is the exception, as it would leave the toggle with nothing to do.
  function chooseSpeed(speed) {
    const video = getVideo();
    if (!video || isAdShowing()) return;
    reassertUntil = 0;
    setSpeed(video, speed);
    showToast(formatRate(speed));
    if (speed !== NORMAL_SPEED) persistSpeed(speed);
  }

  function buildMenu(current) {
    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.style.cssText = MENU_CSS;
    for (const speed of MENU_SPEEDS) {
      const item = document.createElement("div");
      item.style.cssText = ITEM_CSS;
      const selected = speed === current;
      if (selected) item.style.color = ACTIVE_COLOR;
      // A fixed-width tick keeps every label starting at the same x.
      item.innerHTML =
        `<span style="width:12px">${selected ? "\u2713" : ""}</span>` +
        `<span>${formatRate(speed)}</span>`;
      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(255,255,255,0.1)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "";
      });
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        chooseSpeed(speed);
        closeMenu();
      });
      menu.append(item);
    }
    return menu;
  }

  // Positioned against the player rather than the viewport, so it travels with
  // the player into fullscreen instead of being left behind on the body.
  function placeMenu(menu, root, button) {
    const rootBox = root.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const menuBox = menu.getBoundingClientRect();

    const centred = buttonBox.left - rootBox.left + buttonBox.width / 2 - menuBox.width / 2;
    const margin = 8;
    const maxLeft = rootBox.width - menuBox.width - margin;
    menu.style.left = `${Math.max(margin, Math.min(centred, maxLeft))}px`;
    menu.style.bottom = `${rootBox.bottom - buttonBox.top + margin}px`;
  }

  function toggleMenu() {
    if (menuIsOpen()) {
      closeMenu();
      return;
    }
    const root = getPlayerRoot();
    const button = document.getElementById(BUTTON_ID);
    if (!root || !button) return;

    const video = getVideo();
    const menu = buildMenu(video ? Speed.round(video.playbackRate) : NORMAL_SPEED);
    if (getComputedStyle(root).position === "static") root.style.position = "relative";
    root.appendChild(menu);
    // Measured only once it is in the document, or it has no width yet.
    placeMenu(menu, root, button);
  }

  // Capture, so a click anywhere closes it before the page acts on that click.
  document.addEventListener(
    "click",
    (event) => {
      if (!menuIsOpen()) return;
      if (event.target.closest(`#${MENU_ID}, #${BUTTON_ID}`)) return;
      closeMenu();
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && menuIsOpen()) closeMenu();
    },
    true,
  );

  /* ------------------------------------------------------------------ *
   * On-screen indicator
   * ------------------------------------------------------------------ */

  const TOAST_ID = "speedyplay-toast";
  const TOAST_MS = 900;
  const TOAST_CSS =
    "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
    "z-index:2000;pointer-events:none;padding:10px 18px;border-radius:6px;" +
    "background:rgba(0,0,0,0.75);color:#fff;" +
    "font:700 22px/1 Roboto,Arial,sans-serif;" +
    "opacity:0;transition:opacity 150ms ease;";

  let toastTimer = null;

  // The element that actually goes fullscreen.
  function getPlayerRoot() {
    if (!onShorts()) return document.querySelector("#movie_player");
    const video = getVideo();
    if (!video) return null;
    return video.closest("#shorts-player") || video.closest("ytd-reel-video-renderer");
  }

  // Without this the shortcuts give no sign of having worked: the button is
  // small, and in fullscreen the controls it sits in are hidden entirely.
  function showToast(text) {
    const root = getPlayerRoot();
    if (!root) return;

    let toast = document.getElementById(TOAST_ID);
    if (!toast || toast.parentElement !== root) {
      if (toast) toast.remove();
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.style.cssText = TOAST_CSS;
      // Fullscreen renders only the subtree of the element that was expanded,
      // so the indicator has to live inside the player, not on the body.
      if (getComputedStyle(root).position === "static") root.style.position = "relative";
      root.appendChild(toast);
    }

    toast.textContent = text;
    // Re-trigger the fade even if the previous one has not finished.
    toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, TOAST_MS);
  }

  /* ------------------------------------------------------------------ *
   * Button
   * ------------------------------------------------------------------ */

  const PLAYER_BUTTON_CSS =
    "display:inline-flex;align-items:center;justify-content:center;" +
    "width:48px;height:100%;padding:0;vertical-align:top;";

  // Drawn for the 24-unit box YouTube's Shorts icons use, rather than scaling
  // the player-bar glyph. That one is wide and flat by the conventions of the
  // control bar, so however it is scaled it reads as thin beside the native
  // icons; this one matches their height.
  const SHORTS_ICON = {
    viewBox: "0 0 24 24",
    path: "M 2 2.5 L 12 12 L 2 21.5 Z M 12 2.5 L 22 12 L 12 21.5 Z",
  };

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
    // Both children are built once and shown in turn, rather than rewriting
    // the markup on every sync, which runs whenever the page mutates.
    button.innerHTML =
      `<span data-sp="icon" style="display:flex;width:100%;height:100%">${CHEVRONS_SVG}</span>` +
      '<span data-sp="rate" style="display:none;color:' + ACTIVE_COLOR + ';' +
      "font:700 12px/1 Roboto,Arial,sans-serif\"></span>";
    button.addEventListener("click", onToggle);
    button.addEventListener("contextmenu", (event) => {
      // Otherwise YouTube's own context menu covers the player.
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });
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

    const cls = (element, fallback) =>
      element && element.className ? element.className : fallback;

    const button = sample.querySelector("button");

    // Anchor on the icon and the caption themselves and take their containers,
    // rather than matching class names by substring. Several of the button's
    // own classes contain "Icon" (IconButton, MainstageIconSize), so a
    // substring match picks up the button and its padding and tonal background
    // end up on the icon box, squashing and darkening it.
    const iconWrapper = sample.querySelector(".ytIconWrapperHost, yt-icon");
    const iconBox =
      iconWrapper && iconWrapper.parentElement !== button
        ? iconWrapper.parentElement
        : null;

    const caption = sample.querySelector("[role='text']");

    return {
      wrap: cls(sample, NATIVE_CLASSES.wrap),
      label: cls(sample.querySelector("label"), NATIVE_CLASSES.label),
      button: cls(button, NATIVE_CLASSES.button),
      icon: cls(iconBox, NATIVE_CLASSES.icon),
      labelBox: cls(caption && caption.parentElement, NATIVE_CLASSES.labelBox),
      labelText: cls(caption, NATIVE_CLASSES.labelText),
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
      `<svg viewBox="${SHORTS_ICON.viewBox}" width="24" height="24" focusable="false" aria-hidden="true" ` +
      'style="pointer-events:none;display:inherit;width:100%;height:100%">' +
      `<path d="${SHORTS_ICON.path}"></path>` +
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

    // On the player bar the icon gives way to the number, so the speed can be
    // read at a glance instead of only from the tooltip.
    const icon = button.querySelector('[data-sp="icon"]');
    const text = button.querySelector('[data-sp="rate"]');
    if (icon && text) {
      icon.style.display = active ? "none" : "flex";
      text.style.display = active ? "flex" : "none";
      text.textContent = formatRate(rate);
    }

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
    try {
      // Nothing is listening unless the popup is open, hence the empty catch.
      chrome.runtime.sendMessage({ type: "rate-changed", rate: currentRate() }).catch(() => {});
    } catch {
      // Extension context gone.
    }
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
   * Keyboard, handled in the page
   * ------------------------------------------------------------------ */

  // chrome.commands only fires if the browser agreed to reserve the keys, and
  // Chromium forks routinely take them for their own interface, leaving the
  // extension looking broken. Handling the keys here works in any of them, and
  // lets the default be suppressed so Alt+Down stops scrolling the page.
  // Keyed by event.code: with Alt held, macOS reports event.key as the
  // character the combination would type, so "s" arrives as "ß".
  const PAGE_KEYS = {
    KeyA: () => toggleSpeed(),
    KeyS: () => openPopup(),
    Period: () => stepSpeed(1),
    Comma: () => stepSpeed(-1),
    ArrowUp: () => stepSpeed(1),
    ArrowDown: () => stepSpeed(-1),
  };

  // A page cannot open the extension's popup itself; only the service worker
  // can. Older browsers have no openPopup at all, so this may do nothing.
  function openPopup() {
    try {
      chrome.runtime.sendMessage({ type: "open-popup" }).catch(() => {});
    } catch {
      // Extension context gone.
    }
  }

  function isTyping(element) {
    if (!element) return false;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") return true;
    if (element.isContentEditable) return true;
    // The event may come from inside a comment box rather than from the box
    // itself, and isContentEditable is not available in every environment.
    return (
      typeof element.closest === "function" &&
      !!element.closest('[contenteditable]:not([contenteditable="false"])')
    );
  }

  function onKeyDown(event) {
    // Plain Alt belongs to the page; Alt+Shift is what the browser-level
    // shortcuts use. Without this split, Alt+Shift+S would both open the popup
    // through the browser and toggle the speed here, from one keypress.
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (isTyping(event.target)) return;

    const action = PAGE_KEYS[event.code];
    if (!action) return;

    event.preventDefault();
    event.stopPropagation();
    action();
  }

  // Capture phase, so YouTube's own handlers do not see these first.
  document.addEventListener("keydown", onKeyDown, true);

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

  // Applies a speed the popup picked, straight away rather than only on the
  // next toggle.
  function applyFromPopup(speed) {
    const video = getVideo();
    if (!video || isAdShowing()) return;
    reassertUntil = 0;
    const next = Speed.clamp(speed);
    setSpeed(video, next);
    showToast(formatRate(next));
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (!message) return;
      switch (message.type) {
        case "toggle-speed": toggleSpeed(); break;
        case "speed-up": stepSpeed(1); break;
        case "speed-down": stepSpeed(-1); break;
        case "set-speed": applyFromPopup(message.speed); break;
        case "get-rate": break;
        default: return;
      }
      // Every handled message answers with the rate now playing, so the popup
      // never has to guess what its own request did.
      respond({ rate: currentRate() });
    });
  } catch {
    // Messaging unavailable; the in-player button still works.
  }

  loadSettings();
  schedule();
})();
