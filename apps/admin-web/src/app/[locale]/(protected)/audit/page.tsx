import Link from "next/link";
import { getTenantPageContext } from "@/lib/page-context";

type JsonRecord = Record<string, unknown>;

const hiddenFields = new Set(["tenant_id", "created_at", "updated_at", "assigned_by", "created_by", "published_by", "locked_by"]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function changedValues(before: JsonRecord, after: JsonRecord) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.filter((key) => !hiddenFields.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; entity?: string; q?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, user, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;

  let auditQuery = supabase.from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_user_id, before_data, after_data, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.action) auditQuery = auditQuery.eq("action", filters.action);
  if (filters.entity) auditQuery = auditQuery.eq("entity_type", filters.entity);

  const [auditResult, employeesResult, branchesResult, teamsResult, rolesResult, membershipsResult] = await Promise.all([
    auditQuery,
    supabase.from("employees").select("id, user_id, employee_code, name_en, name_ar, position").eq("tenant_id", tenantId),
    supabase.from("branches").select("id, name_en, name_ar").eq("tenant_id", tenantId),
    supabase.from("teams").select("id, name_en, name_ar").eq("tenant_id", tenantId),
    supabase.from("roles").select("id, name").eq("tenant_id", tenantId),
    supabase.from("memberships").select("user_id, is_owner").eq("tenant_id", tenantId),
  ]);
  for (const result of [auditResult, employeesResult, branchesResult, teamsResult, rolesResult, membershipsResult]) {
    if (result.error) throw result.error;
  }

  const employees = employeesResult.data ?? [];
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeeByUser = new Map(employees.filter((employee) => employee.user_id).map((employee) => [employee.user_id!, employee]));
  const branchById = new Map((branchesResult.data ?? []).map((branch) => [branch.id, branch]));
  const teamById = new Map((teamsResult.data ?? []).map((team) => [team.id, team]));
  const roleById = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
  const ownerUserIds = new Set((membershipsResult.data ?? []).filter((entry) => entry.is_owner).map((entry) => entry.user_id));

  const entityLabels: Record<string, string> = {
    tenants: d.auditCompany,
    branches: d.auditBranch,
    teams: d.auditTeam,
    employees: d.auditEmployee,
    roles: d.auditRole,
    role_permissions: d.auditRolePermissions,
    employee_role_assignments: d.auditEmployeeRole,
    memberships: d.auditMembership,
    employee_assignments: d.auditAssignment,
    shift_templates: d.auditShift,
    weekly_schedules: d.auditSchedule,
    schedule_entries: d.auditScheduleEntry,
  };

  const recordName = (record: JsonRecord) => {
    const preferredName = locale === "ar" ? record.name_ar : record.name_en;
    return typeof preferredName === "string" && preferredName ? preferredName : typeof record.name_en === "string" ? record.name_en : null;
  };

  const employeeName = (id: unknown) => {
    if (typeof id !== "string") return null;
    const employee = employeeById.get(id);
    return employee ? (locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en) : null;
  };

  const actorDetails = (actorUserId: string | null) => {
    if (!actorUserId) return { name: d.systemAutomation, href: null as string | null, subtitle: d.automaticEvent };
    const employee = employeeByUser.get(actorUserId);
    if (employee) return {
      name: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en,
      href: `/${locale}/employees/${employee.id}`,
      subtitle: employee.position ?? employee.employee_code,
    };
    if (ownerUserIds.has(actorUserId)) return { name: d.companyOwner, href: null, subtitle: d.ownerAccount };
    if (actorUserId === user.id) return { name: user.user_metadata.full_name ?? d.companyUser, href: null, subtitle: d.currentUser };
    return { name: d.companyUser, href: null, subtitle: d.userAccount };
  };

  const entityDetails = (row: NonNullable<typeof auditResult.data>[number]) => {
    const before = asRecord(row.before_data);
    const after = asRecord(row.after_data);
    const record = Object.keys(after).length ? after : before;
    const type = row.entity_type;
    let name = recordName(record) ?? entityLabels[type] ?? humanize(type);
    let href: string | null = null;

    if (type === "employees") {
      const employeeId = row.entity_id ?? String(record.id ?? "");
      name = employeeName(employeeId) ?? name;
      if (employeeId) href = `/${locale}/employees/${employeeId}`;
    } else if (["employee_role_assignments", "employee_assignments"].includes(type)) {
      const employeeId = String(record.employee_id ?? "");
      name = employeeName(employeeId) ?? name;
      if (employeeId) href = `/${locale}/employees/${employeeId}`;
    } else if (type === "role_permissions" || type === "roles") {
      const roleId = type === "roles" ? String(record.id ?? row.entity_id ?? "") : String(record.role_id ?? row.entity_id ?? "");
      const role = roleById.get(roleId);
      name = role ? humanize(role.name) : typeof record.role_name === "string" ? humanize(record.role_name) : name;
      if (roleId) href = `/${locale}/roles/${roleId}`;
    } else if (type === "branches") {
      href = `/${locale}/branches`;
    } else if (type === "teams") {
      href = `/${locale}/teams`;
    } else if (type === "shift_templates") {
      href = `/${locale}/shifts`;
    } else if (type === "weekly_schedules") {
      const scheduleId = String(record.id ?? row.entity_id ?? "");
      name = typeof record.week_start === "string" ? `${d.weekOf} ${record.week_start}` : name;
      if (scheduleId) href = `/${locale}/schedules/${scheduleId}`;
    } else if (type === "schedule_entries") {
      const scheduleId = String(record.schedule_id ?? "");
      name = `${employeeName(record.employee_id) ?? d.auditScheduleEntry}${typeof record.work_date === "string" ? ` · ${record.work_date}` : ""}`;
      if (scheduleId) href = `/${locale}/schedules/${scheduleId}`;
    }
    return { label: entityLabels[type] ?? humanize(type), name, href, before, after };
  };

  const friendlyValue = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return d.notSet;
    if (field === "employee_id" || field === "manager_employee_id") return employeeName(value) ?? d.employeeAccount;
    if (field === "branch_id" && typeof value === "string") {
      const branch = branchById.get(value); return branch ? (locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en) : d.notSet;
    }
    if (field === "team_id" && typeof value === "string") {
      const team = teamById.get(value); return team ? (locale === "ar" && team.name_ar ? team.name_ar : team.name_en) : d.notSet;
    }
    if (field === "role_id" && typeof value === "string") return roleById.has(value) ? humanize(roleById.get(value)!.name) : d.roleName;
    if (field === "permission_keys" && Array.isArray(value)) return value.map((entry) => humanize(String(entry))).join(", ") || d.none;
    if (field.endsWith("_id") || field === "user_id") return d.linkedRecord;
    if (typeof value === "boolean") return value ? d.yes : d.no;
    if (Array.isArray(value)) return value.map(String).join(", ");
    if (typeof value === "object") return d.updatedDetails;
    return humanize(String(value));
  };

  const actionLabel = (action: string) => action === "insert" ? d.created : action === "delete" ? d.removed : d.updated;
  const rawRows = auditResult.data ?? [];
  const rows = rawRows.map((row) => ({ row, actor: actorDetails(row.actor_user_id), entity: entityDetails(row) })).filter((entry) => {
    const query = filters.q?.trim().toLowerCase();
    if (!query) return true;
    return `${entry.actor.name} ${entry.entity.label} ${entry.entity.name} ${entry.row.action}`.toLowerCase().includes(query);
  });
  const entityTypes = [...new Set(rawRows.map((row) => row.entity_type))].sort();

  return <>
    <div className="page-head"><div><h1 className="page-title">{d.auditActivityTitle}</h1><p className="muted">{d.auditActivityHelp}</p></div></div>

    <section className="audit-summary-grid">
      <div><strong>{rows.length}</strong><span>{d.eventsShown}</span></div>
      <div><strong>{rows.filter((entry) => entry.row.action === "insert").length}</strong><span>{d.created}</span></div>
      <div><strong>{rows.filter((entry) => entry.row.action === "update").length}</strong><span>{d.updated}</span></div>
      <div><strong>{rows.filter((entry) => entry.row.action === "delete").length}</strong><span>{d.removed}</span></div>
    </section>

    <form className="card toolbar audit-filters" method="get">
      <input className="input compact" defaultValue={filters.q ?? ""} name="q" placeholder={d.searchActivity} />
      <select className="select compact" defaultValue={filters.action ?? ""} name="action"><option value="">{d.allActions}</option><option value="insert">{d.created}</option><option value="update">{d.updated}</option><option value="delete">{d.removed}</option></select>
      <select className="select compact" defaultValue={filters.entity ?? ""} name="entity"><option value="">{d.allActivityTypes}</option>{entityTypes.map((type) => <option key={type} value={type}>{entityLabels[type] ?? humanize(type)}</option>)}</select>
      <button className="button">{d.applyFilters}</button><Link className="button ghost" href={`/${locale}/audit`}>{d.clear}</Link>
    </form>

    <section className="audit-timeline">
      {rows.map(({ row, actor, entity }) => {
        const changes = changedValues(entity.before, entity.after);
        return <article className="card audit-event" key={row.id}>
          <div className="audit-actor-column">
            <span className="person-avatar">{actor.name.slice(0, 1).toUpperCase()}</span>
            <div>{actor.href ? <Link className="text-link" href={actor.href}>{actor.name}</Link> : <strong>{actor.name}</strong>}<small>{actor.subtitle}</small></div>
          </div>
          <div className="audit-event-main">
            <div className="audit-event-heading"><div><span className={`badge audit-action-${row.action}`}>{actionLabel(row.action)}</span><span className="audit-sentence">{actionLabel(row.action)} {entity.label.toLowerCase()} {entity.href ? <Link className="text-link" href={entity.href}>{entity.name}</Link> : <strong>{entity.name}</strong>}</span></div><time>{new Date(row.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time></div>
            {changes.length ? <details className="audit-change-details"><summary>{changes.length} {changes.length === 1 ? d.fieldChanged : d.fieldsChanged}</summary><div className="audit-change-list">
              {changes.map((field) => <div className="audit-change-row" key={field}><strong>{field === "permission_keys" ? d.capabilities : humanize(field)}</strong><span className="audit-old-value">{friendlyValue(field, entity.before[field])}</span><span aria-hidden="true">→</span><span className="audit-new-value">{friendlyValue(field, entity.after[field])}</span></div>)}
            </div></details> : <p className="muted audit-no-details">{d.noFieldChanges}</p>}
          </div>
        </article>;
      })}
      {!rows.length ? <div className="card empty">{d.noMatchingActivity}</div> : null}
    </section>
  </>;
}
