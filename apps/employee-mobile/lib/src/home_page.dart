import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/localization.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.locale, required this.onToggleLocale, required this.demoMode});
  final Locale locale;
  final VoidCallback onToggleLocale;
  final bool demoMode;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings(locale);
    final items = <(IconData, String)>[
      (Icons.calendar_month_outlined, s.t('schedule')),
      (Icons.fingerprint, s.t('attendance')),
      (Icons.assignment_outlined, s.t('requests')),
      (Icons.receipt_long_outlined, s.t('payslips')),
      (Icons.task_alt_outlined, s.t('tasks')),
      (Icons.campaign_outlined, s.t('announcements')),
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('app')),
        actions: [TextButton(onPressed: onToggleLocale, child: Text(s.t('language'))), if (!demoMode) IconButton(tooltip: s.t('signOut'), onPressed: () => Supabase.instance.client.auth.signOut(), icon: const Icon(Icons.logout))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(s.t('welcome'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)), const SizedBox(height: 8), Text(demoMode ? s.t('demo') : s.t('foundation'))]))),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.35),
            itemBuilder: (context, index) { final item = items[index]; return Card(child: InkWell(borderRadius: BorderRadius.circular(12), onTap: () {}, child: Padding(padding: const EdgeInsets.all(16), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(item.$1, size: 34, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 10), Text(item.$2, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.bold))])))); },
          ),
        ],
      ),
    );
  }
}
