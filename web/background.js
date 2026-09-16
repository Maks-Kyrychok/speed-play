chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: () => {
            document.querySelector('video').playbackRate = 2.0;
        }
    });
});
