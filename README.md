# SpeedyPlay

A small Chrome extension that changes YouTube playback speed without digging
through the player's settings menu. Desktop only.

## What it does

- Adds a speed button to the player controls, beside the built-in ones. A
  click flips between normal speed and your speed; while the video is sped up
  the button shows the rate in place of its icon.
- A right-click on that button opens a speed menu in the player, so choosing a
  particular speed never means reaching for the toolbar.
- Works on Shorts, where the button joins the like/comment/share column and is
  built from the same markup as its neighbours, with the speed underneath the
  way their counts are.
- Works on YouTube Music, where the button goes on the player bar. Music has a
  speed control of its own, but it sits two clicks deep inside the overflow
  menu; this one is on the bar.
- Keeps a separate speed for videos, for Shorts and for YouTube Music, with
  its own switch for applying automatically. A lecture at 2×, Shorts at
  whatever suits them, and music left alone is one setup, not a compromise.
- Applies that speed to each new video automatically. On by default for videos
  and Shorts, off for music, and changeable per context in the popup.
- Announces every speed change over the video. In fullscreen this is the only
  feedback there is, since the controls are hidden.
- Leaves ads at normal speed.
- Leaves a speed you chose by hand alone. Auto-apply only steps in at 1×, and
  changing speed yourself stops it re-applying.
- Holds the speed through player startup. YouTube restores its own remembered
  rate a moment after a page loads, so the speed is re-applied for a few
  seconds and then left alone.

The popup shows the speed of the video in the tab you are on, and a speed
picked there takes effect at once rather than waiting for the next toggle.

## Speeds

Eight are one click away: 0.5×, 0.75×, 1.25×, 1.5×, 1.75×, 2×, 2.5× and 3×.
Anything from 0.25× to 4× can be typed into the popup or reached by stepping.
The limits are practical ones: below 0.25× speech is unintelligible, and above
4× the browser stops rendering audio.

## Where it runs

`www.youtube.com` always, and `music.youtube.com` once you turn it on.

Music is an **optional permission**, asked for from a button in the popup. A
permission added to the manifest outright disables an extension for everyone
who already has it until each of them re-accepts it, and that is too much to
charge existing users for a feature they may not want. Granting it takes one
click, and pages open at the time need a reload before the script reaches
them.

Not the mobile site, and not YouTube embedded on other sites.

## Keyboard shortcuts

Two separate paths, because the browser one cannot be relied on.

**On a YouTube page** the content script handles plain `Alt` itself:

| | |
| --- | --- |
| `Alt`+`A` | toggle |
| `Alt`+`S` | open the popup |
| `Alt`+`.` or `Alt`+`↑` | 0.25× faster |
| `Alt`+`,` or `Alt`+`↓` | 0.25× slower |

Nothing has to be reserved for these, so they work in any Chromium browser.
They suppress the default, so `Alt`+`↓` no longer scrolls the page, and they
stand aside while the caret is in a search field or a comment box.

**Anywhere in the browser** `chrome.commands` offers the same actions on
`Alt+Shift+S`, `Alt+Shift+A`, `Alt+Shift+.` and `Alt+Shift+,`. These reach a
YouTube tab that is not focused, but only if the browser agreed to reserve
them, which is not a given — Chromium forks such as Arc take many
combinations for their own interface, and one the browser declines is left
unassigned in silence. Remap them at `chrome://extensions/shortcuts`.

The two sets are split on `Shift` deliberately: plain `Alt` belongs to the
page, `Alt+Shift` to the browser. Without that split one `Alt+Shift+S` would
open the popup through the browser and toggle the speed in the page at once.

`Alt`+`S` asks the service worker to open the popup, since a page cannot open
it itself. Not every browser allows that, and some resolve the call without
showing anything, so the worker checks whether a popup context actually
appeared rather than trusting the answer; when none did, the page says to use
the toolbar icon instead.

Two things worth knowing if a shortcut appears dead:

