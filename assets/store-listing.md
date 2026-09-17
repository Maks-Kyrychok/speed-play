# Chrome Web Store submission

What was entered on the Privacy practices tab, kept here so an update does not
mean writing it again. Everything below describes version 1.0.0.

## Single purpose

SpeedyPlay changes the playback speed of YouTube videos. It adds a speed
toggle button to the YouTube player and, if the user turns that on, applies a
chosen speed to new videos automatically. It does nothing else.

## Permission: storage

Two settings are saved: the playback speed chosen in the popup, and whether
that speed should be applied to new videos automatically. They are written to
chrome.storage.local so the choice survives between browsing sessions, and so
the content script can read the current setting instead of asking again on
every page. Nothing else is stored, the values never leave the user's own
device, and they are removed when the extension is uninstalled.

## Host permission: *://www.youtube.com/*

The extension sets the playbackRate of the video element and inserts a speed
button into the player controls, on both watch pages and Shorts. Both require
a content script running in the YouTube page itself, so access to the page is
what makes the extension work at all. The match pattern is limited to
www.youtube.com; the extension has no access to any other site, and does not
read page content, browsing history or anything the user watches.

## Remote code

No remote code is used. Every line of JavaScript and CSS the extension runs is
contained in the uploaded package. There are no external or CDN-hosted
scripts, no eval or new Function calls, and the extension makes no network
requests of any kind.

## Data use

No user data is collected or transmitted. None of the disclosure categories
apply.
