# SpeedyPlay

A small Chrome extension that switches YouTube playback speed without digging
through the player's settings menu. Desktop YouTube only.

## What it does

- Adds a speed-toggle button to the YouTube player controls, next to the
  built-in ones. Clicking it flips between normal speed and your chosen speed;
  the icon turns red while the video is sped up.
- Works on Shorts too, where it joins the like/dislike/comment/share column as
  a matching round button with the current speed underneath.
- Applies your chosen speed automatically to every new video, if you want it to.
  This is on by default and can be turned off in the popup.
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
| `src/content.js` | Player button, Shorts button and auto-apply |
| `src/popup.html` / `.css` / `.js` | Settings popup |
| `assets/icon.svg` | Vector master for the extension icon |
| `assets/make-icons.py` | Renders that master to `src/icons/` |

Settings live in `chrome.storage.local` under `selectedSpeed` and `autoApply`.
The popup saves every change straight away, and the content script picks it up
immediately — no page reload needed.

## Permissions

- `storage` — remembers your chosen speed.
- `*://*.youtube.com/*` — the extension only runs on YouTube.

Nothing is collected or transmitted. See [PRIVACY.md](PRIVACY.md).

## History

Versions before 1.0.0 were built with Flutter Web. The popup was rewritten in
plain HTML/CSS/JS, which dropped the packaged extension from ~34 MB to under 20 KB
and made it open instantly. The Flutter implementation is still in the git
history at the initial commit.

## Icon

The icon is original artwork for this project, covered by the same licence as
the code. `assets/icon.svg` is the master; `python3 assets/make-icons.py`
renders the three PNG sizes the manifest declares, with no image libraries
needed. It carries the same double chevron as the in-player button and the
same red as the popup, so the extension reads as one thing wherever it shows
up. `make-icons.py` keeps an indigo alternative next to the red, since a red
tile with white arrows sits close to YouTube's own look.

## License

MIT — see [LICENSE](LICENSE). This covers the icon as well.
