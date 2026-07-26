import 'package:flutter/widgets.dart';

class AppStrings {
  const AppStrings(this.locale);
  final Locale locale;

  bool get isArabic => locale.languageCode == 'ar';
  String t(String key) => (_values[locale.languageCode] ?? _values['en']!)[key] ?? key;

  static const _values = <String, Map<String, String>>{
    'en': {
      'app': 'Shiftly HR', 'signIn': 'Sign in', 'email': 'Email', 'password': 'Password',
      'welcome': 'Welcome', 'schedule': 'My schedule', 'attendance': 'Attendance',
      'requests': 'Requests', 'payslips': 'Payslips', 'tasks': 'Tasks', 'announcements': 'Announcements',
      'foundation': 'Milestone 2 employee scheduling is connected.', 'demo': 'Demo mode: add Supabase dart-defines to enable login.',
      'signOut': 'Sign out', 'loginError': 'Unable to sign in. Check the credentials.', 'language': 'العربية',
      'off': 'OFF', 'leave': 'Leave', 'training': 'Training', 'assignment': 'Assignment',
      'noSchedule': 'No published schedule is available for this week.',
      'demoSchedule': 'Sign in with a linked employee account to view the published weekly schedule.',
      'scheduleError': 'The schedule could not be loaded.',
    },
    'ar': {
      'app': 'شيفتلي للموارد البشرية', 'signIn': 'تسجيل الدخول', 'email': 'البريد الإلكتروني', 'password': 'كلمة المرور',
      'welcome': 'مرحبًا', 'schedule': 'جدولي', 'attendance': 'الحضور', 'requests': 'الطلبات',
      'payslips': 'قسائم الراتب', 'tasks': 'المهام', 'announcements': 'الإعلانات',
      'foundation': 'تم ربط المرحلة الثانية الخاصة بجداول الموظفين.', 'demo': 'وضع تجريبي: أضف إعدادات Supabase لتفعيل الدخول.',
      'signOut': 'تسجيل الخروج', 'loginError': 'تعذر تسجيل الدخول. راجع البيانات.', 'language': 'English',
      'off': 'إجازة أسبوعية', 'leave': 'إجازة', 'training': 'تدريب', 'assignment': 'مهمة خارجية',
      'noSchedule': 'لا يوجد جدول منشور لهذا الأسبوع.',
      'demoSchedule': 'سجّل الدخول بحساب موظف مرتبط لعرض الجدول الأسبوعي المنشور.',
      'scheduleError': 'تعذر تحميل الجدول.',
    },
  };
}
