import Link from "next/link";
import { createEmployee } from "../actions";
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
        <p className="muted">{employees?.length ?? 0} {d.employees.toLowerCase()}</p>
      </div>
    </div>

    <div className="employees-content">
    <section className="card stack employee-create-panel">
      <h2>{d.add} {d.employee}</h2>
      <form action={action} className="form-grid three-columns">
        <div className="field"><label>{d.code}</label><input className="input" name="employeeCode" required /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field"><label>{d.position}</label><input className="input" name="position" /></div>
        <div className="field"><label>{d.email}</label><input className="input" name="email" type="email" /></div>
        <div className="field"><label>{d.phone}</label><input className="input" name="phone" /></div>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId"><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.team}</label><select className="select" name="teamId"><option value="">—</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}</select></div>
        <div className="field"><label>{d.manager}</label><select className="select" name="managerEmployeeId"><option value="">—</option>{managers?.map((m) => <option key={m.id} value={m.id}>{m.name_en}</option>)}</select></div>
        <div className="field"><label>{d.hireDate}</label><input className="input" name="hireDate" type="date" /></div>
        <div className="field"><label>{d.preferredLanguage}</label><select className="select" name="preferredLocale"><option value="en">English</option><option value="ar">العربية</option></select></div>
        <div className="field"><label>{d.statusLabel}</label><select className="select" name="status"><option value="active">{d.active}</option><option value="inactive">{d.inactive}</option><option value="on_leave">{d.onLeave}</option><option value="terminated">{d.terminated}</option></select></div>
        <div className="field"><label>{d.accessRole}</label><select className="select" defaultValue={defaultRoleId} name="roleId" required>{roles?.map((role) => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")}</option>)}</select><small className="muted">{d.accessRoleHelp}</small></div>
        <div className="field full"><label>{d.notes}</label><textarea className="input" name="notes" rows={2} /></div>
        <div className="full"><button className="button">{d.add}</button></div>
      </form>
    </section>

    <section className="card stack section-gap employee-directory">
      <form className="toolbar" method="get">
        <input className="input compact" name="q" defaultValue={filters.q} placeholder={`${d.search}…`} />
        <select className="select compact" name="branch" defaultValue={filters.branch ?? ""}><option value="">{d.allBranches}</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select>
        <select className="select compact" name="team" defaultValue={filters.team ?? ""}><option value="">{d.allTeams}</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}</select>
        <select className="select compact" name="status" defaultValue={filters.status ?? ""}><option value="">{d.allStatuses}</option><option value="active">{d.active}</option><option value="inactive">{d.inactive}</option><option value="on_leave">{d.onLeave}</option><option value="terminated">{d.terminated}</option></select>
        <button className="button">{d.search}</button>
        <Link className="button ghost" href={`/${locale}/employees`}>{d.clear}</Link>
      </form>
      <div className="table-wrap desktop-only"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.position}</th><th>{d.branch}</th><th>{d.team}</th><th>{d.accessRoles}</th><th>{d.statusLabel}</th><th>{d.actions}</th></tr></thead><tbody>
        {employees?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const roleNames = (row.employee_role_assignments ?? []).flatMap((assignment) => {
            const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
            return role?.name ? [role.name] : [];
          });
          return <tr key={row.id}>
            <td className="code">{row.employee_code}</td>
            <td><strong>{locale === "ar" && row.name_ar ? row.name_ar : row.name_en}</strong></td>
            <td>{row.position ?? "—"}</td>
            <td>{branch?.name_en ?? "—"}</td>
            <td>{team?.name_en ?? "—"}</td>
            <td><div className="role-badges">{roleNames.length ? roleNames.map((name) => <span className="badge" key={name}>{name}</span>) : <span className="muted">{d.noRoles}</span>}</div></td>
            <td><span className={`badge status-${row.status}`}>{statusText(row.status, d)}</span></td>
            <td><Link className="text-link" href={`/${locale}/employees/${row.id}`}>{d.edit}</Link></td>
          </tr>;
        })}
      </tbody></table>{!employees?.length ? <div className="empty">{d.empty}</div> : null}</div>
      <div className="mobile-only employee-card-list">
        {employees?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const roleNames = (row.employee_role_assignments ?? []).flatMap((assignment) => {
            const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
            return role?.name ? [role.name] : [];
          });
          return <article className="employee-card" key={row.id}>
            <div className="employee-card-head">
              <div><strong>{locale === "ar" && row.name_ar ? row.name_ar : row.name_en}</strong><div className="muted code">{row.employee_code}</div></div>
              <span className={`badge status-${row.status}`}>{statusText(row.status, d)}</span>
            </div>
            <div className="employee-card-meta">
              <span>{row.position ?? d.noPosition}</span>
              <span>{branch?.name_en ?? d.allBranches}</span>
              {team?.name_en ? <span>{team.name_en}</span> : null}
            </div>
            <div className="role-badges">{roleNames.length ? roleNames.map((name) => <span className="badge" key={name}>{name}</span>) : <span className="muted">{d.noRoles}</span>}</div>
            <Link className="button ghost full-width" href={`/${locale}/employees/${row.id}`}>{d.manageEmployee}</Link>
          </article>;
        })}
        {!employees?.length ? <div className="empty">{d.empty}</div> : null}
      </div>
    </section>
    </div>
  </>;
}
