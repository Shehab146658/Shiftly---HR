import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { LeaveRequestDialog } from "@/components/leave-request-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { adjacentMonth, calendarMonthDays, dateFallsWithin, monthRange, validCalendarMonth } from "@/lib/leaves";
import { cancelLeaveRequest, reviewLeaveRequest, submitLeaveRequest } from "../actions";

type EmployeeRow = {
  id: string;
  employee_code: string;
  name_en: string;
  name_ar: string | null;
  manager_employee_id: string | null;
};

type LeaveTypeRow = {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  legal_article: string | null;
  legal_summary_en: string | null;
  legal_summary_ar: string | null;
  paid: boolean;
  requires_document: boolean;
};

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function LeavesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string; employee?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, user, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const { year, month } = validCalendarMonth(filters.year, filters.month);
  const range = monthRange(year, month);
  const copy = locale === "ar" ? {
    title: "الإجازات والعطلات", subtitle: "رصيد الإجازات والطلبات والعطلات الرسمية وفق قانون العمل المصري رقم 14 لسنة 2025.",
    requestLeave: "طلب إجازة", leaveManagement: "إدارة الإجازات", requestHelp: "يُراجع المدير الطلب أولًا ثم يرسله النظام إلى المالك للاعتماد النهائي.",
    requestCreated: "تم إرسال طلب الإجازة بنجاح إلى مسار الموافقات.", submitRequest: "إرسال الطلب", leaveType: "نوع الإجازة",
    startDate: "من", endDate: "إلى", dayPart: "جزء اليوم", fullDay: "يوم كامل", firstHalf: "النصف الأول", secondHalf: "النصف الثاني", hours: "بالساعات",
    minutesWhenHourly: "الدقائق (عند الاختيار بالساعات)", supportingDocument: "المستند المؤيد", documentRequired: "مستند مطلوب", documentHelp: "PDF أو صورة، بحد أقصى 10 ميجابايت.",
    expectedDelivery: "تاريخ الولادة المتوقع (عند الحاجة)", actualDelivery: "تاريخ الولادة الفعلي (عند الحاجة)",
    officialHolidays: "العطلات الرسمية", pendingRequests: "طلبات معلقة", awaitingOwner: "بانتظار المالك", approvedDays: "أيام معتمدة هذا الشهر",
    annualBalance: "رصيد الإجازة السنوية", entitlement: "الاستحقاق القانوني", available: "المتاح حاليًا", balanceHelp: "يُحسب تلقائيًا حسب تاريخ التعيين والعمر ومدة الخدمة والظروف القانونية المسجلة.",
    previous: "الشهر السابق", next: "الشهر التالي", calendar: "تقويم الإجازات", calendarHelp: "العطلات الرسمية المعتمدة لعام 2026 تظهر تلقائيًا ولا تُخصم من الرصيد السنوي.",
    requests: "طلبات الإجازة", employee: "الموظف", period: "الفترة", units: "الأيام", status: "الحالة", approval: "مسار الموافقة", actions: "الإجراءات",
    managerReview: "مراجعة المدير", ownerReview: "اعتماد المالك", complete: "مكتمل", pending: "معلق", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغي",
    approve: "موافقة", reject: "رفض", approvalNote: "ملاحظة الموافقة", rejectionReason: "سبب الرفض مطلوب", approveSuccess: "تمت الموافقة وانتقل الطلب إلى المرحلة التالية.", rejectSuccess: "تم رفض الطلب وتسجيل السبب.",
    statutoryPolicies: "السياسات القانونية الافتراضية", policiesHelp: "الحدود القانونية مثبتة افتراضيًا ويمكن للإدارة إضافة مزايا أفضل دون تقليل حق العامل.",
    paid: "مدفوعة", unpaid: "بدون أجر", noRequests: "لا توجد طلبات في هذا الشهر.", source: "المصدر الرسمي", egyptHolidaysSource: "رئاسة جمهورية مصر العربية - العطلات الرسمية 2026",
    settings: "إعدادات الإجازات", document: "عرض المستند", history: "سجل الموافقات", cancelRequest: "إلغاء الطلب", cancellationReason: "سبب الإلغاء", cancelledSuccess: "تم إلغاء طلب الإجازة.", currentStep: "الخطوة الحالية",
    close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving, reason: d.reason,
  } : {
    title: "Leave & holidays", subtitle: "Balances, requests, and official holidays aligned with Egypt Labour Law No. 14 of 2025.",
    requestLeave: "Request leave", leaveManagement: "Leave management", requestHelp: "The employee's manager reviews first, then Shiftly sends the request to an owner for final approval.",
    requestCreated: "Leave request submitted to the approval workflow.", submitRequest: "Submit request", leaveType: "Leave type",
    startDate: "Start date", endDate: "End date", dayPart: "Day part", fullDay: "Full day", firstHalf: "First half", secondHalf: "Second half", hours: "Hours",
    minutesWhenHourly: "Minutes (for hourly leave)", supportingDocument: "Supporting document", documentRequired: "document required", documentHelp: "PDF or image, up to 10 MB.",
    expectedDelivery: "Expected delivery date (when relevant)", actualDelivery: "Actual delivery date (when relevant)",
    officialHolidays: "Official holidays", pendingRequests: "Pending requests", awaitingOwner: "Awaiting owner", approvedDays: "Approved days this month",
    annualBalance: "Annual leave balance", entitlement: "Statutory entitlement", available: "Currently available", balanceHelp: "Calculated from hire date, age, prior service, and recorded statutory working conditions.",
    previous: "Previous month", next: "Next month", calendar: "Leave calendar", calendarHelp: "Official 2026 holidays are added automatically and never reduce annual leave.",
    requests: "Leave requests", employee: "Employee", period: "Period", units: "Days", status: "Status", approval: "Approval workflow", actions: "Actions",
    managerReview: "Manager review", ownerReview: "Owner approval", complete: "Complete", pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled",
    approve: "Approve", reject: "Reject", approvalNote: "Approval note", rejectionReason: "Rejection reason required", approveSuccess: "Approved and moved to the next workflow stage.", rejectSuccess: "Request rejected and reason recorded.",
    statutoryPolicies: "Default statutory policies", policiesHelp: "Legal minimums are protected by default; administrators can add more generous company benefits.",
    paid: "Paid", unpaid: "Unpaid", noRequests: "No requests in this month.", source: "Official source", egyptHolidaysSource: "Presidency of Egypt - National Holidays 2026",
    settings: "Leave settings", document: "View document", history: "Approval history", cancelRequest: "Cancel request", cancellationReason: "Cancellation reason", cancelledSuccess: "Leave request cancelled.", currentStep: "Current step",
    close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving, reason: d.reason,
  };

  const [{ data: employeeData, error: employeeError }, { data: leaveTypeData, error: leaveTypeError }, { data: holidays, error: holidayError }, { data: requests, error: requestError }, { data: currentEmployee }, { data: canManageLeave }] = await Promise.all([
    supabase.from("employees").select("id, employee_code, name_en, name_ar, manager_employee_id").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("leave_types").select("id, code, name_en, name_ar, legal_article, legal_summary_en, legal_summary_ar, paid, requires_document").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("public_holidays").select("id, holiday_date, name_en, name_ar, source_reference").eq("tenant_id", tenantId).gte("holiday_date", range.start).lte("holiday_date", range.end).order("holiday_date"),
    supabase.from("leave_requests").select("id, employee_id, start_date, end_date, day_part, requested_units, reason, status, approval_stage, submitted_at, review_note, supporting_document_path, workflow_id, current_workflow_step_id, compliance_flags, employees(id, employee_code, name_en, name_ar, manager_employee_id), leave_types(code, name_en, name_ar, paid), current_step:approval_workflow_steps!leave_requests_current_workflow_step_id_fkey(id, step_order, name_en, name_ar, approver_kind), leave_approval_actions(stage, decision, note, acted_at, workflow_step:approval_workflow_steps(name_en, name_ar))").eq("tenant_id", tenantId).lte("start_date", range.end).gte("end_date", range.start).order("submitted_at", { ascending: false }),
    supabase.from("employees").select("id").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "leave.manage" }),
  ]);
  if (employeeError) throw employeeError;
  if (leaveTypeError) throw leaveTypeError;
  if (holidayError) throw holidayError;
  if (requestError) throw requestError;
  const employees = (employeeData ?? []) as EmployeeRow[];
  const leaveTypes = (leaveTypeData ?? []) as LeaveTypeRow[];
  const selectedEmployeeId = filters.employee && employees.some((employee) => employee.id === filters.employee)
    ? filters.employee
    : currentEmployee?.id ?? employees[0]?.id;
  const [{ data: entitlement }, { data: available }] = selectedEmployeeId ? await Promise.all([
    supabase.rpc("annual_leave_entitlement", { p_employee_id: selectedEmployeeId, p_as_of: `${year}-12-31` }),
    supabase.rpc("leave_balance_available", { p_employee_id: selectedEmployeeId, p_balance_code: "annual", p_leave_year: year }),
  ]) : [{ data: 0 }, { data: 0 }];

  const calendarDays = calendarMonthDays(year, month);
  const previous = adjacentMonth(year, month, -1);
  const next = adjacentMonth(year, month, 1);
  const monthLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const holidayByDate = new Map((holidays ?? []).map((holiday) => [holiday.holiday_date, holiday]));
  const rows = requests ?? [];
  const pendingRows = rows.filter((request) => request.status === "pending");
  const approvableResults = await Promise.all(pendingRows.map(async (request) => {
    const { data } = await supabase.rpc("can_approve_leave_request", { p_request_id: request.id });
    return [request.id, Boolean(data)] as const;
  }));
  const approvableRequestIds = new Set(approvableResults.filter(([, allowed]) => allowed).map(([requestId]) => requestId));
  const documentResults = await Promise.all(rows.filter((request) => request.supporting_document_path).map(async (request) => {
    const { data } = await supabase.storage.from("leave-documents").createSignedUrl(request.supporting_document_path!, 900);
    return [request.id, data?.signedUrl ?? null] as const;
  }));
  const documentUrls = new Map(documentResults);
  const pendingCount = rows.filter((request) => request.status === "pending").length;
  const ownerCount = rows.filter((request) => request.status === "pending" && relationOne(request.current_step as { approver_kind: string } | { approver_kind: string }[] | null)?.approver_kind === "owner").length;
  const approvedUnits = rows.filter((request) => request.status === "approved").reduce((total, request) => total + Number(request.requested_units), 0);
  const weekdayLabels = locale === "ar" ? ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"] : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const requestAction = submitLeaveRequest.bind(null, locale, tenantId);

  return <>
    <div className="page-head"><div><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div><div className="page-actions">{canManageLeave ? <Link className="button secondary" href={`/${locale}/leaves/settings`}>{copy.settings}</Link> : null}{employees.length && leaveTypes.length ? <LeaveRequestDialog action={requestAction} defaultEmployeeId={selectedEmployeeId} employees={employees.map((employee) => ({ id: employee.id, code: employee.employee_code, name: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en }))} leaveTypes={leaveTypes.map((type) => ({ id: type.id, name: locale === "ar" ? type.name_ar : type.name_en, requiresDocument: type.requires_document }))} labels={copy} /> : null}</div></div>

    <section className="stats-grid leave-stats">
      <Link className="stat-card" href={`/${locale}/leaves?year=${year}&month=${month}`}><span>{copy.officialHolidays}</span><strong>{holidays?.length ?? 0}</strong><small>{monthLabel}</small></Link>
      <a className="stat-card" href="#leave-requests"><span>{copy.pendingRequests}</span><strong>{pendingCount}</strong><small>{copy.managerReview}</small></a>
      <a className="stat-card" href="#leave-requests"><span>{copy.awaitingOwner}</span><strong>{ownerCount}</strong><small>{copy.ownerReview}</small></a>
      <a className="stat-card" href="#leave-calendar"><span>{copy.approvedDays}</span><strong>{approvedUnits.toFixed(1)}</strong><small>{monthLabel}</small></a>
    </section>

    <section className="card stack section-gap leave-balance-card">
      <div className="card-heading"><div><h2>{copy.annualBalance}</h2><p className="muted">{copy.balanceHelp}</p></div><form method="get"><input name="year" type="hidden" value={year} /><input name="month" type="hidden" value={month} /><select aria-label={copy.employee} className="select compact" defaultValue={selectedEmployeeId} name="employee">{employees.map((employee) => <option key={employee.id} value={employee.id}>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</option>)}</select><button className="button ghost compact-button">{d.search}</button></form></div>
      <div className="balance-metrics"><div><span>{copy.entitlement}</span><strong>{Number(entitlement ?? 0).toFixed(2)}</strong></div><div><span>{copy.available}</span><strong>{Number(available ?? 0).toFixed(2)}</strong></div></div>
    </section>

    <section className="card stack section-gap" id="leave-calendar">
      <div className="calendar-toolbar"><div><h2>{copy.calendar}</h2><p className="muted">{copy.calendarHelp}</p></div><div className="calendar-pager"><Link className="button ghost" href={`/${locale}/leaves?year=${previous.year}&month=${previous.month}`}>← {copy.previous}</Link><strong>{monthLabel}</strong><Link className="button ghost" href={`/${locale}/leaves?year=${next.year}&month=${next.month}`}>{copy.next} →</Link></div></div>
      <div className="leave-calendar" role="grid">
        {weekdayLabels.map((label) => <div className="calendar-weekday" key={label} role="columnheader">{label}</div>)}
        {calendarDays.map((day) => {
          const holiday = holidayByDate.get(day.date);
          const dayRequests = rows.filter((request) => dateFallsWithin(day.date, request.start_date, request.end_date));
          return <div className={`calendar-day${day.inMonth ? "" : " calendar-day-outside"}${holiday ? " calendar-day-holiday" : ""}`} key={day.date} role="gridcell"><time dateTime={day.date}>{day.dayNumber}</time>{holiday ? <span className="calendar-event holiday-event" title={holiday.source_reference ?? copy.egyptHolidaysSource}>{locale === "ar" ? holiday.name_ar : holiday.name_en}</span> : null}{dayRequests.slice(0, 2).map((request) => { const employee = relationOne(request.employees as EmployeeRow | EmployeeRow[] | null); return <span className={`calendar-event leave-event status-${request.status}`} key={request.id}>{employee ? (locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en) : copy.employee}</span>; })}{dayRequests.length > 2 ? <small className="calendar-more">+{dayRequests.length - 2}</small> : null}</div>;
        })}
      </div>
      <p className="legal-source"><strong>{copy.source}:</strong> <a className="text-link" href="https://www.presidency.eg/EN/%D9%85%D8%B5%D8%B1/%D8%A7%D9%84%D8%B9%D8%B7%D9%84%D8%A7%D8%AA-%D8%A7%D9%84%D8%B1%D8%B3%D9%85%D9%8A%D8%A9/" rel="noreferrer" target="_blank">{copy.egyptHolidaysSource}</a></p>
    </section>

    <section className="card stack section-gap" id="leave-requests">
      <div><h2>{copy.requests}</h2><p className="muted">{copy.requestHelp}</p></div>
      <div className="table-wrap"><table className="leave-request-table"><thead><tr><th>{copy.employee}</th><th>{copy.leaveType}</th><th>{copy.period}</th><th>{copy.units}</th><th>{copy.status}</th><th>{copy.approval}</th><th>{copy.actions}</th></tr></thead><tbody>{rows.map((request) => {
        const employee = relationOne(request.employees as EmployeeRow | EmployeeRow[] | null);
        const leaveType = relationOne(request.leave_types as { code: string; name_en: string; name_ar: string; paid: boolean } | { code: string; name_en: string; name_ar: string; paid: boolean }[] | null);
        const currentStep = relationOne(request.current_step as { id: string; step_order: number; name_en: string; name_ar: string; approver_kind: string } | { id: string; step_order: number; name_en: string; name_ar: string; approver_kind: string }[] | null);
        const canReview = approvableRequestIds.has(request.id);
        const canCancel = request.status === "pending" && (request.employee_id === currentEmployee?.id || Boolean(canManageLeave));
        const statusLabel = request.status === "approved" ? copy.approved : request.status === "rejected" ? copy.rejected : request.status === "cancelled" ? copy.cancelled : copy.pending;
        const stageLabel = currentStep ? (locale === "ar" ? currentStep.name_ar : currentStep.name_en) : request.status === "pending" ? copy.currentStep : copy.complete;
        const approvalActions = request.leave_approval_actions ?? [];
        const documentUrl = documentUrls.get(request.id);
        return <tr key={request.id}>
          <td><strong>{employee ? (locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en) : "—"}</strong><small className="table-subline code">{employee?.employee_code}</small></td>
          <td>{leaveType ? (locale === "ar" ? leaveType.name_ar : leaveType.name_en) : "—"}</td>
          <td>{request.start_date}<span className="table-subline">{request.end_date !== request.start_date ? `→ ${request.end_date}` : ""}</span></td>
          <td>{Number(request.requested_units).toFixed(2)}</td>
          <td><span className={`badge status-${request.status}`}>{statusLabel}</span></td>
          <td><span className={`workflow-stage workflow-${request.approval_stage}`}>{stageLabel}</span><small className="table-subline">{currentStep ? `${copy.currentStep} ${currentStep.step_order}` : ""}</small></td>
          <td><div className="leave-request-actions">
            {canReview ? <div className="approval-actions"><ActionForm action={reviewLeaveRequest.bind(null, locale, request.id, "approved")} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.approveSuccess}><input aria-label={copy.approvalNote} className="input approval-note" name="reviewNote" placeholder={copy.approvalNote} /><button className="button small-button" type="submit">{copy.approve}</button></ActionForm><ActionForm action={reviewLeaveRequest.bind(null, locale, request.id, "rejected")} confirmMessage={`${copy.reject}?`} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.rejectSuccess}><input aria-label={copy.rejectionReason} className="input approval-note" name="reviewNote" placeholder={copy.rejectionReason} required /><button className="button danger small-button" type="submit">{copy.reject}</button></ActionForm></div> : null}
            <div className="leave-request-links">{documentUrl ? <a className="text-link" href={documentUrl} rel="noreferrer" target="_blank">{copy.document}</a> : null}{approvalActions.length ? <details><summary>{copy.history} ({approvalActions.length})</summary><ol>{approvalActions.map((action, index) => { const step = relationOne(action.workflow_step as { name_en: string; name_ar: string } | { name_en: string; name_ar: string }[] | null); return <li key={`${action.acted_at}-${index}`}><strong>{step ? (locale === "ar" ? step.name_ar : step.name_en) : action.stage}</strong><span className={`badge status-${action.decision}`}>{action.decision}</span>{action.note ? <p>{action.note}</p> : null}<time>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(action.acted_at))}</time></li>; })}</ol></details> : null}</div>
            {canCancel ? <details className="leave-cancel-panel"><summary>{copy.cancelRequest}</summary><ActionForm action={cancelLeaveRequest.bind(null, locale, request.id)} confirmMessage={`${copy.cancelRequest}?`} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.cancelledSuccess}><input className="input" name="cancellationReason" placeholder={copy.cancellationReason} required /><button className="button danger small-button" type="submit">{copy.cancelRequest}</button></ActionForm></details> : null}
            {!canReview && !canCancel && !documentUrl && !approvalActions.length ? <span className="muted">{stageLabel}</span> : null}
          </div></td>
        </tr>;
      })}</tbody></table>{!rows.length ? <div className="empty">{copy.noRequests}</div> : null}</div>
    </section>

    <section className="card stack section-gap statutory-policy-section"><div><h2>{copy.statutoryPolicies}</h2><p className="muted">{copy.policiesHelp}</p></div><div className="policy-grid">{leaveTypes.map((type) => <details className="policy-card" key={type.id}><summary><span><strong>{locale === "ar" ? type.name_ar : type.name_en}</strong><small>{type.legal_article ?? type.code}</small></span><span className={`badge ${type.paid ? "status-active" : "status-inactive"}`}>{type.paid ? copy.paid : copy.unpaid}</span></summary><p>{locale === "ar" ? type.legal_summary_ar : type.legal_summary_en}</p></details>)}</div></section>
  </>;
}
