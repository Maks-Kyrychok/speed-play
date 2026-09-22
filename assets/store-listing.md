# Chrome Web Store submission

What was entered on the Privacy practices tab, kept here so an update does not
mean writing it again. Everything below describes version 1.3.0.

## Single purpose

SpeedyPlay changes the playback speed of YouTube videos. It adds a speed
toggle button to the YouTube player and, if the user turns that on, applies a
chosen speed to new videos automatically. It does nothing else.

## Permission: storage

The playback speed the user chose, and whether it should be applied
automatically, kept separately for ordinary videos, for Shorts and for
YouTube Music. They are written to chrome.storage.sync so the choice survives
between browsing sessions and follows the user to their other machines, and so
the content script can read the current setting instead of asking again on
every page. Nothing else is stored, no browsing activity is recorded, and the
settings are removed when the extension is uninstalled.

## Host permission: *://www.youtube.com/*

The extension sets the playbackRate of the video element and inserts a speed
button into the player controls, on both watch pages and Shorts. Both require
a content script running in the YouTube page itself, so access to the page is
what makes the extension work at all. The match pattern is limited to
www.youtube.com; the extension has no access to any other site, and does not
read page content, browsing history or anything the user watches.

## Optional host permission: *://music.youtube.com/*

The same thing on YouTube Music, for users who want their speed to carry over
there. It is optional rather than required because a permission added
outright disables the extension for every existing user until each of them
re-accepts it. It is requested from a button in the popup, only when the user
asks for Music support, and the extension does nothing on that site until it
is granted.

## Remote code

No remote code is used. Every line of JavaScript and CSS the extension runs is
contained in the uploaded package. There are no external or CDN-hosted
scripts, no eval or new Function calls, and the extension makes no network
requests of any kind.

## Data use

No user data is collected or transmitted. None of the disclosure categories
apply.
