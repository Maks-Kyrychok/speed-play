// Relays the keyboard shortcut to the content script in the active tab.
// Content scripts cannot receive chrome.commands events directly.

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-speed") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle-speed" });
  } catch {
    // No content script in this tab (not a YouTube page) — nothing to do.
  }
});
