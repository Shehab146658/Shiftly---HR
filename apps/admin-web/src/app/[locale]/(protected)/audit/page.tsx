import { getTenantPageContext } from "@/lib/page-context";

export default async function AuditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { dictionary: d, supabase, membership } = await getTenantPageContext(locale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const { data, error } = await supabase.from("audit_logs").select("id, action, entity_type, entity_id, actor_user_id, created_at").eq("tenant_id", membership.tenant_id).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return <><div className="page-head"><h1 className="page-title">{d.audit}</h1></div><section className="card table-wrap"><table><thead><tr><th>{d.date}</th><th>{d.action}</th><th>{d.entity}</th><th>{d.actor}</th></tr></thead><tbody>
    {data?.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString(locale)}</td><td><span className="badge">{row.action}</span></td><td>{row.entity_type}<div className="code muted">{row.entity_id ?? ""}</div></td><td className="code">{row.actor_user_id ?? "system"}</td></tr>)}
  </tbody></table>{!data?.length ? <div className="empty">{d.empty}</div> : null}</section></>;
}
