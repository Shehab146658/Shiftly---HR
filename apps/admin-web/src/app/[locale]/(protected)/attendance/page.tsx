import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AttendanceExportButton } from "@/components/attendance-export-button";
import { AttendancePunchDialog } from "@/components/attendance-punch-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { addIsoDays } from "@/lib/scheduling";
import { recordManualAttendancePunch, refreshAttendancePeriod, reviewAttendancePunch } from "../actions";

export const dynamic = "force-dynamic";

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function minutesText(value: number, locale: string, signed = false) {
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  if (!hours) return `${sign}${minutes}m`;
  return `${sign}${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function timeText(value: string | null, locale: string, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));
}

export default async function AttendancePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; employee?: string; branch?: string; status?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const today = new Date().toISOString().slice(0, 10);
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "") ? filters.to! : today;
  let dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "") ? filters.from! : addIsoDays(dateTo, -6);
  if (dateFrom > dateTo) dateFrom = addIsoDays(dateTo, -6);

  let reportQuery = supabase.from("attendance_days")
    .select("id, employee_id, branch_id, work_date, scheduled_start, scheduled_end, actual_check_in, actual_check_out, scheduled_minutes, actual_minutes, late_minutes, early_departure_minutes, overtime_minutes, missing_minutes, time_balance_minutes, status, valid_punch_count, pending_punch_count, calculation_notes, employees(employee_code, name_en, name_ar), branches(name_en, name_ar)")
    .eq("tenant_id", tenantId).gte("work_date", dateFrom).lte("work_date", dateTo)
    .order("work_date", { ascending: false }).order("actual_check_in");
  if (filters.employee) reportQuery = reportQuery.eq("employee_id", filters.employee);
  if (filters.branch) reportQuery = reportQuery.eq("branch_id", filters.branch);
  if (filters.status) reportQuery = reportQuery.eq("status", filters.status);

  const [{ data: rows, error }, { data: employees }, { data: branches }, { data: pendingPunches }, { data: tenant }] = await Promise.all([
    reportQuery,
    supabase.from("employees").select("id, employee_code, name_en, name_ar, branch_id").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("branches").select("id, name_en, name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("attendance_punches").select("id, employee_id, branch_id, work_date, punch_type, occurred_at, source, latitude, longitude, distance_metres, selfie_path, notes, employees(employee_code, name_en, name_ar), branches(name_en, name_ar)").eq("tenant_id", tenantId).eq("validation_status", "pending").gte("work_date", dateFrom).lte("work_date", dateTo).order("occurred_at", { ascending: false }),
    supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle(),
  ]);
  if (error) throw error;
  const timezone = tenant?.timezone ?? "Africa/Cairo";
  const reportRows = rows ?? [];
  const presentCount = reportRows.filter((row) => row.status === "present" || row.status === "late").length;
  const lateMinutes = reportRows.reduce((total, row) => total + row.late_minutes, 0);
  const overtimeMinutes = reportRows.reduce((total, row) => total + row.overtime_minutes, 0);
  const missingMinutes = reportRows.reduce((total, row) => total + row.missing_minutes, 0);
  const balanceMinutes = reportRows.reduce((total, row) => total + row.time_balance_minutes, 0);
  const action = recordManualAttendancePunch.bind(null, locale, tenantId);
  const refreshAction = refreshAttendancePeriod.bind(null, locale, tenantId);
  const labels = locale === "ar" ? {
    title: "الحضور والانصراف", subtitle: "مواعيد العمل الفعلية والتأخير والإضافي والاستثناءات في تقرير واحد.", addPunch: "إضافة بصمة يدوية", addPunchHelp: "استخدمها للتصحيح أو لإدخال سجل موثق من الإدارة.", punchSaved: "تم حفظ البصمة وإعادة حساب اليوم.", savePunch: "حفظ البصمة",
    attendance: "الحضور", employee: "الموظف", branch: "الفرع", noBranch: "بدون فرع", workDate: "يوم العمل", punchType: "نوع البصمة", checkIn: "حضور", checkOut: "انصراف", occurredAt: "التاريخ والوقت الفعلي", localTimeHelp: "يُحفظ الوقت مع المنطقة الزمنية لجهازك.", manualAuditHelp: "البصمات اليدوية مسجلة في سجل المراجعة باسم المستخدم الذي أضافها.", close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving,
    present: "حضور مكتمل", late: "إجمالي التأخير", overtime: "إجمالي الإضافي", missing: "ساعات ناقصة", balance: "الرصيد النهائي", filters: "فلاتر التقرير", from: "من", to: "إلى", allEmployees: "كل الموظفين", allBranches: "كل الفروع", allStatuses: "كل الحالات", apply: "تطبيق", clear: "مسح", refresh: "إعادة الحساب", refreshed: "تم تحديث حسابات الفترة.", exportCsv: "تصدير CSV",
    scheduled: "المجدول", actual: "الفعلي", firstIn: "أول حضور", lastOut: "آخر انصراف", early: "انصراف مبكر", status: "الحالة", punches: "البصمات", noRows: "لا توجد بيانات في هذه الفترة. انشر جدولًا أو أضف بصمة ثم أعد الحساب.", pendingEvidence: "استثناءات تنتظر المراجعة", pendingHelp: "بصمات خارج النطاق أو بدون دليل موقع لا تدخل الحساب حتى اعتمادها.", source: "المصدر", distance: "المسافة", approve: "اعتماد", reject: "رفض", reviewNote: "ملاحظة المراجعة", approved: "تم اعتماد البصمة وإعادة حساب اليوم.", rejected: "تم رفض البصمة.",
  } : {
    title: "Attendance", subtitle: "Actual working times, lateness, overtime, and exceptions in one operational report.", addPunch: "Add manual punch", addPunchHelp: "Use this for a correction or an administrator-verified attendance event.", punchSaved: "Punch saved and the work day recalculated.", savePunch: "Save punch",
    attendance: "Attendance", employee: "Employee", branch: "Branch", noBranch: "No branch", workDate: "Work day", punchType: "Punch type", checkIn: "Check in", checkOut: "Check out", occurredAt: "Actual date and time", localTimeHelp: "The time is saved with your device timezone.", manualAuditHelp: "Manual punches are audited against the user who entered them.", close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving,
    present: "Completed attendance", late: "Total late", overtime: "Total overtime", missing: "Missing hours", balance: "Final balance", filters: "Report filters", from: "From", to: "To", allEmployees: "All employees", allBranches: "All branches", allStatuses: "All statuses", apply: "Apply", clear: "Clear", refresh: "Recalculate", refreshed: "Attendance calculations refreshed.", exportCsv: "Export CSV",
    scheduled: "Scheduled", actual: "Actual", firstIn: "First in", lastOut: "Last out", early: "Early leave", status: "Status", punches: "Punches", noRows: "No attendance data in this period. Publish a schedule or add a punch, then recalculate.", pendingEvidence: "Exceptions awaiting review", pendingHelp: "Out-of-geofence or missing-location punches stay outside calculations until approved.", source: "Source", distance: "Distance", approve: "Approve", reject: "Reject", reviewNote: "Review note", approved: "Punch approved and the day recalculated.", rejected: "Punch rejected.",
  };
  const statusNames: Record<string, string> = locale === "ar"
    ? { present: "حاضر", late: "متأخر", incomplete: "بصمة ناقصة", absent: "غائب", off: "راحة", leave: "إجازة", unscheduled: "غير مجدول" }
    : { present: "Present", late: "Late", incomplete: "Incomplete", absent: "Absent", off: "OFF", leave: "Leave", unscheduled: "Unscheduled" };
  const exportRows = [[labels.workDate, labels.employee, labels.branch, labels.scheduled, labels.actual, labels.late, labels.early, labels.overtime, labels.missing, labels.balance, labels.status], ...reportRows.map((row) => {
    const employee = relationOne(row.employees);
    const branch = relationOne(row.branches);
    return [row.work_date, locale === "ar" && employee?.name_ar ? employee.name_ar : employee?.name_en ?? "", locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en ?? "", String(row.scheduled_minutes), String(row.actual_minutes), String(row.late_minutes), String(row.early_departure_minutes), String(row.overtime_minutes), String(row.missing_minutes), String(row.time_balance_minutes), statusNames[row.status] ?? row.status];
  })];

  return <>
    <div className="page-head"><div><h1 className="page-title">{labels.title}</h1><p className="muted">{labels.subtitle}</p></div><AttendancePunchDialog action={action} branches={(branches ?? []).map((branch) => ({ id: branch.id, name: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en }))} employees={(employees ?? []).map((employee) => ({ id: employee.id, code: employee.employee_code, name: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en, branchId: employee.branch_id }))} labels={labels} /></div>

    <section className="stats-grid attendance-stats">
      <a className="stat-card" href="#attendance-report"><span>{labels.present}</span><strong>{presentCount}</strong><small>{reportRows.length} {labels.workDate.toLowerCase()}</small></a>
      <a className="stat-card" href="#attendance-report"><span>{labels.late}</span><strong>{minutesText(lateMinutes, locale)}</strong><small>{dateFrom} → {dateTo}</small></a>
      <a className="stat-card" href="#attendance-report"><span>{labels.overtime}</span><strong>{minutesText(overtimeMinutes, locale)}</strong><small>{labels.balance}: {minutesText(balanceMinutes, locale, true)}</small></a>
      <a className="stat-card" href="#attendance-report"><span>{labels.missing}</span><strong>{minutesText(missingMinutes, locale)}</strong><small>{pendingPunches?.length ?? 0} {labels.pendingEvidence.toLowerCase()}</small></a>
    </section>

    <section className="card stack section-gap" id="attendance-report">
      <div className="card-heading"><div><h2>{labels.filters}</h2><p className="muted">{dateFrom} → {dateTo} · {timezone}</p></div><div className="toolbar"><ActionForm action={refreshAction} errorMessage={labels.actionFailed} pendingMessage={labels.saving} successMessage={labels.refreshed}><input name="dateFrom" type="hidden" value={dateFrom} /><input name="dateTo" type="hidden" value={dateTo} /><button className="button secondary" type="submit">{labels.refresh}</button></ActionForm><AttendanceExportButton filename={`shiftly-attendance-${dateFrom}-${dateTo}.csv`} label={labels.exportCsv} rows={exportRows} /></div></div>
      <form className="toolbar attendance-filter" method="get"><div className="field"><label>{labels.from}</label><input className="input compact" defaultValue={dateFrom} name="from" type="date" /></div><div className="field"><label>{labels.to}</label><input className="input compact" defaultValue={dateTo} name="to" type="date" /></div><div className="field"><label>{labels.employee}</label><select className="select compact" defaultValue={filters.employee ?? ""} name="employee"><option value="">{labels.allEmployees}</option>{employees?.map((employee) => <option key={employee.id} value={employee.id}>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</option>)}</select></div><div className="field"><label>{labels.branch}</label><select className="select compact" defaultValue={filters.branch ?? ""} name="branch"><option value="">{labels.allBranches}</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en}</option>)}</select></div><div className="field"><label>{labels.status}</label><select className="select compact" defaultValue={filters.status ?? ""} name="status"><option value="">{labels.allStatuses}</option>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><button className="button" type="submit">{labels.apply}</button><Link className="button ghost" href={`/${locale}/attendance`}>{labels.clear}</Link></form>
      <div className="table-wrap"><table className="attendance-table"><thead><tr><th>{labels.workDate}</th><th>{labels.employee}</th><th>{labels.branch}</th><th>{labels.scheduled}</th><th>{labels.firstIn}</th><th>{labels.lastOut}</th><th>{labels.actual}</th><th>{labels.late}</th><th>{labels.early}</th><th>{labels.overtime}</th><th>{labels.balance}</th><th>{labels.status}</th></tr></thead><tbody>{reportRows.map((row) => {
        const employee = relationOne(row.employees);
        const branch = relationOne(row.branches);
        return <tr key={row.id}><td><strong>{row.work_date}</strong></td><td><Link className="employee-name-link" href={`/${locale}/employees/${row.employee_id}`}><strong>{locale === "ar" && employee?.name_ar ? employee.name_ar : employee?.name_en}</strong><small className="code">{employee?.employee_code}</small></Link></td><td>{locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en ?? "—"}</td><td>{minutesText(row.scheduled_minutes, locale)}</td><td>{timeText(row.actual_check_in, locale, timezone)}</td><td>{timeText(row.actual_check_out, locale, timezone)}</td><td>{minutesText(row.actual_minutes, locale)}</td><td>{minutesText(row.late_minutes, locale)}</td><td>{minutesText(row.early_departure_minutes, locale)}</td><td>{minutesText(row.overtime_minutes, locale)}</td><td><span className={`time-balance ${row.time_balance_minutes >= 0 ? "positive" : "negative"}`}>{minutesText(row.time_balance_minutes, locale, true)}</span></td><td><span className={`badge attendance-${row.status}`}>{statusNames[row.status] ?? row.status}</span>{row.pending_punch_count ? <small className="table-subline pending-evidence">{row.pending_punch_count} {labels.pendingEvidence}</small> : null}</td></tr>;
      })}</tbody></table>{!reportRows.length ? <div className="empty">{labels.noRows}</div> : null}</div>
    </section>

    <section className="card stack section-gap"><div><h2>{labels.pendingEvidence}</h2><p className="muted">{labels.pendingHelp}</p></div><div className="exception-list">{pendingPunches?.map((punch) => {
      const employee = relationOne(punch.employees);
      const branch = relationOne(punch.branches);
      return <article className="exception-card" key={punch.id}><div><span className="badge status-pending">{punch.source}</span><h3>{locale === "ar" && employee?.name_ar ? employee.name_ar : employee?.name_en}</h3><p>{punch.work_date} · {punch.punch_type === "check_in" ? labels.checkIn : labels.checkOut} · {timeText(punch.occurred_at, locale, timezone)}</p></div><dl><div><dt>{labels.branch}</dt><dd>{locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en ?? "—"}</dd></div><div><dt>{labels.distance}</dt><dd>{punch.distance_metres == null ? "—" : `${punch.distance_metres} m`}</dd></div><div><dt>{labels.source}</dt><dd>{punch.source}</dd></div></dl><div className="exception-actions"><ActionForm action={reviewAttendancePunch.bind(null, locale, punch.id, "valid")} errorMessage={labels.actionFailed} pendingMessage={labels.saving} successMessage={labels.approved}><input className="input" name="note" placeholder={labels.reviewNote} /><button className="button small-button" type="submit">{labels.approve}</button></ActionForm><ActionForm action={reviewAttendancePunch.bind(null, locale, punch.id, "rejected")} confirmMessage={`${labels.reject}?`} errorMessage={labels.actionFailed} pendingMessage={labels.saving} successMessage={labels.rejected}><input className="input" minLength={3} name="note" placeholder={labels.reviewNote} required /><button className="button danger small-button" type="submit">{labels.reject}</button></ActionForm></div></article>;
    })}{!pendingPunches?.length ? <div className="empty">{d.empty}</div> : null}</div></section>
  </>;
}
