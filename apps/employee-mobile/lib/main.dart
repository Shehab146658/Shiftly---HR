import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  final configured = url.isNotEmpty && key.isNotEmpty;

  if (configured) {
    await Supabase.initialize(url: url, publishableKey: key);
  }

  runApp(ShiftlyApp(supabaseConfigured: configured));
}
