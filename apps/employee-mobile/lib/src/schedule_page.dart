import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/localization.dart';

({DateTime earliestStart, DateTime latestStart}) currentScheduleWindow(DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  return (earliestStart: today.subtract(const Duration(days: 6)), latestStart: today);
}

String scheduleIsoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

class SchedulePage extends StatefulWidget {
  const SchedulePage({super.key, required this.locale, required this.demoMode});

  final Locale locale;
  final bool demoMode;

  @override
  State<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends State<SchedulePage> {
  late Future<List<Map<String, dynamic>>> _entries;

  @override
  void initState() {
    super.initState();
    _entries = _loadSchedule();
  }

  Future<List<Map<String, dynamic>>> _loadSchedule() async {
    if (widget.demoMode) return const [];
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const [];

    final employee = await client
        .from('employees')
        .select('id, tenant_id')
        .eq('user_id', userId)
        .neq('status', 'terminated')
        .maybeSingle();
    if (employee == null) return const [];

    final window = currentScheduleWindow(DateTime.now());
    final schedules = await client
        .from('weekly_schedules')
        .select('id')
        .eq('tenant_id', employee['tenant_id'])
        .gte('week_start', scheduleIsoDate(window.earliestStart))
        .lte('week_start', scheduleIsoDate(window.latestStart))
        .inFilter('status', const ['published', 'locked']);
    final scheduleIds = (schedules as List).map((row) => row['id'] as String).toList();
    if (scheduleIds.isEmpty) return const [];

    final rows = await client
        .from('schedule_entries')
        .select('id, work_date, segment_no, entry_type, custom_start_time, custom_end_time, end_day_offset, notes, shift_templates(name_en, name_ar, start_time, end_time, end_day_offset), branch:branches!schedule_entries_scheduled_branch_id_fkey(name_en, name_ar)')
        .eq('employee_id', employee['id'])
        .inFilter('schedule_id', scheduleIds)
        .gte('work_date', scheduleIsoDate(window.earliestStart))
        .lte('work_date', scheduleIsoDate(window.latestStart.add(const Duration(days: 6))))
        .order('work_date')
        .order('segment_no');
    return (rows as List).map((row) => Map<String, dynamic>.from(row as Map)).toList();
  }

  String _time(dynamic value) {
    final text = value?.toString() ?? '';
    return text.length >= 5 ? text.substring(0, 5) : text;
  }

  String _entryLabel(Map<String, dynamic> row, AppStrings s) {
    final type = row['entry_type'] as String? ?? 'shift';
    if (type != 'shift') return s.t(type);
    final template = row['shift_templates'] as Map<String, dynamic>?;
    final start = template?['start_time'] ?? row['custom_start_time'];
    final end = template?['end_time'] ?? row['custom_end_time'];
    final nextDay = (template?['end_day_offset'] ?? row['end_day_offset'] ?? 0) == 1;
    final templateName = widget.locale.languageCode == 'ar'
        ? (template?['name_ar'] ?? template?['name_en'])
        : template?['name_en'];
    final timeRange = '${_time(start)} – ${_time(end)}${nextDay ? ' +1' : ''}';
    return templateName == null ? timeRange : '$templateName · $timeRange';
  }

  @override
  Widget build(BuildContext context) {
    final s = AppStrings(widget.locale);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('schedule'))),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _entries,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('${s.t('scheduleError')}\n${snapshot.error}', textAlign: TextAlign.center)));
          }
          final entries = snapshot.data ?? const [];
          if (entries.isEmpty) {
            return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(widget.demoMode ? s.t('demoSchedule') : s.t('noSchedule'), textAlign: TextAlign.center)));
          }
          return RefreshIndicator(
            onRefresh: () async {
              final next = _loadSchedule();
              setState(() => _entries = next);
              await next;
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: entries.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final row = entries[index];
                final branch = row['branch'] as Map<String, dynamic>?;
                final branchName = widget.locale.languageCode == 'ar'
                    ? (branch?['name_ar'] ?? branch?['name_en'])
                    : branch?['name_en'];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    leading: CircleAvatar(child: Text((row['work_date'] as String).substring(8, 10))),
                    title: Text(_entryLabel(row, s), style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text([row['work_date'], if (branchName != null) branchName, if (row['notes'] != null) row['notes']].join(' · ')),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
