// Зберігаємо швидкість у пам'ять Chrome
async function saveSpeedToChrome(speed) {
    await chrome.storage.local.set({ selectedSpeed: speed });
}

// Читаємо швидкість (або повертаємо 2.0 за замовчуванням)
async function getSpeedFromChrome() {
    let result = await chrome.storage.local.get(['selectedSpeed']);
    return result.selectedSpeed || 2.0;
}

// Робимо функції глобально доступними для Flutter
window.saveSpeedToChrome = saveSpeedToChrome;
window.getSpeedFromChrome = getSpeedFromChrome;