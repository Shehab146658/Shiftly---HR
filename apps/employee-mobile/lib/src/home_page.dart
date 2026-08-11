import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shiftly_employee/src/attendance_page.dart';
import 'package:shiftly_employee/src/employee_context.dart';
import 'package:shiftly_employee/src/employee_module_page.dart';
import 'package:shiftly_employee/src/localization.dart';
import 'package:shiftly_employee/src/mobile_ui.dart';
import 'package:shiftly_employee/src/notifications_page.dart';
import 'package:shiftly_employee/src/schedule_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    super.key,
    required this.locale,
    required this.onToggleLocale,
    required this.demoMode,
  });
  final Locale locale;
  final VoidCallback onToggleLocale;
  final bool demoMode;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomeAction {
  const _HomeAction(
    this.icon,
    this.title,
    this.subtitle,
    this.builder,
    this.colors,
  );
  final IconData icon;
  final String title;
  final String subtitle;
  final WidgetBuilder builder;
  final List<Color> colors;
}

class _HomePageState extends State<HomePage> {
  late Future<EmployeeContext?> _employee;
  bool get _ar => widget.locale.languageCode == 'ar';

  @override
  void initState() {
    super.initState();
    _employee = widget.demoMode ? Future.value(null) : EmployeeContext.load();
  }

  void _open(WidgetBuilder builder) =>
      Navigator.of(context).push(MaterialPageRoute(builder: builder));

  @override
  Widget build(BuildContext context) {
    final s = AppStrings(widget.locale);
    final actions = <_HomeAction>[
      _HomeAction(
        Icons.calendar_month_outlined,
        s.t('schedule'),
        s.t('scheduleHint'),
        (_) => SchedulePage(locale: widget.locale, demoMode: widget.demoMode),
        const [Color(0xFF315BEA), Color(0xFF728EFF)],
      ),
      _HomeAction(
        Icons.fingerprint_rounded,
        s.t('attendance'),
        s.t('attendanceHint'),
        (_) => AttendancePage(locale: widget.locale, demoMode: widget.demoMode),
        const [Color(0xFF7157D9), Color(0xFF9B85F3)],
      ),
      _HomeAction(
        Icons.assignment_outlined,
        s.t('requests'),
        s.t('requestsHint'),
        (_) => EmployeeModulePage(
          locale: widget.locale,
          demoMode: widget.demoMode,
          module: EmployeeModule.requests,
        ),
        const [Color(0xFFB26B13), Color(0xFFE39A39)],
      ),
      _HomeAction(
        Icons.receipt_long_outlined,
        s.t('payslips'),
        s.t('payslipsHint'),
        (_) => EmployeeModulePage(
          locale: widget.locale,
          demoMode: widget.demoMode,
          module: EmployeeModule.payslips,
        ),
        const [Color(0xFF15845B), Color(0xFF42AD83)],
      ),
      _HomeAction(
        Icons.task_alt_outlined,
        s.t('tasks'),
        s.t('tasksHint'),
        (_) => EmployeeModulePage(
          locale: widget.locale,
          demoMode: widget.demoMode,
          module: EmployeeModule.tasks,
        ),
        const [Color(0xFFBF4267), Color(0xFFE37796)],
      ),
      _HomeAction(
        Icons.campaign_outlined,
        s.t('announcements'),
        s.t('announcementsHint'),
        (_) => EmployeeModulePage(
          locale: widget.locale,
          demoMode: widget.demoMode,
          module: EmployeeModule.announcements,
        ),
        const [Color(0xFF2C7893), Color(0xFF5CA9BE)],
      ),
    ];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 18,
        title: const ShiftlyBrand(compact: true),
        actions: [
          IconButton(
            tooltip: s.t('notifications'),
            onPressed: () => _open(
              (_) => NotificationsPage(
                locale: widget.locale,
                demoMode: widget.demoMode,
              ),
            ),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          TextButton(
            onPressed: widget.onToggleLocale,
            child: Text(s.t('language')),
          ),
          if (!widget.demoMode)
            IconButton(
              tooltip: s.t('signOut'),
              onPressed: () => Supabase.instance.client.auth.signOut(),
              icon: const Icon(Icons.logout_rounded),
            ),
          const SizedBox(width: 6),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 32),
        children: [
          FutureBuilder<EmployeeContext?>(
            future: _employee,
            builder: (context, snapshot) {
              final employee = snapshot.data;
              return Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF142448), Color(0xFF263F78)],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x26142448),
                      blurRadius: 26,
                      offset: Offset(0, 14),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.t('welcome'),
                      style: const TextStyle(
                        color: Color(0xFF9BAEE0),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      employee?.displayName(_ar) ?? s.t('employeeWorkspace'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      widget.demoMode
                          ? s.t('demo')
                          : employee == null &&
                                snapshot.connectionState == ConnectionState.done
                          ? s.t('unlinkedProfile')
                          : s.t('workspaceIntro'),
                      style: const TextStyle(
                        color: Colors.white70,
                        height: 1.45,
                      ),
                    ),
                    if (employee != null) ...[
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .09),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${s.t('employeeNumber')} ${employee.employeeNumber}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 26),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                s.t('workspace'),
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              Text(
                s.t('secured'),
                style: const TextStyle(
                  color: Color(0xFF7A8497),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: .92,
            ),
            itemBuilder: (context, index) {
              final action = actions[index];
              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => _open(action.builder),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(15),
                            gradient: LinearGradient(colors: action.colors),
                          ),
                          child: Icon(
                            action.icon,
                            size: 23,
                            color: Colors.white,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          action.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF15213D),
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          action.subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF7A8497),
                            fontSize: 11,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
