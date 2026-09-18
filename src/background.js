// Relays keyboard shortcuts to the content script in the active tab.
// Content scripts cannot receive chrome.commands events themselves.

const COMMANDS = new Set(["toggle-speed", "speed-up", "speed-down"]);

chrome.commands.onCommand.addListener(async (command) => {
  if (!COMMANDS.has(command)) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: command });
  } catch {
    // Not a YouTube tab, so no content script is listening. Nothing to do.
  }
});
