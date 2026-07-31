import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRoleDetails, updateRolePermissions } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { getTenantPageContext } from "@/lib/page-context";

function displayRoleName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function moduleTitle(module: string, d: ReturnType<typeof import("@/lib/i18n").getDictionary>) {
  const labels: Record<string, string> = {
    company: d.moduleCompany,
    access: d.moduleAccess,
    organization: d.moduleOrganization,
    employees: d.moduleEmployees,
    scheduling: d.moduleScheduling,
    governance: d.moduleGovernance,
    payroll: d.modulePayroll,
  };
  return labels[module] ?? module;
}

export default async function RoleDetailsPage({ params }: { params: Promise<{ locale: string; roleId: string }> }) {
  const { locale: rawLocale, roleId } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;

  const [{ data: role, error }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id, name, description, is_system, role_permissions(permission_key), employee_role_assignments(employee_id, employees(id, user_id, name_en, name_ar, position, employee_code)), membership_roles(membership_id, memberships(id, user_id, is_owner, status))").eq("tenant_id", membership.tenant_id).eq("id", roleId).maybeSingle(),
    supabase.from("permissions").select("key, description, module").order("module").order("key"),
  ]);
  if (error) throw error;
  if (permissionsError) throw permissionsError;
  if (!role) notFound();

  const assignedKeys = new Set(role.role_permissions.map((permission) => permission.permission_key));
  const groupedPermissions = new Map<string, NonNullable<typeof permissions>>();
  for (const permission of permissions ?? []) {
    const group = groupedPermissions.get(permission.module) ?? [];
    group.push(permission);
    groupedPermissions.set(permission.module, group);
  }
  const assignedEmployees = role.employee_role_assignments.flatMap((assignment) => {
    const employee = Array.isArray(assignment.employees) ? assignment.employees[0] : assignment.employees;
    return employee ? [employee] : [];
  });
  const linkedEmployeeUsers = new Set(assignedEmployees.flatMap((employee) => employee.user_id ? [employee.user_id] : []));
  const accountUserIds = [...new Set(role.membership_roles.flatMap((assignment) => {
    const account = Array.isArray(assignment.memberships) ? assignment.memberships[0] : assignment.memberships;
    return account?.user_id && !linkedEmployeeUsers.has(account.user_id) ? [account.user_id] : [];
  }))];
  const { data: accountProfiles, error: profileError } = accountUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", accountUserIds)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileById = new Map((accountProfiles ?? []).map((profile) => [profile.id, profile]));
  const assignedAccounts = role.membership_roles.flatMap((assignment) => {
    const account = Array.isArray(assignment.memberships) ? assignment.memberships[0] : assignment.memberships;
    if (!account?.user_id || account.status === "revoked" || linkedEmployeeUsers.has(account.user_id)) return [];
    return [{ ...account, profile: profileById.get(account.user_id) }];
  });
  const isProtected = role.name === "owner";
  const permissionsAction = updateRolePermissions.bind(null, locale, membership.tenant_id, role.id);
  const detailsAction = updateRoleDetails.bind(null, locale, membership.tenant_id, role.id);

  return <>
    <div className="page-head role-detail-head"><div><Link className="text-link" href={`/${locale}/roles`}>← {d.backToRoles}</Link><h1 className="page-title">{displayRoleName(role.name)}</h1><p className="muted">{role.description ?? d.noDescription}</p></div><span className={`badge ${role.is_system ? "role-system-badge" : "role-custom-badge"}`}>{role.is_system ? d.systemRole : d.customRole}</span></div>

    {isProtected ? <div className="notice role-protected-notice"><strong>{d.protectedRole}</strong><span>{d.protectedRoleHelp}</span></div> : null}

    {!role.is_system ? <details className="card role-details-editor"><summary>{d.editRoleDetails}</summary><ActionForm action={detailsAction} className="form-grid two-columns section-gap" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.roleUpdated}><div className="field"><label>{d.roleName}</label><input className="input" defaultValue={displayRoleName(role.name)} name="name" required /></div><div className="field"><label>{d.roleDescription}</label><input className="input" defaultValue={role.description ?? ""} name="description" /></div><div className="full"><button className="button">{d.save}</button></div></ActionForm></details> : null}

    <div className="role-detail-layout">
      <section className="role-permission-editor">
        <div className="card-heading"><div><h2>{d.capabilities}</h2><p className="muted">{d.capabilitiesHelp}</p></div><span className="badge">{assignedKeys.size} / {permissions?.length ?? 0}</span></div>
        <ActionForm action={permissionsAction} className="stack section-gap" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.permissionsUpdated}>
          {[...groupedPermissions.entries()].map(([module, modulePermissions]) => <fieldset className="card permission-module" key={module}>
            <legend>{moduleTitle(module, d)}</legend>
            <div className="permission-choice-grid">
              {modulePermissions.map((permission) => <label className="permission-choice" key={permission.key}>
                <input defaultChecked={assignedKeys.has(permission.key)} disabled={isProtected} name="permissionKeys" type="checkbox" value={permission.key} />
                <span><strong>{permission.description}</strong><small>{permission.key}</small></span>
              </label>)}
            </div>
          </fieldset>)}
          {!isProtected ? <div className="permission-save-bar"><div><strong>{d.savePermissions}</strong><span>{d.permissionSaveHelp}</span></div><button className="button">{d.savePermissions}</button></div> : null}
        </ActionForm>
      </section>

      <aside className="card role-assigned-panel">
        <div className="card-heading"><div><h2>{d.assignedPeople}</h2><p className="muted">{d.assignedPeopleHelp}</p></div><span className="badge">{assignedEmployees.length + assignedAccounts.length}</span></div>
        <div className="assigned-person-list">
          {assignedEmployees.map((employee) => <Link className="assigned-person" href={`/${locale}/employees/${employee.id}`} key={employee.id}><span className="person-avatar">{employee.name_en.slice(0, 1).toUpperCase()}</span><span><strong>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</strong><small>{employee.position ?? employee.employee_code}</small></span><span aria-hidden="true">→</span></Link>)}
          {assignedAccounts.map((account) => { const name = account.profile?.full_name ?? d.ownerAccount; return <Link className="assigned-person" href={`/${locale}/profiles/${account.user_id}`} key={account.id}><span className="person-avatar">{name.slice(0, 1).toUpperCase()}</span><span><strong>{name}</strong><small>{account.is_owner ? d.companyOwner : d.companyUser}</small></span><span aria-hidden="true">→</span></Link>; })}
          {!assignedEmployees.length && !assignedAccounts.length ? <div className="empty">{d.noAssignedPeople}</div> : null}
        </div>
        <Link className="button ghost full-width" href={`/${locale}/employees`}>{d.manageEmployeeRoles}</Link>
      </aside>
    </div>
  </>;
}
