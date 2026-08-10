import Link from "next/link";
import { createEmployee } from "../actions";
import { EmployeeCreateDialog } from "@/components/employee-create-dialog";
import { OverflowTooltip } from "@/components/overflow-tooltip";
import { getTenantPageContext } from "@/lib/page-context";

function statusText(status: string, d: ReturnType<typeof import("@/lib/i18n").getDictionary>) {
  if (status === "inactive") return d.inactive;
  if (status === "on_leave") return d.onLeave;
  if (status === "terminated") return d.terminated;
  return d.active;
}

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; branch?: string; team?: string; status?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;

  let employeeQuery = supabase
    .from("employees")
    .select("id, employee_code, name_en, name_ar, email, phone, position, status, hire_date, preferred_locale, branches(name_en), teams(name_en), employee_role_assignments(role_id, roles(name))")
    .eq("tenant_id", tenantId)
    .order("name_en");
  if (filters.q?.trim()) employeeQuery = employeeQuery.or(`employee_code.ilike.%${filters.q.trim()}%,name_en.ilike.%${filters.q.trim()}%,name_ar.ilike.%${filters.q.trim()}%`);
  if (filters.branch) employeeQuery = employeeQuery.eq("branch_id", filters.branch);
  if (filters.team) employeeQuery = employeeQuery.eq("team_id", filters.team);
  if (filters.status) employeeQuery = employeeQuery.eq("status", filters.status);

  const [
    { data: employees, error },
    { data: branches },
    { data: teams },
    { data: managers },
    { data: roles, error: rolesError },
  ] = await Promise.all([
    employeeQuery,
    supabase.from("branches").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("teams").select("id, name_en, branch_id").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("employees").select("id, name_en").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("roles").select("id, name").eq("tenant_id", tenantId).neq("name", "owner").order("name"),
  ]);
  if (error) throw error;
  if (rolesError) throw rolesError;
  const action = createEmployee.bind(null, locale, tenantId);
  const defaultRoleId = roles?.find((role) => role.name === "employee")?.id ?? roles?.[0]?.id;

  return <>
    <div className="page-head">
      <div>
        <h1 className="page-title">{d.employees}</h1>
        <p className="muted">{employees?.length ?? 0} {d.employees.toLowerCase()} · {d.employeeDirectory}</p>
      </div>
      <EmployeeCreateDialog
        action={action}
        branches={branches ?? []}
        defaultRoleId={defaultRoleId}
        labels={{
          addEmployee: d.addEmployee, addEmployeeHelp: d.addEmployeeHelp, employeeDirectory: d.employeeDirectory,
          close: d.close, cancel: d.cancel, code: d.code, nameEnglish: d.nameEnglish, nameArabic: d.nameArabic,
          position: d.position, email: d.email, phone: d.phone, branch: d.branch, teamOptional: d.teamOptional,
          noTeam: d.noTeam, teamOptionalHelp: d.teamOptionalHelp, noBranch: d.unassigned, manager: d.manager, noManager: d.none,
          hireDate: d.hireDate, preferredLanguage: d.preferredLanguage, statusLabel: d.statusLabel, active: d.active,
          inactive: d.inactive, onLeave: d.onLeave, terminated: d.terminated, accessRole: d.accessRole,
          accessRoleHelp: d.accessRoleHelp, notes: d.notes, actionFailed: d.actionFailed, saving: d.saving,
          employeeCreated: d.employeeCreated,
        }}
        managers={managers ?? []}
        roles={roles ?? []}
        teams={teams ?? []}
      />
    </div>

    <div className="employees-content">
    <section className="card stack employee-directory">
      <form className="toolbar" method="get">
        <input className="input compact" name="q" defaultValue={filters.q} placeholder={`${d.search}…`} />
        <select className="select compact" name="branch" defaultValue={filters.branch ?? ""}><option value="">{d.allBranches}</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select>
        <select className="select compact" name="team" defaultValue={filters.team ?? ""}><option value="">{d.allTeams}</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}</select>
        <select className="select compact" name="status" defaultValue={filters.status ?? ""}><option value="">{d.allStatuses}</option><option value="active">{d.active}</option><option value="inactive">{d.inactive}</option><option value="on_leave">{d.onLeave}</option><option value="terminated">{d.terminated}</option></select>
        <button className="button">{d.search}</button>
        <Link className="button ghost" href={`/${locale}/employees`}>{d.clear}</Link>
      </form>
      <div className="table-wrap"><table className="employee-table"><thead><tr><th className="employee-code-column">{d.code}</th><th>{d.nameEnglish}</th><th className="employee-optional-column">{d.position}</th><th className="employee-optional-column">{d.branch}</th><th>{d.team}</th><th className="employee-optional-column">{d.accessRoles}</th><th>{d.statusLabel}</th><th>{d.actions}</th></tr></thead><tbody>
        {employees?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const roleNames = (row.employee_role_assignments ?? []).flatMap((assignment) => {
            const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
            return role?.name ? [role.name] : [];
          });
          return <tr key={row.id}>
            <td className="code employee-code-column">{row.employee_code}</td>
            <td><Link className="employee-name-link" href={`/${locale}/employees/${row.id}`}><strong>{locale === "ar" && row.name_ar ? row.name_ar : row.name_en}</strong><small className="employee-code-inline code">{row.employee_code}</small></Link></td>
            <td className="employee-optional-column"><OverflowTooltip text={row.position ?? d.noPosition} /></td>
            <td className="employee-optional-column"><OverflowTooltip text={branch?.name_en ?? d.unassigned} /></td>
            <td><OverflowTooltip text={team?.name_en ?? d.notSet} /></td>
            <td className="employee-optional-column"><div className="role-badges">{roleNames.length ? roleNames.map((name) => <span className="badge" key={name}>{name}</span>) : <span className="muted">{d.noRoles}</span>}</div></td>
            <td><span className={`badge status-${row.status}`}>{statusText(row.status, d)}</span></td>
            <td><Link className="text-link" href={`/${locale}/employees/${row.id}`}>{d.edit}</Link></td>
          </tr>;
        })}
      </tbody></table>{!employees?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
    </div>
  </>;
}
