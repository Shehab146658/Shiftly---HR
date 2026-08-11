import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { RequestCreateDialog } from "@/components/request-create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { cancelHrRequest, reviewHrRequest, submitHrRequest } from "../actions";

export const dynamic = "force-dynamic";

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function schemaFields(schema: unknown) {
  if (!schema || typeof schema !== "object" || !("fields" in schema) || !Array.isArray(schema.fields)) return [];
  return schema.fields.filter((value): value is string => typeof value === "string");
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function RequestsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; type?: string; employee?: string; request?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, user, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const copy = locale === "ar" ? {
    title: "مركز الطلبات", subtitle: "كل الأذونات والتصحيحات وتغييرات الجدول في مسار موافقات واضح وقابل للتخصيص.",
    requestCenter: "الخدمة الذاتية للموظف", newRequest: "طلب جديد", newRequestHelp: "اختر نوع الطلب وسيقوم شيفتلي بتوجيهه تلقائيًا إلى الأشخاص المناسبين.",
    requestSubmitted: "تم إرسال الطلب وبدأ مسار الموافقات.", submitRequest: "إرسال الطلب", requestType: "نوع الطلب", requestDate: "تاريخ الطلب", endDate: "تاريخ النهاية",
    titleLabel: "عنوان الطلب", startTime: "وقت البداية", endTime: "وقت النهاية", requestedMinutes: "الدقائق المطلوبة", requestedBranch: "الفرع المطلوب", chooseBranch: "اختر فرعًا",
    supportingDocument: "مرفق داعم", documentHelp: "PDF أو صورة بحد أقصى 10 ميجابايت.", managerStep: "المراجع الأول", finalStep: "الاعتماد النهائي",
    openRequests: "طلبات مفتوحة", awaitingMe: "تنتظرني", approvedThisMonth: "معتمدة هذا الشهر", rejectedThisMonth: "مرفوضة هذا الشهر",
    requestQueue: "صندوق الطلبات", queueHelp: "افتح أي طلب لرؤية تفاصيله ومسار الموافقات الكامل.", allStatuses: "كل الحالات", allTypes: "كل الأنواع", allEmployees: "كل الموظفين", apply: "تطبيق", clear: "مسح",
    employee: "الموظف", submitted: "تاريخ الإرسال", status: "الحالة", currentStep: "الخطوة الحالية", details: "التفاصيل", actions: "الإجراءات", noRequests: "لا توجد طلبات تطابق هذه الفلاتر.",
    inReview: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغي", submittedStatus: "مرسل", approve: "اعتماد", reject: "رفض", reviewNote: "ملاحظة المراجعة", rejectionReason: "سبب الرفض مطلوب",
    approvedSuccess: "تم اعتماد الخطوة ونقل الطلب إلى المرحلة التالية.", rejectedSuccess: "تم رفض الطلب وتسجيل السبب.", cancelRequest: "إلغاء الطلب", cancellationReason: "سبب الإلغاء", cancelSuccess: "تم إلغاء الطلب.",
    requestedPeriod: "الفترة المطلوبة", reason: "السبب", workflowHistory: "سجل المسار", noReason: "لا يوجد سبب", configureWorkflows: "إعداد مسارات الموافقة", approvalSettings: "إعدادات الموافقات",
    close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving,
  } : {
    title: "Request center", subtitle: "Permissions, corrections, and schedule changes in one clear, configurable approval operation.",
    requestCenter: "Employee self-service", newRequest: "New request", newRequestHelp: "Choose a request type and Shiftly routes it to the right people automatically.",
    requestSubmitted: "Request submitted and its approval workflow started.", submitRequest: "Submit request", requestType: "Request type", requestDate: "Request date", endDate: "End date",
    titleLabel: "Request title", startTime: "Start time", endTime: "End time", requestedMinutes: "Requested minutes", requestedBranch: "Requested branch", chooseBranch: "Choose a branch",
    supportingDocument: "Supporting attachment", documentHelp: "PDF or image, up to 10 MB.", managerStep: "First reviewer", finalStep: "Final approval",
    openRequests: "Open requests", awaitingMe: "Awaiting me", approvedThisMonth: "Approved this month", rejectedThisMonth: "Rejected this month",
    requestQueue: "Request inbox", queueHelp: "Open a request to see its details and complete approval journey.", allStatuses: "All statuses", allTypes: "All types", allEmployees: "All employees", apply: "Apply", clear: "Clear",
    employee: "Employee", submitted: "Submitted", status: "Status", currentStep: "Current step", details: "Details", actions: "Actions", noRequests: "No requests match these filters.",
    inReview: "In review", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", submittedStatus: "Submitted", approve: "Approve", reject: "Reject", reviewNote: "Review note", rejectionReason: "Rejection reason required",
    approvedSuccess: "Step approved and the request moved forward.", rejectedSuccess: "Request rejected and the reason recorded.", cancelRequest: "Cancel request", cancellationReason: "Cancellation reason", cancelSuccess: "Request cancelled.",
    requestedPeriod: "Requested period", reason: "Reason", workflowHistory: "Workflow history", noReason: "No reason provided", configureWorkflows: "Configure approval workflows", approvalSettings: "Approval settings",
    close: d.close, cancel: d.cancel, actionFailed: d.actionFailed, saving: d.saving,
  };

  const [{ data: employeeData, error: employeeError }, { data: requestTypeData, error: typeError }, { data: branchData }, { data: currentEmployee }, { data: canManageWorkflows }] = await Promise.all([
    supabase.from("employees").select("id, employee_code, name_en, name_ar, branch_id").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("request_types").select("id, code, category, name_en, name_ar, description_en, description_ar, form_schema, requires_attachment, requires_reason").eq("tenant_id", tenantId).eq("is_active", true).order("category").order("name_en"),
    supabase.from("branches").select("id, name_en, name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("employees").select("id").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "requests.manage" }),
  ]);
  if (employeeError) throw employeeError;
  if (typeError) throw typeError;
  const employees = employeeData ?? [];
  const requestTypes = requestTypeData ?? [];

  let query = supabase.from("hr_requests").select("id, employee_id, request_type_id, status, title, reason, start_date, end_date, start_time, end_time, requested_minutes, payload, submitted_at, resolved_at, resolution_note, cancellation_reason, employees(id, employee_code, name_en, name_ar, manager_employee_id), request_types(id, code, category, name_en, name_ar), current_step:approval_workflow_steps!hr_requests_current_step_id_fkey(id, step_order, name_en, name_ar, approver_kind, approval_mode, approvals_required)")
    .eq("tenant_id", tenantId).order("submitted_at", { ascending: false }).limit(100);
  if (filters.status && ["submitted", "in_review", "approved", "rejected", "cancelled"].includes(filters.status)) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("request_type_id", filters.type);
  if (filters.employee) query = query.eq("employee_id", filters.employee);
  const { data: requestData, error: requestError } = await query;
  if (requestError) throw requestError;
  const requests = requestData ?? [];
  const requestIds = requests.map((request) => request.id);
  const [{ data: historyData }, approvalChecks] = await Promise.all([
    requestIds.length
      ? supabase.from("request_status_events").select("id, request_id, from_status, to_status, note, created_at, approval_workflow_steps(name_en, name_ar)").in("request_id", requestIds).order("created_at")
      : Promise.resolve({ data: [] }),
    Promise.all(requests.filter((request) => request.status === "in_review").map(async (request) => {
      const { data } = await supabase.rpc("can_approve_hr_request", { p_request_id: request.id });
      return [request.id, Boolean(data)] as const;
    })),
  ]);
  const canApprove = new Map(approvalChecks);
  const historyByRequest = new Map<string, typeof historyData>();
  for (const event of historyData ?? []) {
    const current = historyByRequest.get(event.request_id) ?? [];
    current.push(event);
    historyByRequest.set(event.request_id, current);
  }
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const openCount = requests.filter((request) => request.status === "submitted" || request.status === "in_review").length;
  const awaitingCount = requests.filter((request) => canApprove.get(request.id)).length;
  const approvedCount = requests.filter((request) => request.status === "approved" && request.submitted_at >= monthStart).length;
  const rejectedCount = requests.filter((request) => request.status === "rejected" && request.submitted_at >= monthStart).length;
  const statusLabels: Record<string, string> = { submitted: copy.submittedStatus, in_review: copy.inReview, approved: copy.approved, rejected: copy.rejected, cancelled: copy.cancelled };
  const selectedEmployeeId = currentEmployee?.id ?? employees[0]?.id;
  const createAction = submitHrRequest.bind(null, locale, tenantId);

  return <>
    <div className="page-head request-page-head"><div><span className="eyebrow">{copy.requestCenter}</span><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div><div className="toolbar">{canManageWorkflows ? <Link className="button ghost" href={`/${locale}/requests/workflows`}>{copy.approvalSettings}</Link> : null}{employees.length && requestTypes.length ? <RequestCreateDialog action={createAction} branches={(branchData ?? []).map((branch) => ({ id: branch.id, name: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en }))} defaultEmployeeId={selectedEmployeeId} employees={employees.map((employee) => ({ id: employee.id, code: employee.employee_code, name: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en }))} labels={{ ...copy, title: copy.titleLabel }} requestTypes={requestTypes.map((type) => ({ id: type.id, name: locale === "ar" ? type.name_ar : type.name_en, description: locale === "ar" ? type.description_ar : type.description_en, fields: schemaFields(type.form_schema), requiresAttachment: type.requires_attachment, requiresReason: type.requires_reason }))} /> : null}</div></div>

    <section className="stats-grid request-stats">
      <a className="stat-card" href="#request-inbox"><span>{copy.openRequests}</span><strong>{openCount}</strong><small>{copy.inReview}</small></a>
      <a className="stat-card request-attention" href="#request-inbox"><span>{copy.awaitingMe}</span><strong>{awaitingCount}</strong><small>{copy.actions}</small></a>
      <a className="stat-card" href="#request-inbox"><span>{copy.approvedThisMonth}</span><strong>{approvedCount}</strong><small>{monthStart}</small></a>
      <a className="stat-card" href="#request-inbox"><span>{copy.rejectedThisMonth}</span><strong>{rejectedCount}</strong><small>{monthStart}</small></a>
    </section>

    <section className="card stack section-gap" id="request-inbox">
      <div className="card-heading"><div><h2>{copy.requestQueue}</h2><p className="muted">{copy.queueHelp}</p></div></div>
      <form className="toolbar request-filter" method="get"><select aria-label={copy.status} className="select compact" defaultValue={filters.status ?? ""} name="status"><option value="">{copy.allStatuses}</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label={copy.requestType} className="select compact" defaultValue={filters.type ?? ""} name="type"><option value="">{copy.allTypes}</option>{requestTypes.map((type) => <option key={type.id} value={type.id}>{locale === "ar" ? type.name_ar : type.name_en}</option>)}</select><select aria-label={copy.employee} className="select compact" defaultValue={filters.employee ?? ""} name="employee"><option value="">{copy.allEmployees}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</option>)}</select><button className="button" type="submit">{copy.apply}</button><Link className="button ghost" href={`/${locale}/requests`}>{copy.clear}</Link></form>
      <div className="request-list">{requests.map((request) => {
        const employee = relationOne(request.employees);
        const type = relationOne(request.request_types);
        const step = relationOne(request.current_step);
        const history = historyByRequest.get(request.id) ?? [];
        const isOpen = request.status === "submitted" || request.status === "in_review";
        const canCancel = isOpen && (request.employee_id === currentEmployee?.id || membership.is_owner);
        const focused = filters.request === request.id;
        return <article className={`request-card${focused ? " request-card-focused" : ""}`} id={`request-${request.id}`} key={request.id}>
          <div className="request-card-main"><span className={`request-category request-category-${type?.category ?? "general"}`}>{type ? (locale === "ar" ? type.name_ar : type.name_en) : copy.requestType}</span><div className="request-person"><Link href={`/${locale}/employees/${request.employee_id}`}><strong>{employee ? (locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en) : "—"}</strong></Link><small>{employee?.employee_code} · {formatDate(request.submitted_at, locale)}</small></div><span className={`badge request-status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span><div className="request-step"><small>{copy.currentStep}</small><strong>{step ? (locale === "ar" ? step.name_ar : step.name_en) : statusLabels[request.status]}</strong></div></div>
          <details className="request-details" open={focused}><summary>{copy.details}<span aria-hidden="true">⌄</span></summary><div className="request-detail-grid"><div><span>{copy.requestedPeriod}</span><strong>{request.start_date ?? "—"}{request.end_date && request.end_date !== request.start_date ? ` → ${request.end_date}` : ""}{request.start_time ? ` · ${request.start_time.slice(0, 5)}${request.end_time ? ` → ${request.end_time.slice(0, 5)}` : ""}` : ""}</strong></div><div><span>{copy.reason}</span><strong>{request.reason || copy.noReason}</strong></div></div>
            <div className="request-timeline"><h3>{copy.workflowHistory}</h3>{history.map((event) => { const eventStep = relationOne(event.approval_workflow_steps); return <div className="request-timeline-item" key={event.id}><i /><div><strong>{eventStep ? (locale === "ar" ? eventStep.name_ar : eventStep.name_en) : statusLabels[event.to_status]}</strong><small>{formatDate(event.created_at, locale)}{event.note ? ` · ${event.note}` : ""}</small></div></div>; })}</div>
            {canApprove.get(request.id) ? <div className="request-review-panel"><ActionForm action={reviewHrRequest.bind(null, locale, request.id, "approved")} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.approvedSuccess}><textarea className="input" name="reviewNote" placeholder={copy.reviewNote} rows={2} /><button className="button" type="submit">{copy.approve}</button></ActionForm><ActionForm action={reviewHrRequest.bind(null, locale, request.id, "rejected")} confirmMessage={`${copy.reject}?`} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.rejectedSuccess}><textarea className="input" minLength={2} name="reviewNote" placeholder={copy.rejectionReason} required rows={2} /><button className="button danger" type="submit">{copy.reject}</button></ActionForm></div> : null}
            {canCancel ? <ActionForm action={cancelHrRequest.bind(null, locale, request.id)} className="request-cancel-form" confirmMessage={`${copy.cancelRequest}?`} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.cancelSuccess}><input className="input" minLength={2} name="cancellationReason" placeholder={copy.cancellationReason} required /><button className="button ghost" type="submit">{copy.cancelRequest}</button></ActionForm> : null}
          </details>
        </article>;
      })}{!requests.length ? <div className="empty">{copy.noRequests}</div> : null}</div>
    </section>
  </>;
}
