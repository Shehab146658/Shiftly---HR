import 'package:flutter/widgets.dart';

class AppStrings {
  const AppStrings(this.locale);
  final Locale locale;

  bool get isArabic => locale.languageCode == 'ar';
  String t(String key) =>
      (_values[locale.languageCode] ?? _values['en']!)[key] ?? key;

  static const _values = <String, Map<String, String>>{
    'en': {
      'app': 'Shiftly HR',
      'signIn': 'Sign in',
      'email': 'Email',
      'password': 'Password',
      'welcome': 'Welcome back',
      'schedule': 'My schedule',
      'attendance': 'Attendance',
      'requests': 'Requests',
      'payslips': 'Payslips',
      'tasks': 'Tasks',
      'announcements': 'Announcements',
      'notifications': 'Notifications',
      'scheduleHint': 'Published shifts and days off',
      'attendanceHint': 'Clock in, out, and review activity',
      'requestsHint': 'Track approvals and decisions',
      'payslipsHint': 'Review published salary statements',
      'tasksHint': 'Start and deliver assigned work',
      'announcementsHint': 'Read company updates',
      'employeeWorkspace': 'Employee workspace',
      'workspaceIntro':
          'Your schedule, attendance, approvals, and company updates in one secure place.',
      'unlinkedProfile':
          'Your account is signed in but is not linked to an employee profile yet.',
      'employeeNumber': 'Employee',
      'workspace': 'Your workspace',
      'secured': 'Protected by company access',
      'foundation': 'Your secure employee workspace is connected.',
      'demo': 'Preview mode: connect Supabase to use live employee workflows.',
      'signOut': 'Sign out',
      'loginError': 'Unable to sign in. Check the credentials.',
      'language': 'العربية',
      'off': 'OFF',
      'leave': 'Leave',
      'training': 'Training',
      'assignment': 'Assignment',
      'noSchedule': 'No published schedule is available for this week.',
      'demoSchedule':
          'Sign in with a linked employee account to view the published weekly schedule.',
      'scheduleError': 'The schedule could not be loaded.',
    },
    'ar': {
      'app': 'شيفتلي للموارد البشرية',
      'signIn': 'تسجيل الدخول',
      'email': 'البريد الإلكتروني',
      'password': 'كلمة المرور',
      'welcome': 'مرحباً بعودتك',
      'schedule': 'جدولي',
      'attendance': 'الحضور',
      'requests': 'الطلبات',
      'payslips': 'قسائم الراتب',
      'tasks': 'المهام',
      'announcements': 'الإعلانات',
      'notifications': 'الإشعارات',
      'scheduleHint': 'الورديات المنشورة وأيام الراحة',
      'attendanceHint': 'تسجيل الحضور والانصراف ومراجعة السجل',
      'requestsHint': 'متابعة الموافقات والقرارات',
      'payslipsHint': 'مراجعة بيانات الراتب المنشورة',
      'tasksHint': 'بدء وتسليم العمل المكلف به',
      'announcementsHint': 'قراءة تحديثات الشركة',
      'employeeWorkspace': 'مساحة عمل الموظف',
      'workspaceIntro':
          'جدولك وحضورك وموافقاتك وتحديثات الشركة في مكان آمن واحد.',
      'unlinkedProfile':
          'تم تسجيل الدخول لكن الحساب غير مرتبط بملف موظف حتى الآن.',
      'employeeNumber': 'الموظف',
      'workspace': 'مساحة عملك',
      'secured': 'محمية بصلاحيات الشركة',
      'foundation': 'تم ربط مساحة عمل الموظف الآمنة.',
      'demo': 'وضع المعاينة: اربط Supabase لاستخدام عمليات الموظف المباشرة.',
      'signOut': 'تسجيل الخروج',
      'loginError': 'تعذر تسجيل الدخول. راجع بيانات الحساب.',
      'language': 'English',
      'off': 'راحة أسبوعية',
      'leave': 'إجازة',
      'training': 'تدريب',
      'assignment': 'مهمة خارجية',
      'noSchedule': 'لا يوجد جدول منشور لهذا الأسبوع.',
      'demoSchedule':
          'سجّل الدخول بحساب موظف مرتبط لعرض الجدول الأسبوعي المنشور.',
      'scheduleError': 'تعذر تحميل الجدول.',
    },
  };
}
