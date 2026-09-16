import 'dart:js_interop';

// Оголошуємо зовнішні JS-функції за допомогою анотації @JS
@JS('saveSpeedToChrome')
external JSPromise _saveSpeedToChrome(JSNumber speed);

@JS('getSpeedFromChrome')
external JSPromise _getSpeedFromChrome();

class SettingsRepo {
  static Future<void> saveSpeed(double speed) async {
    // .toJS конвертує Dart-число у зрозумілий для JS формат
    // .toDart конвертує JS Promise у звичайний Dart Future
    await _saveSpeedToChrome(speed.toJS).toDart;
  }

  static Future<double> getSpeed() async {
    // Отримуємо результат з JS
    final jsResult = await _getSpeedFromChrome().toDart;

    // Конвертуємо JS-число назад у Dart-формат
    return (jsResult as JSNumber).toDartDouble;
  }
}