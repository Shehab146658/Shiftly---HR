import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/employee_context.dart';
import 'package:shiftly_employee/src/mobile_ui.dart';

enum EmployeeModule { requests, payslips, tasks, announcements }

class EmployeeModulePage extends StatefulWidget {
  const EmployeeModulePage({
    super.key,
    required this.locale,
    required this.demoMode,
    required this.module,
  });
  final Locale locale;
  final bool demoMode;
  final EmployeeModule module;

  @override
  State<EmployeeModulePage> createState() => _EmployeeModulePageState();
}

class _EmployeeModulePageState extends State<EmployeeModulePage> {
  late Future<List<Map<String, dynamic>>> _items;
  String? _busyId;
  bool get _ar => widget.locale.languageCode == 'ar';

  @override
  void initState() {
    super.initState();
    _items = _load();
  }

  String get _title => switch (widget.module) {
    EmployeeModule.requests => _ar ? 'طلباتي' : 'My requests',
    EmployeeModule.payslips => _ar ? 'قسائم الراتب' : 'Payslips',
    EmployeeModule.tasks => _ar ? 'مهامي' : 'My tasks',
    EmployeeModule.announcements => _ar ? 'الإعلانات' : 'Announcements',
  };

  IconData get _icon => switch (widget.module) {
    EmployeeModule.requests => Icons.assignment_outlined,
    EmployeeModule.payslips => Icons.receipt_long_outlined,
    EmployeeModule.tasks => Icons.task_alt_outlined,
    EmployeeModule.announcements => Icons.campaign_outlined,
  };

