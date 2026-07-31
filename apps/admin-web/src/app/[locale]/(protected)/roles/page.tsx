import Link from "next/link";
import { createRole } from "../actions";
import { getTenantPageContext } from "@/lib/page-context";

function displayRoleName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;

  const [{ data: roles, error }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id, name, description, is_system, role_permissions(permission_key), employee_role_assignments(employee_id, employees(id, name_en, name_ar, position))").eq("tenant_id", membership.tenant_id).order("is_system", { ascending: false }).order("name"),
    supabase.from("permissions").select("key, description, module").order("module").order("key"),
  ]);
  if (error) throw error;
  if (permissionsError) throw permissionsError;

  const permissionByKey = new Map((permissions ?? []).map((permission) => [permission.key, permission]));
  const createAction = createRole.bind(null, locale, membership.tenant_id);

  return <>
    <div className="page-head role-page-head">
      <div><h1 className="page-title">{d.roleManagementTitle}</h1><p className="muted">{d.roleManagementHelp}</p></div>
      <details className="role-create-popover">
        <summary className="button">{d.createCustomRole}</summary>
        <form action={createAction} className="card stack role-create-form">
          <div className="field"><label>{d.roleName}</label><input className="input" name="name" placeholder={d.roleNamePlaceholder} required /></div>
          <div className="field"><label>{d.roleDescription}</label><textarea className="input" name="description" rows={3} /></div>
          <button className="button">{d.createRole}</button>
        </form>
      </details>
    </div>

    <section className="role-summary-grid">
      <div className="role-summary-card"><strong>{roles?.length ?? 0}</strong><span>{d.roles}</span></div>
      <div className="role-summary-card"><strong>{permissions?.length ?? 0}</strong><span>{d.availableCapabilities}</span></div>
      <div className="role-summary-card"><strong>{roles?.reduce((total, role) => total + role.employee_role_assignments.length, 0) ?? 0}</strong><span>{d.assignedEmployees}</span></div>
    </section>

    <section className="role-management-grid">
      {roles?.map((role) => {
        const assignedEmployees = role.employee_role_assignments.flatMap((assignment) => {
          const employee = Array.isArray(assignment.employees) ? assignment.employees[0] : assignment.employees;
          return employee ? [employee] : [];
        });
        const rolePermissions = role.role_permissions.map((entry) => permissionByKey.get(entry.permission_key)).filter(Boolean);
        const isProtected = role.name === "owner";
        return <article className="card role-management-card" key={role.id}>
          <div className="role-card-top">
            <div><div className="role-type-line"><span className={`badge ${role.is_system ? "role-system-badge" : "role-custom-badge"}`}>{role.is_system ? d.systemRole : d.customRole}</span>{isProtected ? <span className="badge role-protected-badge">{d.protectedRole}</span> : null}</div><h2>{displayRoleName(role.name)}</h2></div>
            <div className="role-permission-count"><strong>{rolePermissions.length}</strong><span>{d.capabilities}</span></div>
          </div>
          <p className="muted role-description">{role.description ?? d.noDescription}</p>
          <div className="role-capability-preview">
            <strong>{d.whatThisRoleCanDo}</strong>
            <ul>{rolePermissions.slice(0, 4).map((permission) => <li key={permission!.key}>{permission!.description}</li>)}</ul>
            {!rolePermissions.length ? <p className="muted">{d.noCapabilities}</p> : null}
            {rolePermissions.length > 4 ? <small className="muted">+{rolePermissions.length - 4} {d.moreCapabilities}</small> : null}
          </div>
          <div className="role-people-preview">
            <div><strong>{d.assignedPeople}</strong><span className="muted">{assignedEmployees.length}</span></div>
            <div className="role-people-links">
              {assignedEmployees.slice(0, 4).map((employee) => <Link href={`/${locale}/employees/${employee.id}`} key={employee.id}>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</Link>)}
              {!assignedEmployees.length ? <span className="muted">{d.noAssignedPeople}</span> : null}
            </div>
          </div>
          <Link className="button secondary full-width" href={`/${locale}/roles/${role.id}`}>{isProtected ? d.viewPermissions : d.customizePermissions}</Link>
        </article>;
      })}
      {!roles?.length ? <div className="empty">{d.empty}</div> : null}
    </section>
  </>;
}
