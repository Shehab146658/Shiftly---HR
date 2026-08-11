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
      _authSubscription = Supabase.instance.client.auth.onAuthStateChange
          .listen((_) => setState(() {}));
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  void toggleLocale() => setState(
    () => _locale = _locale.languageCode == 'en'
        ? const Locale('ar')
        : const Locale('en'),
  );

  @override
  Widget build(BuildContext context) {
    final signedIn =
        widget.supabaseConfigured &&
        Supabase.instance.client.auth.currentUser != null;
    const primary = Color(0xFF315BEA);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Shiftly HR',
      locale: _locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          surface: const Color(0xFFF7F8FC),
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F8FC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF7F8FC),
          foregroundColor: Color(0xFF15213D),
          elevation: 0,
          surfaceTintColor: Colors.transparent,
        ),
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(20)),
            side: BorderSide(color: Color(0xFFE5E9F2)),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(14)),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ),
      home: widget.supabaseConfigured && !signedIn
          ? LoginPage(locale: _locale, onToggleLocale: toggleLocale)
          : HomePage(
              locale: _locale,
              onToggleLocale: toggleLocale,
              demoMode: !widget.supabaseConfigured,
            ),
    );
  }
}
