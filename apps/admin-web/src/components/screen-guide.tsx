"use client";

import { usePathname } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

type Guide = {
  title: [string, string];
  description: [string, string];
  actions: Array<[string, string]>;
};

const guides: Record<string, Guide> = {
  dashboard: {
    title: ["Your operations overview", "نظرة عامة على عملياتك"],
    description: ["Monitor workforce health, spot items needing attention, and jump directly to the right workspace.", "تابع حالة القوى العاملة واكتشف البنود التي تحتاج تدخلاً وانتقل مباشرة إلى مساحة العمل المناسبة."],
    actions: [["Review live indicators", "راجع المؤشرات المباشرة"], ["Open action queues", "افتح قوائم الإجراءات"], ["Navigate to any module", "انتقل إلى أي قسم"]],
  },
  branches: {
    title: ["Manage operating locations", "إدارة مواقع العمل"],
    description: ["Create branches and configure each location's workday, timezone, geofence, and scheduling rules.", "أنشئ الفروع واضبط يوم العمل والمنطقة الزمنية والنطاق الجغرافي وقواعد الجدولة لكل موقع."],
    actions: [["Add or update branches", "أضف الفروع أو عدّلها"], ["Set attendance boundaries", "اضبط حدود الحضور"], ["Open branch employees", "اعرض موظفي الفرع"]],
  },
  teams: {
    title: ["Organize flexible teams", "تنظيم فرق عمل مرنة"],
    description: ["Group employees for scheduling and approvals while keeping team assignment optional.", "جمّع الموظفين لأغراض الجدولة والموافقات مع بقاء إسناد الفريق اختيارياً."],
    actions: [["Create teams", "أنشئ فرقاً"], ["Assign members", "عيّن الأعضاء"], ["Review team coverage", "راجع تغطية الفريق"]],
  },
  employees: {
    title: ["Run the employee lifecycle", "إدارة دورة حياة الموظف"],
    description: ["Add people, maintain employment details, assign access roles, and review assignment history from one directory.", "أضف الموظفين وحدّث بيانات العمل وعيّن صلاحيات الوصول وراجع سجل التكليفات من دليل واحد."],
    actions: [["Add an employee", "أضف موظفاً"], ["Assign roles and location", "عيّن الدور والموقع"], ["Open a full profile", "افتح الملف الكامل"]],
  },
  shifts: {
    title: ["Build reusable shift patterns", "إنشاء قوالب ورديات قابلة لإعادة الاستخدام"],
    description: ["Define standard, overnight, and break-aware shifts that managers can reuse in weekly plans.", "عرّف الورديات القياسية والليلية وفترات الراحة ليعيد المديرون استخدامها في الخطط الأسبوعية."],
    actions: [["Create shift templates", "أنشئ قوالب ورديات"], ["Set overnight timing", "اضبط الورديات الليلية"], ["Retire old templates", "أوقف القوالب القديمة"]],
  },
  schedules: {
    title: ["Plan and publish weekly coverage", "تخطيط ونشر التغطية الأسبوعية"],
    description: ["Pick employees for specific days and hours, add split or overnight segments, mark OFF days, then publish a locked plan.", "اختر الموظفين لأيام وساعات محددة وأضف فترات مجزأة أو ليلية وحدد أيام الراحة ثم انشر خطة مقفلة."],
    actions: [["Create a weekly plan", "أنشئ خطة أسبوعية"], ["Assign people and hours", "عيّن الأشخاص والساعات"], ["Publish and lock", "انشر واقفل الخطة"]],
  },
  clock: {
    title: ["Capture trusted attendance", "تسجيل حضور موثوق"],
    description: ["Clock in or out with the enabled location and selfie controls, and review today's punch status.", "سجّل الحضور أو الانصراف باستخدام ضوابط الموقع والصورة المفعلة وراجع حالة بصمات اليوم."],
    actions: [["Clock in or out", "سجّل الحضور أو الانصراف"], ["Verify location", "تحقق من الموقع"], ["Review today's activity", "راجع نشاط اليوم"]],
  },
  attendance: {
    title: ["Control attendance operations", "إدارة عمليات الحضور"],
    description: ["Review punches, lateness, overtime, missing time, and exceptions across any employee or date range.", "راجع البصمات والتأخير والإضافي والوقت الناقص والاستثناءات لأي موظف أو فترة."],
    actions: [["Filter attendance", "صفِّ الحضور"], ["Resolve exceptions", "عالج الاستثناءات"], ["Export calculations", "صدّر الحسابات"]],
  },
  "attendance/devices": {
    title: ["Connect attendance devices", "ربط أجهزة الحضور"],
    description: ["Register fingerprint terminals, import machine files, map columns, and reconcile invalid or duplicate rows.", "سجّل أجهزة البصمة واستورد ملفاتها واربط الأعمدة وعالج الصفوف غير الصحيحة أو المكررة."],
    actions: [["Register a device", "سجّل جهازاً"], ["Import punch files", "استورد ملفات البصمات"], ["Review sync errors", "راجع أخطاء المزامنة"]],
  },
  leaves: {
    title: ["Manage leave and holidays", "إدارة الإجازات والعطلات"],
    description: ["Track balances, submit or review requests, and see Egyptian public holidays in one calendar.", "تابع الأرصدة وقدّم الطلبات أو راجعها وشاهد العطلات الرسمية المصرية في تقويم واحد."],
    actions: [["Request leave", "اطلب إجازة"], ["Review approvals", "راجع الموافقات"], ["Check team calendar", "راجع تقويم الفريق"]],
  },
  "leaves/settings": {
    title: ["Configure leave policy", "إعداد سياسة الإجازات"],
    description: ["Maintain entitlements, accrual, carryover, evidence rules, approval routing, and public holidays.", "أدر الاستحقاقات والتراكم والترحيل وقواعد المستندات ومسار الموافقات والعطلات الرسمية."],
    actions: [["Edit leave types", "عدّل أنواع الإجازات"], ["Set legal entitlements", "اضبط الاستحقاقات القانونية"], ["Maintain holidays", "حدّث العطلات"]],
  },
  requests: {
    title: ["Coordinate employee requests", "تنسيق طلبات الموظفين"],
    description: ["Submit and review permissions, corrections, schedule changes, overtime, and other employee requests.", "قدّم وراجع الاستئذانات والتصحيحات وتغييرات الجدول والإضافي وغيرها من طلبات الموظفين."],
    actions: [["Create a request", "أنشئ طلباً"], ["Approve or reject", "وافق أو ارفض"], ["Track every step", "تابع كل خطوة"]],
  },
  "requests/workflows": {
    title: ["Design approval workflows", "تصميم مسارات الموافقة"],
    description: ["Build sequential or parallel approval routes using managers, owners, HR, or configurable roles.", "أنشئ مسارات موافقة متتابعة أو متوازية باستخدام المديرين أو الملاك أو الموارد البشرية أو أدوار مخصصة."],
    actions: [["Create a workflow", "أنشئ مساراً"], ["Add approval stages", "أضف مراحل الموافقة"], ["Publish a version", "انشر إصداراً"]],
  },
  payroll: {
    title: ["Prepare accurate payroll", "إعداد رواتب دقيقة"],
    description: ["Open periods, calculate attendance-linked pay, review adjustments, approve results, and publish payslips.", "افتح الفترات واحسب الرواتب المرتبطة بالحضور وراجع التعديلات واعتمد النتائج وانشر القسائم."],
    actions: [["Open a payroll period", "افتح فترة رواتب"], ["Review calculations", "راجع الحسابات"], ["Publish payslips", "انشر قسائم الرواتب"]],
  },
  payslips: {
    title: ["Understand a payslip", "فهم قسيمة الراتب"],
    description: ["Review earnings, deductions, attendance impact, installments, and the final net salary snapshot.", "راجع المستحقات والاستقطاعات وتأثير الحضور والأقساط وصافي الراتب النهائي."],
    actions: [["Review components", "راجع المكونات"], ["Check attendance impact", "تحقق من تأثير الحضور"], ["Print the payslip", "اطبع القسيمة"]],
  },
  loans: {
    title: ["Manage loans and advances", "إدارة السلف والقروض"],
    description: ["Submit requests, approve terms, track installments, reschedule payments, and record early settlements.", "قدّم الطلبات واعتمد الشروط وتابع الأقساط وأعد الجدولة وسجّل السداد المبكر."],
    actions: [["Request an advance", "اطلب سلفة"], ["Review installments", "راجع الأقساط"], ["Record a settlement", "سجّل تسوية"]],
  },
  performance: {
    title: ["Turn performance into incentives", "تحويل الأداء إلى حوافز"],
    description: ["Record sales, set branch or individual targets, calculate achievement, and approve transparent bonuses.", "سجّل المبيعات وحدد أهداف الفروع أو الأفراد واحسب الإنجاز واعتمد مكافآت واضحة."],
    actions: [["Record daily sales", "سجّل المبيعات اليومية"], ["Set targets", "حدد الأهداف"], ["Calculate bonuses", "احسب المكافآت"]],
  },
  tasks: {
    title: ["Manage accountable work", "إدارة العمل القابل للمتابعة"],
    description: ["Assign recurring or one-off tasks, collect evidence, follow overdue work, and approve completion.", "عيّن مهام دورية أو لمرة واحدة واجمع أدلة التنفيذ وتابع المتأخر واعتمد الإنجاز."],
    actions: [["Create a task", "أنشئ مهمة"], ["Track delivery", "تابع التنفيذ"], ["Review evidence", "راجع الأدلة"]],
  },
  announcements: {
    title: ["Communicate with the right audience", "التواصل مع الجمهور المناسب"],
    description: ["Publish targeted announcements, require acknowledgement, and monitor who has read each message.", "انشر إعلانات موجهة واطلب تأكيد القراءة وتابع من قرأ كل رسالة."],
    actions: [["Compose an announcement", "اكتب إعلاناً"], ["Choose the audience", "اختر الجمهور"], ["Track acknowledgement", "تابع التأكيد"]],
  },
  reports: {
    title: ["Make evidence-based decisions", "اتخاذ قرارات مبنية على البيانات"],
    description: ["Compare attendance, staffing, payroll, sales, tasks, and risk indicators across branches and periods.", "قارن الحضور والتوظيف والرواتب والمبيعات والمهام ومؤشرات المخاطر بين الفروع والفترات."],
    actions: [["Choose a period", "اختر فترة"], ["Compare branches", "قارن الفروع"], ["Export insights", "صدّر النتائج"]],
  },
  roles: {
    title: ["Control access safely", "التحكم الآمن في الصلاحيات"],
    description: ["See what each role can do, customize permissions, and understand how many people receive that access.", "اعرف ما يستطيع كل دور فعله وخصص الصلاحيات وافهم عدد الأشخاص الذين يملكون هذا الوصول."],
    actions: [["Inspect permissions", "راجع الصلاحيات"], ["Customize a role", "خصص دوراً"], ["Review assigned users", "راجع المستخدمين المعينين"]],
  },
  audit: {
    title: ["Trace important changes", "تتبّع التغييرات المهمة"],
    description: ["See who changed what and when, open the responsible person's profile, and review before-and-after values.", "اعرف من غيّر ماذا ومتى وافتح ملف الشخص المسؤول وراجع القيم قبل التغيير وبعده."],
    actions: [["Filter events", "صفِّ الأحداث"], ["Open actor profiles", "افتح ملفات المنفذين"], ["Review change details", "راجع تفاصيل التغيير"]],
  },
  search: {
    title: ["Find anything quickly", "العثور على أي شيء بسرعة"],
    description: ["Search employees, locations, requests, tasks, announcements, payroll periods, and schedules together.", "ابحث معاً عن الموظفين والمواقع والطلبات والمهام والإعلانات وفترات الرواتب والجداول."],
    actions: [["Search by name or code", "ابحث بالاسم أو الكود"], ["Open grouped results", "افتح النتائج المصنفة"], ["Continue in the source module", "تابع داخل القسم الأصلي"]],
  },
  status: {
    title: ["Review delivery readiness", "مراجعة جاهزية النظام"],
    description: ["Check implemented capabilities, validation evidence, known limitations, and the next planned product work.", "راجع الوظائف المنفذة وأدلة الاختبار والقيود المعروفة والعمل المخطط التالي."],
    actions: [["Check completed scope", "راجع النطاق المكتمل"], ["Review validation", "راجع الاختبارات"], ["See known limitations", "اطلع على القيود"]],
  },
  profiles: {
    title: ["Review a user profile", "مراجعة ملف المستخدم"],
    description: ["Confirm account identity, company membership, access roles, and the linked employee record.", "تحقق من هوية الحساب وعضوية الشركة وأدوار الوصول وسجل الموظف المرتبط."],
    actions: [["Review identity", "راجع الهوية"], ["Check assigned roles", "تحقق من الأدوار"], ["Open employee details", "افتح بيانات الموظف"]],
  },
};

function guideKey(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const first = segments[0] ?? "dashboard";
  const second = segments[1];
  if ((first === "attendance" && second === "devices") || (first === "leaves" && second === "settings") || (first === "requests" && second === "workflows")) return `${first}/${second}`;
  if (first === "payslips") return "payslips";
  return first;
}

export function ScreenGuide({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const guide = guides[guideKey(pathname)];
  if (!guide) return null;
  const languageIndex = locale === "ar" ? 1 : 0;
  const heading = locale === "ar" ? "ما الذي يمكنك فعله هنا؟" : "What you can do here";

  return <section aria-label={heading} className="screen-guide">
    <div aria-hidden="true" className="screen-guide-mark">?</div>
    <div className="screen-guide-copy">
      <span>{heading}</span>
      <strong>{guide.title[languageIndex]}</strong>
      <p>{guide.description[languageIndex]}</p>
    </div>
    <ul>{guide.actions.map((action) => <li key={action[0]}>{action[languageIndex]}</li>)}</ul>
  </section>;
}
