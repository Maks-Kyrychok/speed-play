import 'package:flutter/material.dart';
import '../core/constants/app_strings.dart';
import '../data/settings_repo.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  double _selectedSpeed = 2.0;

  final List<double> _speedOptions = [1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    // Читаємо збережене значення при відкритті попапу
    final savedSpeed = await SettingsRepo.getSpeed();
    setState(() {
      _selectedSpeed = savedSpeed;
    });
  }

  Future<void> _saveSettings() async {
    // Зберігаємо нове значення в Chrome
    await SettingsRepo.saveSpeed(_selectedSpeed);

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Settings Saved!'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Визначаємо поточну тему для застосування правильних кольорів YT
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Кольорова палітра YouTube
    final bgColor = isDark ? const Color(0xFF0F0F0F) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;
    final elementColor = isDark ? const Color(0xFF272727) : const Color(0xFFF2F2F2);
    const ytRed = Color(0xFFFF0000);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        backgroundColor: bgColor,
        elevation: 0,
        title: const Text(
          AppStrings.settingsTitle,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1.0),
          child: Container(
            color: isDark ? Colors.white12 : Colors.black12,
            height: 1.0,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppStrings.speedLabel,
              style: TextStyle(
                color: textColor,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8.0,
              runSpacing: 8.0,
              children: _speedOptions.map((speed) {
                final isSelected = _selectedSpeed == speed;
                return ChoiceChip(
                  label: Text('${speed}x'),
                  selected: isSelected,
                  selectedColor: ytRed,
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : textColor,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                  backgroundColor: elementColor,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(
                      color: isSelected ? ytRed : Colors.transparent,
                    ),
                  ),
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _selectedSpeed = speed;
                      });
                    }
                  },
                );
              }).toList(),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: ytRed,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18), // Закруглені кнопки в стилі нового YT
                  ),
                ),
                onPressed: _saveSettings,
                child: const Text(
                  AppStrings.saveButton,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}