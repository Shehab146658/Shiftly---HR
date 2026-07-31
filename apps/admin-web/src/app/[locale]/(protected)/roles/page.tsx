import { getTenantPageContext } from "@/lib/page-context";

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { dictionary: d, supabase, membership } = await getTenantPageContext(locale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const { data, error } = await supabase.from("roles").select("id, name, description, role_permissions(permission_key), employee_role_assignments(employee_id, employees(name_en, name_ar))").eq("tenant_id", membership.tenant_id).order("name");
  if (error) throw error;
  return <><div className="page-head"><div><h1 className="page-title">{d.roles}</h1><p className="muted">{d.roleAssignmentHint}</p></div></div><section className="card table-wrap desktop-only"><table><thead><tr><th>{d.roleName}</th><th>{d.assignedEmployees}</th><th>{d.permissionKey}</th></tr></thead><tbody>
    {data?.map((role) => <tr key={role.id}><td><strong>{role.name}</strong><div className="muted">{role.description ?? ""}</div></td><td><span className="badge">{role.employee_role_assignments.length}</span></td><td>{role.role_permissions.map((p) => <span className="badge code" style={{ margin: 3 }} key={p.permission_key}>{p.permission_key}</span>)}</td></tr>)}
  </tbody></table>{!data?.length ? <div className="empty">{d.empty}</div> : null}</section><section className="mobile-only role-card-list">
    {data?.map((role) => <article className="card role-card" key={role.id}><div className="employee-card-head"><strong>{role.name}</strong><span className="badge">{role.employee_role_assignments.length} {d.assignedEmployees.toLowerCase()}</span></div><p className="muted">{role.description ?? d.noDescription}</p><div className="role-badges">{role.role_permissions.map((permission) => <span className="badge code" key={permission.permission_key}>{permission.permission_key}</span>)}</div></article>)}
    {!data?.length ? <div className="empty">{d.empty}</div> : null}
  </section></>;
}
