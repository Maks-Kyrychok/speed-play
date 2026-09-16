// Default speed fallback if nothing is saved yet
let targetSpeed = 2.0;

// Read the saved speed from Chrome Storage immediately
chrome.storage.local.get(['selectedSpeed'], (result) => {
    if (result.selectedSpeed) {
        targetSpeed = result.selectedSpeed;
    }
});

// Listen for settings changes from the Flutter popup
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.selectedSpeed) {
        targetSpeed = changes.selectedSpeed.newValue;
        console.log(`[SpeedyPlay] Target speed updated to: ${targetSpeed}x`);
    }
});

function addSpeedButton() {
    let controls = document.querySelector(".ytp-right-controls");
    if (!controls) return;

    if (document.getElementById("speedyplay-button")) return;

    let button = document.createElement("button");
    button.id = "speedyplay-button";
    button.className = "ytp-button";
    button.title = "Toggle Speed (SpeedyPlay)";

    // Використовуємо Flexbox, щоб іконка стала рівно по центру,
    // а розмір обведення (hover) ідеально збігався з сусідніми кнопками YouTube
    button.style.cssText = "display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 100%; padding: 0; vertical-align: top;";

    // Математично відцентровані координати (viewBox 36x36)
    button.innerHTML = `
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%" style="pointer-events: none;">
            <path class="ytp-svg-fill" d="M 11 24 L 19 18 L 11 12 Z M 19 24 L 27 18 L 19 12 Z"></path>
        </svg>
    `;

    button.addEventListener("click", function () {
        let video = document.querySelector("video");
        if (video) {
            video.playbackRate = (video.playbackRate === targetSpeed) ? 1.0 : targetSpeed;
            console.log(`[SpeedyPlay] Speed toggled to: ${video.playbackRate}x`);
        }
    });

    controls.prepend(button);
}

// Observe DOM changes to inject the button even when navigating between videos without a full page reload
const observer = new MutationObserver(() => {
    if (document.querySelector(".ytp-right-controls")) {
        addSpeedButton();
    }
});

// Start observing the entire body for changes
observer.observe(document.body, { childList: true, subtree: true });