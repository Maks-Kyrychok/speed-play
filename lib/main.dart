import 'package:flutter/material.dart';
import 'core/constants/app_strings.dart';
import 'presentation/settings_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName,
      theme: ThemeData.light(),
      darkTheme: ThemeData.dark(),
      themeMode: ThemeMode.system,
      // ТИМЧАСОВИЙ КОД ДЛЯ ПРЕВ'Ю ПОПАПУ
      home: Scaffold(
        backgroundColor: Colors.grey[900], // Темне тло браузера навколо
        body: const Center(
          child: SizedBox(
            width: 350, // Стандартна ширина попапу
            height: 450, // Стандартна висота попапу
            // Тут додаємо тінь і заокруглення, щоб виглядало як реальне вікно
            child: ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(12)),
              child: SettingsPage(),
            ),
          ),
        ),
      ),
      debugShowCheckedModeBanner: false,
    );
  }
}