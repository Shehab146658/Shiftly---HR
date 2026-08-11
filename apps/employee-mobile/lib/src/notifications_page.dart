import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/mobile_ui.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    required this.locale,
    required this.demoMode,
  });
  final Locale locale;
  final bool demoMode;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late Future<List<Map<String, dynamic>>> _items;
  bool _markingAll = false;
  bool get _ar => widget.locale.languageCode == 'ar';

  @override
  void initState() {
    super.initState();
    _items = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    if (widget.demoMode) return const [];
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return const [];
    final rows = await Supabase.instance.client
        .from('notifications')
        .select(
          'id, tenant_id, kind, title_en, title_ar, body_en, body_ar, href, read_at, created_at',
        )
        .eq('recipient_user_id', user.id)
        .order('created_at', ascending: false)
        .limit(50);
    return (rows as List)
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() => _items = next);
    await next;
  }

  Future<void> _markRead(Map<String, dynamic> item) async {
    if (widget.demoMode || item['read_at'] != null) return;
    await Supabase.instance.client.rpc(
      'mark_notification_read',
      params: {'p_notification_id': item['id']},
    );
    if (mounted) {
      setState(
        () => item['read_at'] = DateTime.now().toUtc().toIso8601String(),
      );
    }
  }

  Future<void> _markAll(List<Map<String, dynamic>> items) async {
    if (_markingAll || widget.demoMode) return;
    final unreadItems = items.where((item) => item['read_at'] == null).toList();
    final tenantId = unreadItems.isEmpty
        ? null
        : unreadItems.first['tenant_id'];
    if (tenantId == null) return;
    setState(() => _markingAll = true);
    try {
      await Supabase.instance.client.rpc(
        'mark_all_notifications_read',
        params: {'p_tenant_id': tenantId},
      );
      if (mounted) setState(() => _items = _load());
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  String _date(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return '';
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}  ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_ar ? 'الإشعارات' : 'Notifications')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _items,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return PageMessage(
              icon: Icons.notifications_off_outlined,
              title: _ar
                  ? 'تعذر تحميل الإشعارات'
                  : 'Notifications are unavailable',
              action: FilledButton(
                onPressed: _refresh,
                child: Text(_ar ? 'إعادة المحاولة' : 'Try again'),
              ),
            );
          }
          final items = snapshot.data ?? const [];
          final unread = items.where((item) => item['read_at'] == null).length;
          if (items.isEmpty) {
            return PageMessage(
              icon: Icons.notifications_none_rounded,
              title: _ar ? 'لا توجد إشعارات' : 'You are all caught up',
              body: _ar
                  ? 'ستظهر هنا الموافقات والمهام والإعلانات الجديدة.'
                  : 'Approvals, task updates, and announcements will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _ar ? '$unread غير مقروء' : '$unread unread',
                        style: const TextStyle(
                          color: Color(0xFF687386),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (unread > 0)
                      TextButton(
                        onPressed: _markingAll ? null : () => _markAll(items),
                        child: Text(
                          _markingAll
                              ? (_ar ? 'جاري التحديث…' : 'Updating…')
                              : (_ar ? 'تحديد الكل كمقروء' : 'Mark all read'),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                ...items.map((item) {
                  final unreadItem = item['read_at'] == null;
                  final title = _ar
                      ? (item['title_ar'] ?? item['title_en'])
                      : item['title_en'];
                  final body = _ar
                      ? (item['body_ar'] ?? item['body_en'])
                      : item['body_en'];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () => _markRead(item),
                        child: Padding(
                          padding: const EdgeInsets.all(17),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: unreadItem
                                      ? const Color(0xFFEAF0FF)
                                      : const Color(0xFFF0F2F6),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Icon(
                                  Icons.notifications_rounded,
                                  color: unreadItem
                                      ? const Color(0xFF315BEA)
                                      : const Color(0xFF7A8497),
                                  size: 21,
                                ),
                              ),
                              const SizedBox(width: 13),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            title?.toString() ?? '',
                                            style: TextStyle(
                                              fontWeight: unreadItem
                                                  ? FontWeight.w900
                                                  : FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        if (unreadItem)
                                          Container(
                                            width: 8,
                                            height: 8,
                                            decoration: const BoxDecoration(
                                              color: Color(0xFF315BEA),
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      body?.toString() ?? '',
                                      style: const TextStyle(
                                        color: Color(0xFF687386),
                                        height: 1.4,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _date(item['created_at']),
                                      style: const TextStyle(
                                        color: Color(0xFF98A1B2),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}
