import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/home_page.dart';
import 'package:shiftly_employee/src/login_page.dart';

class ShiftlyApp extends StatefulWidget {
  const ShiftlyApp({super.key, required this.supabaseConfigured});
  final bool supabaseConfigured;

  @override
  State<ShiftlyApp> createState() => _ShiftlyAppState();
}

class _ShiftlyAppState extends State<ShiftlyApp> {
  Locale _locale = const Locale('en');
  StreamSubscription<AuthState>? _authSubscription;

  @override
  void initState() {
    super.initState();
    if (widget.supabaseConfigured) {
      _authSubscription = Supabase.instance.client.auth.onAuthStateChange.listen((_) => setState(() {}));
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  void toggleLocale() => setState(() => _locale = _locale.languageCode == 'en' ? const Locale('ar') : const Locale('en'));

  @override
  Widget build(BuildContext context) {
    final signedIn = widget.supabaseConfigured && Supabase.instance.client.auth.currentUser != null;
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Shiftly HR',
      locale: _locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      theme: ThemeData(colorSchemeSeed: const Color(0xFF2357D9), useMaterial3: true, scaffoldBackgroundColor: const Color(0xFFF4F7FB)),
      home: widget.supabaseConfigured && !signedIn
          ? LoginPage(locale: _locale, onToggleLocale: toggleLocale)
          : HomePage(locale: _locale, onToggleLocale: toggleLocale, demoMode: !widget.supabaseConfigured),
    );
  }
}
