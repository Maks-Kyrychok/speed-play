document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".speed-button").forEach(button => {
        button.addEventListener("click", function () {
            let speed = parseFloat(this.dataset.speed);
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    function: () => {
                        document.querySelector("video").playbackRate = speed;
                    }
                });
            });
        });
    });
});