  Future<List<Map<String, dynamic>>> _load() async {
    if (widget.demoMode) return const [];
    final client = Supabase.instance.client;
    final user = client.auth.currentUser;
    if (user == null) return const [];
    final employee = widget.module == EmployeeModule.announcements
        ? null
        : await EmployeeContext.load();
    if (widget.module != EmployeeModule.announcements && employee == null) {
      return const [];
    }
    final dynamic rows = switch (widget.module) {
      EmployeeModule.requests =>
        await client
            .from('hr_requests')
            .select(
              'id, title, reason, start_date, end_date, status, submitted_at, request_type:request_types!hr_requests_request_type_id_fkey(name_en, name_ar)',
            )
            .eq('employee_id', employee!.id)
            .order('submitted_at', ascending: false)
            .limit(50),
      EmployeeModule.payslips =>
        await client
            .from('payslips')
            .select(
              'id, payslip_number, published_at, acknowledged_at, result:payroll_employee_results!payslips_result_id_fkey(gross_amount, deductions_amount, net_amount, currency_code), period:payroll_periods!payslips_period_id_fkey(name, period_start, period_end)',
            )
            .eq('employee_id', employee!.id)
            .order('published_at', ascending: false)
            .limit(36),
      EmployeeModule.tasks =>
        await client
            .from('task_assignments')
            .select(
              'id, status, assigned_at, started_at, submitted_at, review_note, task:tasks!task_assignments_task_id_fkey(title_en, title_ar, description_en, description_ar, priority, start_at, due_at, require_evidence)',
            )
            .eq('employee_id', employee!.id)
            .order('assigned_at', ascending: false)
            .limit(60),
      EmployeeModule.announcements =>
        await client
            .from('announcement_recipients')
            .select(
              'id, announcement_id, delivered_at, read_at, acknowledged_at, announcement:announcements!announcement_recipients_announcement_id_fkey(title_en, title_ar, body_en, body_ar, priority, is_pinned, requires_acknowledgement, published_at, expires_at)',
            )
            .eq('user_id', user.id)
            .order('delivered_at', ascending: false)
            .limit(50),
    };
    return (rows as List)
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _items = next);
    await next;
  }

  Future<void> _action(
    String id,
    Future<void> Function() action,
    String success,
  ) async {
    if (_busyId != null) return;
    setState(() => _busyId = id);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(behavior: SnackBarBehavior.floating, content: Text(success)),
      );
      setState(() => _items = _load());
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: Theme.of(context).colorScheme.error,
          content: Text(
            _ar
                ? 'تعذر حفظ التغيير. حاول مرة أخرى.'
                : 'The change could not be saved. Please try again.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  String _date(Object? value) {
    final text = value?.toString() ?? '';
    return text.length >= 10 ? text.substring(0, 10) : text;
  }

  Widget _request(Map<String, dynamic> item) {
    final type = item['request_type'] as Map<String, dynamic>?;
    final name = _ar
        ? (type?['name_ar'] ?? type?['name_en'])
        : type?['name_en'];
    return _recordCard(
      icon: Icons.assignment_outlined,
      title: (item['title'] ?? name ?? (_ar ? 'طلب موظف' : 'Employee request'))
          .toString(),
      subtitle: [
        name,
        _date(item['start_date']),
        item['end_date'] == null ? null : _date(item['end_date']),
      ].whereType<Object>().join(' · '),
      body: item['reason']?.toString(),
      trailing: StatusPill(item['status']?.toString() ?? 'submitted'),
    );
  }

  Widget _payslip(Map<String, dynamic> item) {
    final result = item['result'] as Map<String, dynamic>? ?? const {};
    final period = item['period'] as Map<String, dynamic>? ?? const {};
    final currency = result['currency_code'] ?? 'EGP';
    final acknowledged = item['acknowledged_at'] != null;
    return _recordCard(
      icon: Icons.receipt_long_outlined,
      title:
          period['name']?.toString() ??
          item['payslip_number']?.toString() ??
          (_ar ? 'قسيمة راتب' : 'Payslip'),
      subtitle:
          '${_date(period['period_start'])} → ${_date(period['period_end'])}',
      body:
          '${_ar ? 'صافي الراتب' : 'Net pay'}  $currency ${result['net_amount'] ?? '0.00'}',
      trailing: acknowledged
          ? const StatusPill('approved')
          : TextButton(
              onPressed: _busyId == item['id']
                  ? null
                  : () => _action(
                      item['id'] as String,
                      () async => Supabase.instance.client.rpc(
                        'acknowledge_payslip',
                        params: {'p_payslip_id': item['id']},
                      ),
                      _ar
                          ? 'تم تأكيد استلام القسيمة.'
                          : 'Payslip receipt confirmed.',
                    ),
              child: Text(_ar ? 'تأكيد' : 'Acknowledge'),
            ),
    );
  }

  Widget _task(Map<String, dynamic> item) {
    final task = item['task'] as Map<String, dynamic>? ?? const {};
    final title = _ar
        ? (task['title_ar'] ?? task['title_en'])
        : task['title_en'];
    final description = _ar
        ? (task['description_ar'] ?? task['description_en'])
        : task['description_en'];
    final status = item['status']?.toString() ?? 'assigned';
    Widget trailing = StatusPill(status);
    if (status == 'assigned' || status == 'rejected') {
      trailing = TextButton(
        onPressed: _busyId == item['id']
            ? null
            : () => _action(
                item['id'] as String,
                () async => Supabase.instance.client.rpc(
                  'start_task_assignment',
                  params: {'p_assignment_id': item['id']},
                ),
                _ar ? 'تم بدء المهمة.' : 'Task started.',
              ),
        child: Text(_ar ? 'ابدأ' : 'Start'),
      );
    }
    return _recordCard(
      icon: Icons.task_alt_outlined,
      title: title?.toString() ?? (_ar ? 'مهمة' : 'Task'),
      subtitle:
          '${_ar ? 'الاستحقاق' : 'Due'} ${_date(task['due_at'])} · ${task['priority'] ?? 'normal'}',
      body: description?.toString(),
      trailing: trailing,
    );
  }

  Widget _announcement(Map<String, dynamic> item) {
    final announcement =
        item['announcement'] as Map<String, dynamic>? ?? const {};
    final title = _ar
        ? (announcement['title_ar'] ?? announcement['title_en'])
        : announcement['title_en'];
    final body = _ar
        ? (announcement['body_ar'] ?? announcement['body_en'])
        : announcement['body_en'];
    final read = item['read_at'] != null;
    final requiresAck = announcement['requires_acknowledgement'] == true;
    final acknowledged = item['acknowledged_at'] != null;
    final buttonLabel = requiresAck && !acknowledged
        ? (_ar ? 'قرأت وأؤكد' : 'Read & acknowledge')
        : !read
        ? (_ar ? 'تحديد كمقروء' : 'Mark read')
        : null;
    return _recordCard(
      icon: announcement['is_pinned'] == true
          ? Icons.push_pin_rounded
          : Icons.campaign_outlined,
      title: title?.toString() ?? (_ar ? 'إعلان' : 'Announcement'),
      subtitle:
          '${announcement['priority'] ?? 'normal'} · ${_date(announcement['published_at'])}',
      body: body?.toString(),
      trailing: buttonLabel == null
          ? const StatusPill('published')
          : TextButton(
              onPressed: _busyId == item['id']
                  ? null
                  : () => _action(
                      item['id'] as String,
                      () async => Supabase.instance.client.rpc(
                        'mark_announcement_read',
                        params: {
                          'p_announcement_id': item['announcement_id'],
                          'p_acknowledge': requiresAck,
                        },
                      ),
                      _ar
                          ? 'تم تحديث حالة الإعلان.'
                          : 'Announcement status updated.',
                    ),
              child: Text(buttonLabel),
            ),
    );
  }

  Widget _recordCard({
    required IconData icon,
    required String title,
    required String subtitle,
    String? body,
    required Widget trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF0FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: const Color(0xFF315BEA), size: 22),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: Color(0xFF7A8497),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    if (body != null && body.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        body,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFF50617E),
                          height: 1.4,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: trailing,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_title)),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _items,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return PageMessage(
              icon: Icons.cloud_off_rounded,
              title: _ar
                  ? 'تعذر تحميل البيانات'
                  : 'Could not load this workspace',
              action: FilledButton(
                onPressed: _refresh,
                child: Text(_ar ? 'إعادة المحاولة' : 'Try again'),
              ),
            );
          }
          final items = snapshot.data ?? const [];
          if (items.isEmpty) {
            return PageMessage(
              icon: _icon,
              title: _ar ? 'لا توجد عناصر حتى الآن' : 'Nothing here yet',
              body: _ar
                  ? 'ستظهر العناصر الجديدة هنا تلقائياً.'
                  : 'New items will appear here automatically.',
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
              children: items
                  .map(
                    (item) => switch (widget.module) {
                      EmployeeModule.requests => _request(item),
                      EmployeeModule.payslips => _payslip(item),
                      EmployeeModule.tasks => _task(item),
                      EmployeeModule.announcements => _announcement(item),
                    },
                  )
                  .toList(),
            ),
          );
        },
      ),
    );
  }
}
