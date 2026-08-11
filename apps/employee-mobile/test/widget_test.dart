import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shiftly_employee/src/app.dart';
import 'package:shiftly_employee/src/schedule_page.dart';

void main() {
  test('schedule lookup supports any configured week-start day', () {
    final window = currentScheduleWindow(DateTime(2026, 7, 23, 23, 59));
    expect(scheduleIsoDate(window.earliestStart), '2026-07-17');
    expect(scheduleIsoDate(window.latestStart), '2026-07-23');
  });

  testWidgets('renders the employee workspace and opens attendance', (
    tester,
  ) async {
    await tester.pumpWidget(const ShiftlyApp(supabaseConfigured: false));
    expect(find.text('SHIFTLY'), findsOneWidget);
    expect(find.text('My schedule'), findsOneWidget);
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('Requests'), findsOneWidget);
    expect(find.text('Payslips'), findsOneWidget);
    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('Announcements'), findsOneWidget);

    await tester.drag(find.byType(ListView).first, const Offset(0, -260));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();
    expect(find.text('Clock in / out'), findsOneWidget);
    expect(find.text('Account not linked to an employee'), findsOneWidget);
  });

  testWidgets('switches the complete employee workspace to Arabic', (
    tester,
  ) async {
    await tester.pumpWidget(const ShiftlyApp(supabaseConfigured: false));
    await tester.tap(find.text('العربية'));
    await tester.pumpAndSettle();
    expect(find.text('جدولي'), findsOneWidget);
    expect(find.text('الحضور'), findsOneWidget);
    expect(find.text('الطلبات'), findsOneWidget);
    expect(find.text('الإعلانات'), findsOneWidget);
  });
}
