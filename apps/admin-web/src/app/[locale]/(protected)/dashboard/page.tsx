import Link from "next/link";
import { CompanyOnboarding } from "@/components/company-onboarding";
import { OverflowTooltip } from "@/components/overflow-tooltip";
import { InsightBars } from "@/components/insight-bars";
import { getActiveMembership, requireUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

const statusColors: Record<string, string> = {
  active: "#2357d9",
  on_leave: "#8b5cf6",
  inactive: "#f59e0b",
  terminated: "#94a3b8",
};

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const d = getDictionary(locale);
  const { supabase, user } = await requireUser(locale);
  const membership = await getActiveMembership(user.id);

  if (!membership) return <CompanyOnboarding locale={locale} labels={d} />;
  const tenantId = membership.tenant_id;
  const today = new Date();
  const dateTo = today.toISOString().slice(0, 10);
  const pulseStart = new Date(today.getTime() - 29 * 86_400_000);
  const dateFrom = pulseStart.toISOString().slice(0, 10);
  const rangeStart = `${dateFrom}T00:00:00.000Z`;
  const [branchesResult, teamsResult, employeesResult, ownersResult, schedulesResult, shiftsResult, attendanceResult, leaveResult, requestsResult, tasksResult, salesResult] = await Promise.all([
    supabase.from("branches").select("id, name_en, name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("employees").select("id, branch_id, status").eq("tenant_id", tenantId),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_owner", true).eq("status", "active"),
    supabase.from("weekly_schedules").select("id, status").eq("tenant_id", tenantId),
    supabase.from("shift_templates").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("attendance_days").select("status,missing_minutes").eq("tenant_id", tenantId).gte("work_date", dateFrom).lte("work_date", dateTo),
    supabase.from("leave_requests").select("status").eq("tenant_id", tenantId).gte("created_at", rangeStart),
    supabase.from("hr_requests").select("status").eq("tenant_id", tenantId).gte("submitted_at", rangeStart),
    supabase.from("tasks").select("status,due_at").eq("tenant_id", tenantId).gte("created_at", rangeStart),
    supabase.from("sales_entries").select("status").eq("tenant_id", tenantId).gte("business_date", dateFrom).lte("business_date", dateTo),
  ]);

  for (const result of [branchesResult, teamsResult, employeesResult, ownersResult, schedulesResult, shiftsResult, attendanceResult, leaveResult, requestsResult, tasksResult, salesResult]) {
    if (result.error) throw result.error;
  }

  const branches = branchesResult.data ?? [];
  const employees = employeesResult.data ?? [];
  const schedules = schedulesResult.data ?? [];
  const activeEmployees = employees.filter((employee) => employee.status === "active").length;
  const attendanceRows = attendanceResult.data ?? [];
  const taskRows = tasksResult.data ?? [];
  const attendanceComplete = attendanceRows.filter((row) => ["present", "late"].includes(row.status)).length;
  const attendanceExceptions = attendanceRows.filter((row) => ["absent", "incomplete"].includes(row.status) || row.missing_minutes > 0).length;
  const leaveApproved = (leaveResult.data ?? []).filter((row) => row.status === "approved").length;
  const tasksDelivered = taskRows.filter((row) => row.status === "approved").length;
  const pendingRequests = (requestsResult.data ?? []).filter((row) => !["approved", "rejected", "cancelled"].includes(row.status)).length;
  const overdueTasks = taskRows.filter((row) => !["approved", "cancelled"].includes(row.status) && new Date(row.due_at) < today).length;
  const pendingSales = (salesResult.data ?? []).filter((row) => row.status === "submitted").length;
  const pulseCopy = locale === "ar" ? {
    title: "نبض عمليات الموظفين", subtitle: `آخر 30 يومًا · ${dateFrom} إلى ${dateTo}`,
    attendance: "أيام حضور مكتملة", leave: "إجازات معتمدة", tasks: "مهام منجزة", exceptions: "استثناءات حضور",
    actions: "قائمة الإجراءات", actionsHelp: "بنود تحتاج مراجعة إدارية الآن.", requests: "طلبات معلقة", overdue: "مهام متأخرة", sales: "مبيعات بانتظار المراجعة", incomplete: "حضور غير مكتمل",
  } : {
    title: "People operations pulse", subtitle: `Last 30 days · ${dateFrom} to ${dateTo}`,
    attendance: "Completed attendance days", leave: "Approved leave", tasks: "Tasks delivered", exceptions: "Attendance exceptions",
    actions: "Action queue", actionsHelp: "Items that need management review now.", requests: "Pending requests", overdue: "Overdue tasks", sales: "Sales awaiting review", incomplete: "Incomplete attendance",
  };

  const stats = [
    { label: d.totalEmployees, value: employees.length, detail: `${activeEmployees} ${d.active.toLowerCase()}`, href: `/${locale}/employees`, accent: "blue" },
    { label: d.totalBranches, value: branches.length, detail: d.openDirectory, href: `/${locale}/branches`, accent: "green" },
    { label: d.totalTeams, value: teamsResult.count ?? 0, detail: d.openDirectory, href: `/${locale}/teams`, accent: "violet" },
    { label: d.totalOwners, value: ownersResult.count ?? 0, detail: d.viewProfile, href: `/${locale}/profiles/${user.id}`, accent: "orange" },
  ];

  const branchDistribution = branches.map((branch) => ({
    id: branch.id,
    name: locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en,
    count: employees.filter((employee) => employee.branch_id === branch.id).length,
  }));
  const unassignedCount = employees.filter((employee) => !employee.branch_id).length;
  if (unassignedCount) branchDistribution.push({ id: "", name: d.unassigned, count: unassignedCount });
  const largestBranch = Math.max(1, ...branchDistribution.map((branch) => branch.count));

  const employeeStatuses = [
    { key: "active", label: d.active },
    { key: "on_leave", label: d.onLeave },
    { key: "inactive", label: d.inactive },
    { key: "terminated", label: d.terminated },
  ].map((status) => ({
    ...status,
    count: employees.filter((employee) => employee.status === status.key).length,
  }));
  const totalEmployees = Math.max(1, employees.length);
  let currentAngle = 0;
  const donutStops = employeeStatuses.map((status) => {
    const start = currentAngle;
    currentAngle += (status.count / totalEmployees) * 360;
    return `${statusColors[status.key]} ${start}deg ${currentAngle}deg`;
  });

  const scheduleStatuses = [
    { key: "draft", label: d.draft },
    { key: "published", label: d.published },
    { key: "locked", label: d.locked },
    { key: "archived", label: d.archived },
  ].map((status) => ({
    ...status,
    count: schedules.filter((schedule) => schedule.status === status.key).length,
  }));

  const quickLinks = [
    { label: d.employees, detail: d.employeeDirectory, href: `/${locale}/employees` },
    { label: d.shifts, detail: `${shiftsResult.count ?? 0} ${d.active.toLowerCase()}`, href: `/${locale}/shifts` },
    { label: d.schedules, detail: `${schedules.length} ${d.scheduledWeeks}`, href: `/${locale}/schedules` },
    { label: d.attendance, detail: locale === "ar" ? "الحضور والتأخير والإضافي" : "Punches, lateness, and overtime", href: `/${locale}/attendance` },
    { label: d.leaves, detail: locale === "ar" ? "الطلبات والتقويم" : "Requests and calendar", href: `/${locale}/leaves` },
    { label: d.payroll, detail: locale === "ar" ? "الحساب والاعتماد والقسائم" : "Calculation, approvals, and payslips", href: `/${locale}/payroll` },
    { label: d.loans, detail: locale === "ar" ? "الطلبات والأقساط والتسويات" : "Requests, installments, and settlements", href: `/${locale}/loans` },
    { label: d.performance, detail: locale === "ar" ? "المبيعات والأهداف والمكافآت" : "Sales, targets, and incentives", href: `/${locale}/performance` },
    { label: d.tasks, detail: locale === "ar" ? "الإسناد والإثبات والاعتماد" : "Assignments, evidence, and approvals", href: `/${locale}/tasks` },
    { label: d.announcements, detail: locale === "ar" ? "التواصل وتأكيد القراءة" : "Targeted communication and read receipts", href: `/${locale}/announcements` },
    { label: d.reports, detail: locale === "ar" ? "\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0642\u0648\u0649 \u0627\u0644\u0639\u0627\u0645\u0644\u0629 \u0648\u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0648\u0627\u0644\u0623\u062f\u0627\u0621" : "Workforce, cost, and performance insights", href: `/${locale}/reports` },
    { label: d.roles, detail: d.manageAccess, href: `/${locale}/roles` },
    { label: d.audit, detail: d.reviewChanges, href: `/${locale}/audit` },
  ];

  return (
    <>
      <div className="page-head dashboard-head">
        <div><h1 className="page-title">{d.welcome}</h1><p className="muted">{d.dashboardOverview}</p></div>
        <Link className="button" href={`/${locale}/schedules`}>{d.openSchedules}</Link>
      </div>

      <section className="dashboard-stat-grid" aria-label={d.companySnapshot}>
        {stats.map((stat) => <Link className={`dashboard-stat dashboard-link stat-accent-${stat.accent}`} href={stat.href} key={stat.label}>
          <div><span className="dashboard-stat-label">{stat.label}</span><strong className="stat-value">{stat.value}</strong><small>{stat.detail}</small></div>
          <span aria-hidden="true" className="dashboard-arrow">→</span>
        </Link>)}
      </section>

      <section className="dashboard-chart-grid">
        <article className="card dashboard-panel branch-panel">
          <div className="card-heading"><div><h2>{d.workforceByBranch}</h2><p className="muted">{d.clickChartHint}</p></div><Link className="text-link" href={`/${locale}/branches`}>{d.viewAll}</Link></div>
          <div className="branch-chart">
            {branchDistribution.map((branch) => <Link className="branch-bar-row dashboard-link" href={branch.id ? `/${locale}/employees?branch=${branch.id}` : `/${locale}/employees`} key={branch.id || "unassigned"}>
              <OverflowTooltip className="branch-bar-label" text={branch.name} />
              <span className="branch-bar-track"><span className="branch-bar-fill" style={{ width: `${Math.max(5, (branch.count / largestBranch) * 100)}%` }} /></span>
              <strong>{branch.count}</strong>
            </Link>)}
            {!branchDistribution.length ? <div className="empty">{d.empty}</div> : null}
          </div>
        </article>

        <article className="card dashboard-panel status-panel">
          <div className="card-heading"><div><h2>{d.employeeStatus}</h2><p className="muted">{d.currentWorkforce}</p></div><Link className="text-link" href={`/${locale}/employees`}>{d.viewAll}</Link></div>
          <div className="status-chart-layout">
            <div className="donut-chart" style={{ background: employees.length ? `conic-gradient(${donutStops.join(", ")})` : "#e2e8f0" }}>
              <div className="donut-center"><strong>{employees.length}</strong><span>{d.totalEmployees}</span></div>
            </div>
            <div className="chart-legend">
              {employeeStatuses.map((status) => <Link className="legend-row dashboard-link" href={`/${locale}/employees?status=${status.key}`} key={status.key}>
                <span className="legend-dot" style={{ background: statusColors[status.key] }} /><span>{status.label}</span><strong>{status.count}</strong>
              </Link>)}
            </div>
          </div>
        </article>
      </section>

      <section className="card dashboard-panel schedule-panel">
        <div className="card-heading"><div><h2>{d.scheduleOverview}</h2><p className="muted">{d.scheduleOverviewHelp}</p></div><Link className="text-link" href={`/${locale}/schedules`}>{d.viewAll}</Link></div>
        <div className="schedule-stat-grid">
          {scheduleStatuses.map((status) => <Link className={`schedule-stat dashboard-link status-${status.key}`} href={`/${locale}/schedules`} key={status.key}>
            <span>{status.label}</span><strong>{status.count}</strong><small>{d.openDirectory} →</small>
          </Link>)}
        </div>
      </section>

      <section className="dashboard-chart-grid" aria-label={pulseCopy.title}>
        <InsightBars
          items={[
            { label: pulseCopy.attendance, value: attendanceComplete, color: "#315bea", href: `/${locale}/attendance` },
            { label: pulseCopy.tasks, value: tasksDelivered, color: "#27a58b", href: `/${locale}/tasks` },
            { label: pulseCopy.leave, value: leaveApproved, color: "#8b5cf6", href: `/${locale}/leaves` },
            { label: pulseCopy.exceptions, value: attendanceExceptions, color: "#e28b32", href: `/${locale}/attendance` },
          ]}
          subtitle={pulseCopy.subtitle}
          title={pulseCopy.title}
        />
        <InsightBars
          items={[
            { label: pulseCopy.requests, value: pendingRequests, color: "#526ed7", href: `/${locale}/requests` },
            { label: pulseCopy.overdue, value: overdueTasks, color: "#d2544c", href: `/${locale}/tasks` },
            { label: pulseCopy.sales, value: pendingSales, color: "#d68b2d", href: `/${locale}/performance` },
            { label: pulseCopy.incomplete, value: attendanceExceptions, color: "#8b5cf6", href: `/${locale}/attendance` },
          ]}
          subtitle={pulseCopy.actionsHelp}
          title={pulseCopy.actions}
        />
      </section>

      <section className="dashboard-quick-section">
        <div className="card-heading"><div><h2>{d.quickActions}</h2><p className="muted">{d.quickActionsHelp}</p></div></div>
        <div className="quick-link-grid">
          {quickLinks.map((link) => <Link className="quick-link-card dashboard-link" href={link.href} key={link.href}>
            <div><strong>{link.label}</strong><span>{link.detail}</span></div><span aria-hidden="true" className="dashboard-arrow">→</span>
          </Link>)}
        </div>
      </section>
    </>
  );
}