- Suggested shortcuts are assigned when an extension is **installed**, not
  when it is reloaded. Remove it and load it again, or assign them by hand.
- Keys are matched on `event.code`, not `event.key`, because with `Alt` held
  macOS reports the character the combination would type: `Alt`+`S` arrives
  as `ß`.

## Install from source

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `src/` folder.

There is no build step. `src/` is the extension.

## Packaging for the Chrome Web Store

The manifest has to sit at the root of the archive:

```sh
cd src && zip -r ../speedyplay.zip . -x '.*' '__MACOSX/*' && cd ..
```

Raise `version` in the manifest first; the store rejects an archive whose
version is not higher than the published one.

## Layout

| File | Purpose |
| --- | --- |
| `src/manifest.json` | Extension manifest (MV3) |
| `src/speed.js` | Validating, clamping and formatting a speed |
| `src/settings.js` | Synced storage with debounced writes |
| `src/content.js` | Context detection, buttons, menu, shortcuts, indicator |
| `src/background.js` | Service worker: relays shortcuts, opens the popup, migrates settings |
| `src/popup.html` / `.css` / `.js` | Settings popup |
| `assets/icon.svg` | Vector master for the icon |
| `assets/make-icons.py` | Renders it to `src/icons/` and to the store icon |
| `assets/store-listing.md` | What was submitted on the store's privacy tab |

`speed.js` and `settings.js` are loaded by both the popup and the content
script, so the two can never disagree about what a valid speed is or where
settings live.

Each surface builds its button from the markup of the native controls beside
it, reading their class names off a live sibling rather than hardcoding them,
so the buttons keep matching when YouTube renames things. Where none of the
expected containers is found, no button is injected; auto-apply, the shortcuts
and the popup do not depend on it.

YouTube Music carries a desktop player bar and a mobile one in the page at
once, and its right-hand controls collapse into an overflow menu as the window
narrows, so the host is chosen by which candidate actually occupies space.

## Settings

A speed and an auto-apply switch per context, under `contexts` in
`chrome.storage.sync`, so they follow you to your other machines. Sync needs
no permission beyond the `storage` one that local storage already required.

Sync imposes a write quota, so writes are debounced into at most one a second;
holding a stepping shortcut would otherwise write on every keypress.

Settings have moved twice and both steps are carried across on update: out of
local storage into sync, and from one speed for everything to one per context.
The single speed becomes the video context, since that is what it described;
Shorts and Music start from their own defaults.

Stepping writes back to the speed of the context it happened in, so the speed
the button toggles to is always the last one used there — except 1×, which is
never stored, as it would leave the toggle with nothing to toggle to.

## Permissions

- `storage` — remembers your speeds and whether to apply them automatically.
- `*://www.youtube.com/*` — where the extension runs.
- `*://music.youtube.com/*` — optional, asked for only if you enable Music.

Nothing is collected or transmitted, and the extension makes no network
requests at all. See [PRIVACY.md](PRIVACY.md), published at
<https://maks-kyrychok.github.io/speed-play/PRIVACY.html>.

## Icon

Original artwork for this project, covered by the same licence as the code. It
carries the same double chevron as the in-player button and the same red as
the popup, so the extension reads as one thing wherever it appears.

`assets/icon.svg` is the master and `python3 assets/make-icons.py` renders
every raster size, using only the standard library. The store listing icon is
padded to 96×96 of artwork inside a 128×128 canvas, which is what the store
expects; the icons the manifest declares fill their canvas instead.
`make-icons.py` keeps an indigo alternative beside the red, since a red tile
with white arrows sits close to YouTube's own look.

## History

Version 1.0.0 and everything before it was a Flutter Web app. Rewriting the
popup in plain HTML, CSS and JavaScript took the packaged extension from about
34 MB to under 20 KB and made it open instantly. The Flutter implementation is
still in the git history, at the first commit.

## License

MIT — see [LICENSE](LICENSE). This covers the icon as well.
