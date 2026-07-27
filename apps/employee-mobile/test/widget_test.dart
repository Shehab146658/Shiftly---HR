import 'package:flutter_test/flutter_test.dart';
import 'package:shiftly_employee/src/app.dart';
import 'package:shiftly_employee/src/schedule_page.dart';

void main() {
  test('schedule lookup supports any configured week-start day', () {
    final window = currentScheduleWindow(DateTime(2026, 7, 23, 23, 59));
    expect(scheduleIsoDate(window.earliestStart), '2026-07-17');
    expect(scheduleIsoDate(window.latestStart), '2026-07-23');
  });

  testWidgets('renders the Shiftly HR foundation in demo mode', (tester) async {
    await tester.pumpWidget(const ShiftlyApp(supabaseConfigured: false));
    expect(find.text('Shiftly HR'), findsOneWidget);
    expect(find.text('My schedule'), findsOneWidget);
  });
}
