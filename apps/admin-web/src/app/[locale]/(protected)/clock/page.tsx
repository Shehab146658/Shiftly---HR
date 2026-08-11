import Link from "next/link";
import { EmployeeClock } from "@/components/employee-clock";
import { getTenantPageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

function localParts(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function addIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function EmployeeClockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership, user } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const copy = locale === "ar" ? {
    pageTitle: "الحضور الشخصي", subtitle: "سجّل الحضور والانصراف بإثبات الموقع والصورة وفق سياسة فرعك.", title: "ساعة الحضور", checkIn: "تسجيل الحضور", checkOut: "تسجيل الانصراف", branch: "الفرع", todayShift: "وردية يوم العمل", noShift: "لا توجد وردية منشورة ليوم العمل الحالي.", mobileDisabled: "التسجيل من الهاتف غير مفعّل في هذا الفرع. تواصل مع مسؤول الموارد البشرية.", selfie: "صورة الحضور", selfieRequired: "الصورة مطلوبة قبل التسجيل.", selfieOptional: "الصورة اختيارية حسب سياسة الفرع.", takeSelfie: "التقاط صورة", replaceSelfie: "استبدال الصورة", location: "الموقع", locationReady: "الموقع جاهز", locationOnSubmit: "سيتم التحقق عند التسجيل", locationUnavailable: "تعذر الحصول على الموقع؛ سيُرسل التسجيل للمراجعة.", radius: "النطاق المسموح", online: "متصل", offline: "غير متصل — أعد الاتصال للتسجيل", submitting: "جارٍ التسجيل…", recorded: "تم بنجاح.", pending: "بانتظار موافقة المسؤول", failed: "تعذر تسجيل الحضور.", recent: "آخر التسجيلات", noPunches: "لا توجد تسجيلات حضور بعد.", valid: "معتمد", rejected: "مرفوض", meters: "متر", remove: "إزالة", noEmployee: "حسابك غير مرتبط بسجل موظف. اطلب من المسؤول ربط الحساب من ملف الموظف.", noBranch: "يجب تعيين فرع للموظف قبل استخدام الحضور من الهاتف.", noPermission: "ليس لديك صلاحية تسجيل الحضور من الهاتف.", employeeProfile: "فتح ملف الموظف",
  } : {
    pageTitle: "My attendance", subtitle: "Clock in and out with location and selfie evidence under your branch policy.", title: "Attendance clock", checkIn: "Clock in", checkOut: "Clock out", branch: "Branch", todayShift: "Workday shift", noShift: "No published shift is assigned for the current workday.", mobileDisabled: "Mobile attendance is disabled for this branch. Contact HR for assistance.", selfie: "Attendance selfie", selfieRequired: "A selfie is required before clocking.", selfieOptional: "A selfie is optional under this branch policy.", takeSelfie: "Take selfie", replaceSelfie: "Replace selfie", location: "Location", locationReady: "Location ready", locationOnSubmit: "Verified when you clock", locationUnavailable: "Location could not be obtained; the punch will be sent for approval.", radius: "Allowed radius", online: "Online", offline: "Offline — reconnect to clock", submitting: "Recording…", recorded: "recorded successfully.", pending: "Pending manager approval", failed: "Attendance could not be recorded.", recent: "Recent punches", noPunches: "No attendance punches yet.", valid: "Validated", rejected: "Rejected", meters: "metres", remove: "Remove", noEmployee: "Your account is not linked to an employee record. Ask an administrator to link it from your employee profile.", noBranch: "An employee branch is required before mobile attendance can be used.", noPermission: "You do not have permission to record mobile attendance.", employeeProfile: "Open employee profile",
  };

  const [{ data: employee, error: employeeError }, { data: tenant, error: tenantError }, { data: canClock, error: permissionError }] = await Promise.all([
    supabase.from("employees").select("id,employee_code,name_en,name_ar,branch_id,status").eq("tenant_id", tenantId).eq("user_id", user.id).neq("status", "terminated").maybeSingle(),
    supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle(),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "attendance.clock" }),
  ]);
  if (employeeError) throw employeeError;
  if (tenantError) throw tenantError;
  if (permissionError) throw permissionError;

  if (!employee) return <><div className="page-head"><div><h1 className="page-title">{copy.pageTitle}</h1><p className="muted">{copy.subtitle}</p></div></div><section className="card empty-state-card"><span className="empty-state-icon">↔</span><h2>{copy.noEmployee}</h2></section></>;
  if (!employee.branch_id) return <><div className="page-head"><div><h1 className="page-title">{copy.pageTitle}</h1><p className="muted">{copy.subtitle}</p></div><Link className="button secondary" href={`/${locale}/employees/${employee.id}`}>{copy.employeeProfile}</Link></div><section className="card empty-state-card"><span className="empty-state-icon">⌖</span><h2>{copy.noBranch}</h2></section></>;
  if (!canClock) return <><div className="page-head"><div><h1 className="page-title">{copy.pageTitle}</h1><p className="muted">{copy.subtitle}</p></div></div><section className="card empty-state-card"><span className="empty-state-icon">!</span><h2>{copy.noPermission}</h2></section></>;

  const { data: branch, error: branchError } = await supabase.from("branches")
    .select("id,name_en,name_ar,operational_day_start,mobile_clock_enabled,attendance_selfie_required,geofence_latitude,geofence_longitude,geofence_radius_metres")
    .eq("tenant_id", tenantId).eq("id", employee.branch_id).maybeSingle();
  if (branchError) throw branchError;
  if (!branch) throw new Error("Employee branch could not be loaded");

  const timeZone = tenant?.timezone ?? "Africa/Cairo";
  const parts = localParts(timeZone);
  const wallDate = `${parts.year}-${parts.month}-${parts.day}`;
  const [dayStartHour = "06", dayStartMinute = "00"] = (branch.operational_day_start ?? "06:00:00").split(":");
  const beforeOperationalStart = Number(parts.hour) * 60 + Number(parts.minute) < Number(dayStartHour) * 60 + Number(dayStartMinute);
  const workDate = beforeOperationalStart ? addIsoDays(wallDate, -1) : wallDate;
  const earliestWeekStart = addIsoDays(workDate, -6);

  const { data: schedules, error: scheduleError } = await supabase.from("weekly_schedules")
    .select("id").eq("tenant_id", tenantId).in("status", ["published", "locked"])
    .gte("week_start", earliestWeekStart).lte("week_start", workDate);
  if (scheduleError) throw scheduleError;
  const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);

  const schedulePromise = scheduleIds.length
    ? supabase.from("schedule_entries")
      .select("id,entry_type,custom_start_time,custom_end_time,end_day_offset,shift_templates(start_time,end_time,end_day_offset),branch:branches!schedule_entries_scheduled_branch_id_fkey(name_en,name_ar)")
      .eq("employee_id", employee.id).eq("work_date", workDate).in("schedule_id", scheduleIds).order("segment_no")
    : Promise.resolve({ data: [], error: null });
  const [{ data: scheduleRows, error: entryError }, { data: punches, error: punchesError }] = await Promise.all([
    schedulePromise,
    supabase.from("attendance_punches")
      .select("id,punch_type,occurred_at,validation_status,within_geofence,distance_metres,source")
      .eq("tenant_id", tenantId).eq("employee_id", employee.id).order("occurred_at", { ascending: false }).limit(8),
  ]);
  if (entryError) throw entryError;
  if (punchesError) throw punchesError;

  const schedule = (scheduleRows ?? []).map((row) => {
    const template = relationOne(row.shift_templates);
    const scheduledBranch = relationOne(row.branch);
    return {
      id: row.id,
      entryType: row.entry_type,
      start: template?.start_time ?? row.custom_start_time,
      end: template?.end_time ?? row.custom_end_time,
      endDayOffset: template?.end_day_offset ?? row.end_day_offset,
      branchName: scheduledBranch ? (locale === "ar" && scheduledBranch.name_ar ? scheduledBranch.name_ar : scheduledBranch.name_en) : null,
    };
  });
  const branchName = locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en;

  return <>
    <div className="page-head clock-page-head"><div><span className="eyebrow">{employee.employee_code} · {branchName}</span><h1 className="page-title">{copy.pageTitle}</h1><p className="muted">{copy.subtitle}</p></div><Link className="button ghost" href={`/${locale}/attendance`}>{d.attendance}</Link></div>
    <EmployeeClock branchId={branch.id} branchName={branchName} copy={copy} employeeId={employee.id} geofenceConfigured={branch.geofence_latitude != null && branch.geofence_longitude != null} geofenceRadiusMetres={branch.geofence_radius_metres} initialNow={new Date().toISOString()} initialPunches={(punches ?? []) as Parameters<typeof EmployeeClock>[0]["initialPunches"]} locale={locale} mobileClockEnabled={branch.mobile_clock_enabled} schedule={schedule} selfieRequired={branch.attendance_selfie_required} tenantId={tenantId} />
  </>;
}
