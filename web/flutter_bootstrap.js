// Ховаємо Service Worker від Flutter
if (window.navigator && window.navigator.serviceWorker) {
    Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true
    });
}

{{flutter_js}}
{{flutter_build_config}}

_flutter.loader.load({
  config: {
    // Примушуємо Flutter брати графічний рушій з локальної папки розширення
    canvasKitBaseUrl: "canvaskit/"
  }
});