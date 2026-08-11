import Link from "next/link";
import { createRole } from "../actions";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";

function displayRoleName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;

  const [{ data: roles, error }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id, name, description, is_system, role_permissions(permission_key), employee_role_assignments(employee_id, employees(id, user_id, name_en, name_ar, position)), membership_roles(membership_id, memberships(id, user_id, is_owner, status))").eq("tenant_id", membership.tenant_id).order("is_system", { ascending: false }).order("name"),
    supabase.from("permissions").select("key, description, module").order("module").order("key"),
  ]);
  if (error) throw error;
  if (permissionsError) throw permissionsError;

  const accountUserIds = [...new Set((roles ?? []).flatMap((role) => role.membership_roles.flatMap((assignment) => {
    const account = Array.isArray(assignment.memberships) ? assignment.memberships[0] : assignment.memberships;
    return account?.user_id ? [account.user_id] : [];
  })))];
  const { data: accountProfiles, error: profileError } = accountUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", accountUserIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileById = new Map((accountProfiles ?? []).map((profile) => [profile.id, profile]));

  const permissionByKey = new Map((permissions ?? []).map((permission) => [permission.key, permission]));
  const createAction = createRole.bind(null, locale, membership.tenant_id);

  return <>
    <div className="page-head role-page-head">
      <div><h1 className="page-title">{d.roleManagementTitle}</h1><p className="muted">{d.roleManagementHelp}</p></div>
      <CreateDialog closeLabel={d.close} description={d.roleManagementHelp} eyebrow={d.roles} title={d.createCustomRole} triggerLabel={d.createCustomRole} width="medium">
        <ActionForm action={createAction} className="stack role-create-form" errorMessage={d.actionFailed} pendingMessage={d.saving} resetOnSuccess successMessage={d.roleCreated}>
          <div className="field"><label>{d.roleName}</label><input className="input" name="name" placeholder={d.roleNamePlaceholder} required /></div>
          <div className="field"><label>{d.roleDescription}</label><textarea className="input" name="description" rows={3} /></div>
          <button className="button">{d.createRole}</button>
        </ActionForm>
      </CreateDialog>
    </div>

    <section className="role-summary-grid">
      <div className="role-summary-card"><strong>{roles?.length ?? 0}</strong><span>{d.roles}</span></div>
      <div className="role-summary-card"><strong>{permissions?.length ?? 0}</strong><span>{d.availableCapabilities}</span></div>
      <div className="role-summary-card"><strong>{roles?.reduce((total, role) => total + role.employee_role_assignments.length + role.membership_roles.length, 0) ?? 0}</strong><span>{d.assignedPeople}</span></div>
    </section>

    <section className="role-management-grid">
      {roles?.map((role) => {
        const assignedEmployees = role.employee_role_assignments.flatMap((assignment) => {
          const employee = Array.isArray(assignment.employees) ? assignment.employees[0] : assignment.employees;
          return employee ? [employee] : [];
        });
        const linkedEmployeeUsers = new Set(assignedEmployees.flatMap((employee) => employee.user_id ? [employee.user_id] : []));
        const assignedAccounts = role.membership_roles.flatMap((assignment) => {
          const account = Array.isArray(assignment.memberships) ? assignment.memberships[0] : assignment.memberships;
          if (!account?.user_id || account.status === "revoked" || linkedEmployeeUsers.has(account.user_id)) return [];
          return [{ ...account, profile: profileById.get(account.user_id) }];
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
            <div><strong>{d.assignedPeople}</strong><span className="muted">{assignedEmployees.length + assignedAccounts.length}</span></div>
            <div className="role-people-links">
              {assignedEmployees.slice(0, 4).map((employee) => <Link href={`/${locale}/employees/${employee.id}`} key={employee.id}>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</Link>)}
              {assignedAccounts.slice(0, Math.max(0, 4 - assignedEmployees.length)).map((account) => <Link href={`/${locale}/profiles/${account.user_id}`} key={account.id}>{account.profile?.full_name ?? d.ownerAccount}</Link>)}
              {!assignedEmployees.length && !assignedAccounts.length ? <span className="muted">{d.noAssignedPeople}</span> : null}
            </div>
          </div>
          <Link className="button secondary full-width" href={`/${locale}/roles/${role.id}`}>{isProtected ? d.viewPermissions : d.customizePermissions}</Link>
        </article>;
      })}
      {!roles?.length ? <div className="empty">{d.empty}</div> : null}
    </section>
  </>;
}
