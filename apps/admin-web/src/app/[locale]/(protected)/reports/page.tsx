import Link from "next/link";
import { AttendanceExportButton } from "@/components/attendance-export-button";
import { getTenantPageContext } from "@/lib/page-context";
import { addIsoDays } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function validDate(value: string | undefined, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function currency(value: number, locale: string, code = "EGP") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency", currency: code, maximumFractionDigits: 0,
  }).format(value);
}

function hours(minutes: number, locale: string) {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en").format(Math.round((minutes / 60) * 10) / 10)}h`;
}

function dateLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function ReportsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const dateTo = validDate(filters.to, today);
  let dateFrom = validDate(filters.from, monthStart);
  if (dateFrom > dateTo) dateFrom = monthStart;
  const rangeStart = `${dateFrom}T00:00:00.000Z`;
  const rangeEnd = `${dateTo}T23:59:59.999Z`;

  const copy = locale === "ar" ? {
    title: "مركز تقارير الإدارة", subtitle: "صورة موحدة للقوى العاملة والحضور والتكلفة والأداء مع روابط مباشرة لاتخاذ الإجراء.",
    executive: "الملخص التنفيذي", filters: "نطاق التقرير", from: "من", to: "إلى", branch: "الفرع", allBranches: "كل الفروع", apply: "تطبيق", clear: "مسح", export: "تصدير CSV",
    headcount: "الموظفون النشطون", attendance: "الالتزام بالحضور", payroll: "صافي الرواتب", sales: "المبيعات المعتمدة", versus: "من المستهدف", days: "أيام مسجلة", people: "موظف", period: "الفترة المحددة",
    trends: "اتجاه التشغيل", trendsHelp: "الحضور والمبيعات عبر الفترة المحددة.", attendanceRate: "نسبة الحضور", approvedSales: "المبيعات", branchScorecard: "بطاقة أداء الفروع", branchHelp: "قارن التغطية والانضباط والأداء التجاري ثم افتح التفاصيل.",
    late: "التأخير", overtime: "الإضافي", leave: "الإجازات المعتمدة", taskDelivery: "إنجاز المهام", readRate: "قراءة الإعلانات", loanExposure: "رصيد السلف", targetAchievement: "تحقيق الهدف", pending: "إجراءات معلقة", operationalHealth: "صحة العمليات", finance: "المال والأداء", actionCenter: "مركز الإجراء", actionHelp: "الأولويات التي تحتاج مراجعة الإدارة الآن.",
    requestsPending: "طلبات تنتظر الاعتماد", overdueTasks: "مهام متأخرة", incompleteAttendance: "أيام حضور غير مكتملة", overdueInstallments: "أقساط متأخرة", unreadAnnouncements: "إعلانات لم تُقرأ", noRisks: "لا توجد مخاطر تشغيلية ظاهرة في النطاق المحدد.",
    open: "فتح", noAccess: "ليس لديك صلاحية لعرض تقارير الإدارة.", employees: "الموظفون", completeDays: "أيام حضور مكتملة", netPayroll: "صافي الرواتب", approvedLeave: "وحدات إجازة معتمدة", total: "الإجمالي", metric: "المؤشر", value: "القيمة",
  } : {
    title: "Management reporting center", subtitle: "One decision-ready view of workforce, attendance, cost, and performance with direct paths to action.",
    executive: "Executive pulse", filters: "Report scope", from: "From", to: "To", branch: "Branch", allBranches: "All branches", apply: "Apply", clear: "Clear", export: "Export CSV",
    headcount: "Active headcount", attendance: "Attendance compliance", payroll: "Net payroll", sales: "Approved sales", versus: "of target", days: "recorded days", people: "people", period: "selected period",
    trends: "Operating trend", trendsHelp: "Attendance compliance and approved sales across the selected period.", attendanceRate: "Attendance", approvedSales: "Sales", branchScorecard: "Branch scorecard", branchHelp: "Compare coverage, discipline, and commercial performance, then drill into the source.",
    late: "Late time", overtime: "Overtime", leave: "Approved leave", taskDelivery: "Task delivery", readRate: "Announcement reach", loanExposure: "Loan exposure", targetAchievement: "Target achievement", pending: "Pending actions", operationalHealth: "Operational health", finance: "Finance & performance", actionCenter: "Action center", actionHelp: "Priorities that need management review now.",
    requestsPending: "Requests awaiting approval", overdueTasks: "Overdue tasks", incompleteAttendance: "Incomplete attendance days", overdueInstallments: "Overdue installments", unreadAnnouncements: "Unread announcements", noRisks: "No visible operational risks in the selected scope.",
    open: "Open", noAccess: "You do not have permission to view management reports.", employees: "Employees", completeDays: "Completed attendance days", netPayroll: "Net payroll", approvedLeave: "Approved leave units", total: "Total", metric: "Metric", value: "Value",
  };

  const [{ data: canRead }, { data: canExport }, branchesResult, employeesResult] = await Promise.all([
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "reports.read" }),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "reports.export" }),
    supabase.from("branches").select("id,name_en,name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("employees").select("id,branch_id,status").eq("tenant_id", tenantId),
  ]);
  if (!canRead && !membership.is_owner) return <div className="card empty">{copy.noAccess}</div>;
  if (branchesResult.error) throw branchesResult.error;
  if (employeesResult.error) throw employeesResult.error;
  const branches = branchesResult.data ?? [];
  const requestedBranch = branches.some((branch) => branch.id === filters.branch) ? filters.branch! : "";
  const allEmployees = employeesResult.data ?? [];
  const scopedEmployees = requestedBranch ? allEmployees.filter((employee) => employee.branch_id === requestedBranch) : allEmployees;
  const scopedIds = new Set(scopedEmployees.map((employee) => employee.id));
  const activeEmployees = scopedEmployees.filter((employee) => employee.status === "active");

  const [attendanceResult, leaveResult, requestsResult, payrollResult, loansResult, installmentsResult, salesResult, targetsResult, tasksResult, assignmentsResult, recipientsResult] = await Promise.all([
    supabase.from("attendance_days").select("employee_id,branch_id,work_date,status,scheduled_minutes,late_minutes,overtime_minutes,missing_minutes").eq("tenant_id", tenantId).gte("work_date", dateFrom).lte("work_date", dateTo),
    supabase.from("leave_requests").select("employee_id,status,requested_units,start_date,end_date").eq("tenant_id", tenantId).lte("start_date", dateTo).gte("end_date", dateFrom),
    supabase.from("hr_requests").select("employee_id,status,submitted_at").eq("tenant_id", tenantId).gte("submitted_at", rangeStart).lte("submitted_at", rangeEnd),
    supabase.from("payroll_employee_results").select("employee_id,net_amount,gross_amount,deductions_amount,currency_code,payroll_periods!inner(period_start,period_end,status)").eq("tenant_id", tenantId).lte("payroll_periods.period_start", dateTo).gte("payroll_periods.period_end", dateFrom),
    supabase.from("employee_loans").select("employee_id,status,remaining_balance,currency_code").eq("tenant_id", tenantId).in("status", ["active", "paused"]),
    supabase.from("loan_installments").select("status,due_date,employee_loans!inner(employee_id)").eq("tenant_id", tenantId).lt("due_date", today).in("status", ["scheduled", "partial", "overdue"]),
    supabase.from("sales_entries").select("employee_id,branch_id,business_date,amount,currency_code,status").eq("tenant_id", tenantId).gte("business_date", dateFrom).lte("business_date", dateTo),
    supabase.from("sales_targets").select("branch_id,team_id,employee_id,target_amount,currency_code,period_start,period_end").eq("tenant_id", tenantId).eq("is_active", true).lte("period_start", dateTo).gte("period_end", dateFrom),
    supabase.from("tasks").select("id,status,due_at").eq("tenant_id", tenantId).gte("due_at", rangeStart).lte("due_at", rangeEnd),
    supabase.from("task_assignments").select("employee_id,status,tasks!inner(due_at)").eq("tenant_id", tenantId).gte("tasks.due_at", rangeStart).lte("tasks.due_at", rangeEnd),
    supabase.from("announcement_recipients").select("employee_id,read_at,delivered_at").eq("tenant_id", tenantId).gte("delivered_at", rangeStart).lte("delivered_at", rangeEnd),
  ]);
  for (const result of [attendanceResult, leaveResult, requestsResult, payrollResult, loansResult, installmentsResult, salesResult, targetsResult, tasksResult, assignmentsResult, recipientsResult]) {
    if (result.error) throw result.error;
  }

  const attendance = (attendanceResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const leave = (leaveResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const requests = (requestsResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const payroll = (payrollResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const loans = (loansResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const installments = (installmentsResult.data ?? []).filter((row) => {
    const loan = relationOne(row.employee_loans);
    return Boolean(loan && scopedIds.has(loan.employee_id));
  });
  const sales = (salesResult.data ?? []).filter((row) => requestedBranch ? row.branch_id === requestedBranch : (!row.employee_id || scopedIds.has(row.employee_id)));
  const targets = (targetsResult.data ?? []).filter((row) => !requestedBranch || row.branch_id === requestedBranch || (row.employee_id ? scopedIds.has(row.employee_id) : false));
  const assignments = (assignmentsResult.data ?? []).filter((row) => scopedIds.has(row.employee_id));
  const recipients = (recipientsResult.data ?? []).filter((row) => !row.employee_id || scopedIds.has(row.employee_id));

  const scheduledDays = attendance.filter((row) => row.scheduled_minutes > 0 && row.status !== "off").length;
  const completeDays = attendance.filter((row) => ["present", "late"].includes(row.status)).length;
  const attendanceRate = percentage(completeDays, scheduledDays);
  const totalLate = attendance.reduce((sum, row) => sum + row.late_minutes, 0);
  const totalOvertime = attendance.reduce((sum, row) => sum + row.overtime_minutes, 0);
  const incompleteDays = attendance.filter((row) => row.status === "incomplete" || row.missing_minutes > 0).length;
  const approvedLeave = leave.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.requested_units), 0);
  const netPayroll = payroll.reduce((sum, row) => sum + Number(row.net_amount), 0);
  const grossPayroll = payroll.reduce((sum, row) => sum + Number(row.gross_amount), 0);
  const approvedSalesRows = sales.filter((row) => row.status === "approved");
  const approvedSales = approvedSalesRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const targetValue = targets.reduce((sum, row) => sum + Number(row.target_amount), 0);
  const targetRate = percentage(approvedSales, targetValue);
  const loanExposure = loans.reduce((sum, row) => sum + Number(row.remaining_balance), 0);
  const taskApproved = assignments.filter((row) => row.status === "approved").length;
  const taskRate = percentage(taskApproved, assignments.length);
  const overdueTasks = assignments.filter((row) => {
    const task = relationOne(row.tasks);
    return task && task.due_at < new Date().toISOString() && !["approved", "cancelled"].includes(row.status);
  }).length;
  const readRate = percentage(recipients.filter((row) => row.read_at).length, recipients.length);
  const unreadAnnouncements = recipients.filter((row) => !row.read_at).length;
  const pendingRequests = requests.filter((row) => ["submitted", "in_review"].includes(row.status)).length
    + leave.filter((row) => row.status === "pending").length;
  const overdueInstallments = installments.length;

  const startMs = Date.parse(`${dateFrom}T00:00:00Z`);
  const endMs = Date.parse(`${dateTo}T00:00:00Z`);
  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
  const bucketSize = Math.max(1, Math.ceil(totalDays / 7));
  const trend = Array.from({ length: Math.ceil(totalDays / bucketSize) }, (_, index) => {
    const from = addIsoDays(dateFrom, index * bucketSize);
    const to = [addIsoDays(from, bucketSize - 1), dateTo].sort()[0];
    const days = attendance.filter((row) => row.work_date >= from && row.work_date <= to && row.scheduled_minutes > 0 && row.status !== "off");
    const complete = days.filter((row) => ["present", "late"].includes(row.status)).length;
    const bucketSales = approvedSalesRows.filter((row) => row.business_date >= from && row.business_date <= to).reduce((sum, row) => sum + Number(row.amount), 0);
    return { from, to, attendance: percentage(complete, days.length), sales: bucketSales };
  });
  const maxTrendSales = Math.max(1, ...trend.map((item) => item.sales));

  const branchScorecards = branches.filter((branch) => !requestedBranch || branch.id === requestedBranch).map((branch) => {
    const branchEmployeeIds = new Set(allEmployees.filter((employee) => employee.branch_id === branch.id).map((employee) => employee.id));
    const branchDays = attendance.filter((row) => row.branch_id === branch.id || branchEmployeeIds.has(row.employee_id)).filter((row) => row.scheduled_minutes > 0 && row.status !== "off");
    const branchComplete = branchDays.filter((row) => ["present", "late"].includes(row.status)).length;
    const branchSales = approvedSalesRows.filter((row) => row.branch_id === branch.id).reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      id: branch.id,
      name: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en,
      employees: allEmployees.filter((employee) => employee.branch_id === branch.id && employee.status === "active").length,
      attendance: percentage(branchComplete, branchDays.length),
      late: branchDays.reduce((sum, row) => sum + row.late_minutes, 0),
      sales: branchSales,
    };
  });

  const risks = [
    { count: pendingRequests, label: copy.requestsPending, href: `/${locale}/requests`, tone: "amber" },
    { count: overdueTasks, label: copy.overdueTasks, href: `/${locale}/tasks`, tone: "red" },
    { count: incompleteDays, label: copy.incompleteAttendance, href: `/${locale}/attendance?from=${dateFrom}&to=${dateTo}&status=incomplete`, tone: "red" },
    { count: overdueInstallments, label: copy.overdueInstallments, href: `/${locale}/loans`, tone: "amber" },
    { count: unreadAnnouncements, label: copy.unreadAnnouncements, href: `/${locale}/announcements`, tone: "blue" },
  ].filter((item) => item.count > 0);

  const exportRows = [
    [copy.metric, copy.value],
    [copy.headcount, String(activeEmployees.length)],
    [copy.attendance, `${attendanceRate}%`],
    [copy.completeDays, String(completeDays)],
    [copy.late, hours(totalLate, locale)],
    [copy.overtime, hours(totalOvertime, locale)],
    [copy.approvedLeave, String(approvedLeave)],
    [copy.netPayroll, String(netPayroll)],
    [copy.approvedSales, String(approvedSales)],
    [copy.targetAchievement, `${targetRate}%`],
    [copy.loanExposure, String(loanExposure)],
    [copy.taskDelivery, `${taskRate}%`],
    [copy.readRate, `${readRate}%`],
    [],
    [copy.branch, copy.employees, copy.attendanceRate, copy.late, copy.approvedSales],
    ...branchScorecards.map((branch) => [branch.name, String(branch.employees), `${branch.attendance}%`, hours(branch.late, locale), String(branch.sales)]),
  ];

  return <>
    <div className="page-head report-page-head"><div><span className="eyebrow">{copy.executive}</span><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div>{canExport || membership.is_owner ? <AttendanceExportButton filename={`shiftly-management-report-${dateFrom}-${dateTo}.csv`} label={copy.export} rows={exportRows} /> : null}</div>

    <section className="card report-filter-card"><form className="report-filter" method="get"><div className="field"><label>{copy.from}</label><input className="input compact" defaultValue={dateFrom} name="from" type="date" /></div><div className="field"><label>{copy.to}</label><input className="input compact" defaultValue={dateTo} name="to" type="date" /></div><div className="field"><label>{copy.branch}</label><select className="select compact" defaultValue={requestedBranch} name="branch"><option value="">{copy.allBranches}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en}</option>)}</select></div><button className="button" type="submit">{copy.apply}</button><Link className="button ghost" href={`/${locale}/reports`}>{copy.clear}</Link></form></section>

    <section aria-label={copy.executive} className="report-kpi-grid section-gap">
      <Link className="report-kpi tone-blue" href={`/${locale}/employees${requestedBranch ? `?branch=${requestedBranch}` : ""}`}><span>{copy.headcount}</span><strong>{activeEmployees.length}</strong><small>{scopedEmployees.length} {copy.people}</small><i>↗</i></Link>
      <Link className="report-kpi tone-green" href={`/${locale}/attendance?from=${dateFrom}&to=${dateTo}${requestedBranch ? `&branch=${requestedBranch}` : ""}`}><span>{copy.attendance}</span><strong>{attendanceRate}%</strong><small>{completeDays}/{scheduledDays} {copy.days}</small><i>↗</i></Link>
      <Link className="report-kpi tone-violet" href={`/${locale}/payroll`}><span>{copy.payroll}</span><strong>{currency(netPayroll, locale)}</strong><small>{currency(grossPayroll, locale)} {copy.total.toLowerCase()}</small><i>↗</i></Link>
      <Link className="report-kpi tone-orange" href={`/${locale}/performance`}><span>{copy.sales}</span><strong>{currency(approvedSales, locale)}</strong><small>{targetRate}% {copy.versus}</small><i>↗</i></Link>
    </section>

    <section className="report-main-grid section-gap">
      <article className="card report-trend-card"><div className="card-heading"><div><h2>{copy.trends}</h2><p className="muted">{copy.trendsHelp}</p></div><span className="report-range-chip">{dateLabel(dateFrom, locale)} – {dateLabel(dateTo, locale)}</span></div><div className="report-trend-legend"><span><i className="trend-attendance" />{copy.attendanceRate}</span><span><i className="trend-sales" />{copy.approvedSales}</span></div><div className="report-trend-chart">{trend.map((item) => <div className="report-trend-column" key={item.from}><div className="report-trend-bars"><span className="attendance-bar" style={{ height: `${Math.max(3, item.attendance)}%` }} title={`${copy.attendanceRate}: ${item.attendance}%`} /><span className="sales-bar" style={{ height: `${Math.max(3, (item.sales / maxTrendSales) * 100)}%` }} title={`${copy.approvedSales}: ${currency(item.sales, locale)}`} /></div><small>{dateLabel(item.from, locale)}</small></div>)}</div></article>
      <article className="card report-health-card"><div className="card-heading"><div><h2>{copy.operationalHealth}</h2><p className="muted">{copy.period}</p></div></div><div className="health-ring" style={{ "--health-score": `${Math.round((attendanceRate + taskRate + readRate) / 3) * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round((attendanceRate + taskRate + readRate) / 3)}</strong><span>/100</span></div></div><div className="health-metrics"><Link href={`/${locale}/attendance?from=${dateFrom}&to=${dateTo}`}><span>{copy.attendance}</span><strong>{attendanceRate}%</strong></Link><Link href={`/${locale}/tasks`}><span>{copy.taskDelivery}</span><strong>{taskRate}%</strong></Link><Link href={`/${locale}/announcements`}><span>{copy.readRate}</span><strong>{readRate}%</strong></Link></div></article>
    </section>

    <section className="card report-scorecard section-gap"><div className="card-heading"><div><h2>{copy.branchScorecard}</h2><p className="muted">{copy.branchHelp}</p></div><Link className="text-link" href={`/${locale}/branches`}>{d.viewAll}</Link></div><div className="table-wrap"><table><thead><tr><th>{copy.branch}</th><th>{copy.employees}</th><th>{copy.attendanceRate}</th><th>{copy.late}</th><th>{copy.approvedSales}</th><th /></tr></thead><tbody>{branchScorecards.map((branch) => <tr key={branch.id}><td><strong>{branch.name}</strong></td><td>{branch.employees}</td><td><div className="score-cell"><span><i style={{ width: `${branch.attendance}%` }} /></span><strong>{branch.attendance}%</strong></div></td><td>{hours(branch.late, locale)}</td><td>{currency(branch.sales, locale)}</td><td><Link className="text-link" href={`/${locale}/reports?from=${dateFrom}&to=${dateTo}&branch=${branch.id}`}>{copy.open} →</Link></td></tr>)}</tbody></table>{!branchScorecards.length ? <div className="empty">{d.empty}</div> : null}</div></section>

    <section className="report-detail-grid section-gap">
      <article className="card report-metric-panel"><div className="card-heading"><div><h2>{copy.operationalHealth}</h2><p className="muted">{copy.period}</p></div></div><div className="report-metric-list"><Link href={`/${locale}/attendance?from=${dateFrom}&to=${dateTo}`}><span>{copy.late}</span><strong>{hours(totalLate, locale)}</strong></Link><Link href={`/${locale}/attendance?from=${dateFrom}&to=${dateTo}`}><span>{copy.overtime}</span><strong>{hours(totalOvertime, locale)}</strong></Link><Link href={`/${locale}/leaves`}><span>{copy.leave}</span><strong>{approvedLeave}</strong></Link><Link href={`/${locale}/tasks`}><span>{copy.taskDelivery}</span><strong>{taskApproved}/{assignments.length}</strong></Link></div></article>
      <article className="card report-metric-panel"><div className="card-heading"><div><h2>{copy.finance}</h2><p className="muted">{copy.period}</p></div></div><div className="report-metric-list"><Link href={`/${locale}/payroll`}><span>{copy.netPayroll}</span><strong>{currency(netPayroll, locale)}</strong></Link><Link href={`/${locale}/performance`}><span>{copy.targetAchievement}</span><strong>{targetRate}%</strong></Link><Link href={`/${locale}/loans`}><span>{copy.loanExposure}</span><strong>{currency(loanExposure, locale)}</strong></Link><Link href={`/${locale}/requests`}><span>{copy.pending}</span><strong>{pendingRequests}</strong></Link></div></article>
      <article className="card report-action-panel"><div className="card-heading"><div><h2>{copy.actionCenter}</h2><p className="muted">{copy.actionHelp}</p></div></div><div className="report-risk-list">{risks.map((risk) => <Link className={`report-risk risk-${risk.tone}`} href={risk.href} key={risk.label}><span>{risk.count}</span><strong>{risk.label}</strong><i>→</i></Link>)}{!risks.length ? <div className="empty">{copy.noRisks}</div> : null}</div></article>
    </section>
  </>;
}
