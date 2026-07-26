import 'package:flutter_test/flutter_test.dart';
import 'package:shiftly_employee/src/app.dart';

void main() {
  testWidgets('renders the Shiftly HR foundation in demo mode', (tester) async {
    await tester.pumpWidget(const ShiftlyApp(supabaseConfigured: false));
    expect(find.text('Shiftly HR'), findsOneWidget);
    expect(find.text('My schedule'), findsOneWidget);
  });
}
