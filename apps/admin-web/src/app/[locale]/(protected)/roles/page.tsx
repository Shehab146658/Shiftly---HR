import { getTenantPageContext } from "@/lib/page-context";

export default async function RolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { dictionary: d, supabase, membership } = await getTenantPageContext(locale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const { data, error } = await supabase.from("roles").select("id, name, description, role_permissions(permission_key)").eq("tenant_id", membership.tenant_id).order("name");
  if (error) throw error;
  return <><div className="page-head"><h1 className="page-title">{d.roles}</h1></div><section className="card table-wrap"><table><thead><tr><th>{d.roleName}</th><th>{d.permissionKey}</th></tr></thead><tbody>
    {data?.map((role) => <tr key={role.id}><td><strong>{role.name}</strong><div className="muted">{role.description ?? ""}</div></td><td>{role.role_permissions.map((p) => <span className="badge code" style={{ margin: 3 }} key={p.permission_key}>{p.permission_key}</span>)}</td></tr>)}
  </tbody></table>{!data?.length ? <div className="empty">{d.empty}</div> : null}</section></>;
}
