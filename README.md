# SpeedyPlay

A small Chrome extension that switches YouTube playback speed without digging
through the player's settings menu. Desktop YouTube only.

## What it does

- Adds a speed button to the YouTube player controls, next to the built-in
  ones. Clicking it flips between normal speed and your chosen speed, and it
  shows the current rate in place of its icon while the video is sped up.
- Right-clicking that button opens a speed menu, on watch pages and on Shorts
  alike, so picking a specific speed does not mean reaching for the toolbar.
- Works on Shorts too, where it joins the like/dislike/comment/share column as
  a matching round button with the current speed underneath.
- Applies your chosen speed automatically to every new video, if you want it to.
  This is on by default and can be turned off in the popup.
- Has keyboard shortcuts: `Alt+Shift+S` opens the popup, `Alt+Shift+A`
  toggles, and `Alt+Shift+.` and `Alt+Shift+,` step by 0.25x, echoing the
  `Shift+.` and `Shift+,` YouTube uses for the same thing. All four are
  remappable at `chrome://extensions/shortcuts`, and the popup says so when
  Chrome has left one unassigned.
- Shows the new speed over the video whenever it changes, which is the only
  feedback available in fullscreen, where the controls are hidden.
- The popup reads the speed of the video in the tab you are on, and picking a
  speed there applies it straight away instead of waiting for the next toggle.
- Holds the speed while the player starts up. YouTube restores its own
  remembered rate a moment after the page loads, so the speed is re-applied for
  a few seconds and then left alone.
- Skips ads, so they keep playing at normal speed.
- Leaves a speed you set by hand alone: auto-apply only steps in when the video
  is still at 1×, and switching speed from the button stops it re-applying.

Speeds available: 0.5×, 0.75×, 1.25×, 1.5×, 1.75×, 2×, 2.5×, 3×.

It runs on `www.youtube.com` only — not YouTube Music, not the mobile site, and
not videos embedded on other sites.

## Install from source

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `src/` folder of this repository.

There is no build step — `src/` is the extension.

## Packaging for the Chrome Web Store

Zip the contents of `src/` (the manifest must sit at the root of the archive):

```sh
cd src && zip -r ../speedyplay.zip . -x '.*' && cd ..
```

## Layout

| File | Purpose |
| --- | --- |
| `src/manifest.json` | Extension manifest (MV3) |
| `src/speed.js` | Speed validation and formatting, shared by the two below |
| `src/settings.js` | Synced storage with debounced writes, shared likewise |
| `src/content.js` | Player button, Shorts button, auto-apply and the indicator |
| `src/background.js` | Service worker relaying the keyboard shortcuts |
| `src/popup.html` / `.css` / `.js` | Settings popup |
| `assets/icon.svg` | Vector master for the extension icon |
| `assets/make-icons.py` | Renders that master to `src/icons/` and the store icon |
| `assets/store-icon-128.png` | Listing icon: 96x96 of artwork on a 128x128 canvas |

Settings live in `chrome.storage.sync` under `selectedSpeed` and `autoApply`,
so they follow the user to their other machines; sync needs no permission
beyond the `storage` one local already required. Its write quota does mean
writes are debounced, since stepping with the keyboard would otherwise write
on every keypress. Settings saved by version 1.1 and earlier are moved out of
local storage once, when the extension updates.

Stepping writes back to `selectedSpeed`, so the speed the button toggles to is
always the last one used.
The popup saves every change straight away, and the content script picks it up
immediately — no page reload needed.

## Keyboard shortcuts

There are two separate paths, because the browser one cannot be relied on.

**On a YouTube page**, the content script handles plain `Alt` itself: `A`
toggles, `S` opens the popup, and `,` `.` or the arrow keys step by 0.25x.
Nothing has to be reserved for this to work, it suppresses the default so
`Alt`+`Down` no longer scrolls the page, and it stays out of the way while the
caret is in a search or comment box. Keys are matched on `event.code`: with
`Alt` held, macOS reports `event.key` as the character the combination would
type, so `Alt`+`S` arrives as `ß`. Opening the popup goes through the service
worker, since a page cannot open it directly.

The two sets are split on `Shift` deliberately. Plain `Alt` is the page's,
`Alt+Shift` is the browser's. Without that split a single `Alt+Shift+S` would
open the popup through the browser and toggle the speed in the page at once.

**Anywhere in the browser**, `chrome.commands` provides the same actions on
`Alt+Shift+S`, `Alt+Shift+A`, `Alt+Shift+.` and `Alt+Shift+,`, which is what
reaches a YouTube tab that is not focused. These only work if the browser
agreed to reserve them, which is not a given: Chromium forks such as Arc take
many combinations for their own interface, and one the browser declines is
left unassigned in silence. The popup does not list them, since the page
shortcuts always work and listing both said the same thing twice; it links to
`chrome://extensions/shortcuts` instead.

Suggested shortcuts are applied when an extension is **installed**, not when
it is reloaded, so editing them here does nothing to a copy already loaded;
remove it and load it again, or assign them by hand at
`chrome://extensions/shortcuts`.

## Permissions

- `storage` — remembers your chosen speed.
- `*://*.youtube.com/*` — the extension only runs on YouTube.

Nothing is collected or transmitted. See [PRIVACY.md](PRIVACY.md), published
at <https://maks-kyrychok.github.io/speed-play/PRIVACY.html>.

## History

Versions before 1.0.0 were built with Flutter Web. The popup was rewritten in
plain HTML/CSS/JS, which dropped the packaged extension from ~34 MB to under 20 KB
and made it open instantly. The Flutter implementation is still in the git
history at the initial commit.

## Icon

The icon is original artwork for this project, covered by the same licence as
the code. `assets/icon.svg` is the master; `python3 assets/make-icons.py`
renders the three PNG sizes the manifest declares plus the store listing icon,
with no image libraries needed. The listing icon is padded to 96x96 of artwork
inside a 128x128 canvas, which is what the store expects; the icons the
manifest declares fill their canvas instead. It carries the same double chevron as the in-player button and the
same red as the popup, so the extension reads as one thing wherever it shows
up. `make-icons.py` keeps an indigo alternative next to the red, since a red
tile with white arrows sits close to YouTube's own look.

## License

MIT — see [LICENSE](LICENSE). This covers the icon as well.
