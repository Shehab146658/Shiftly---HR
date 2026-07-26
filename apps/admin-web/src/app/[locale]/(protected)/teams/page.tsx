import { createTeam } from "../actions";
import { getTenantPageContext } from "@/lib/page-context";

export default async function TeamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const [{ data: teams, error }, { data: branches }] = await Promise.all([
    supabase.from("teams").select("id, code, name_en, name_ar, is_active, branches(name_en)").eq("tenant_id", membership.tenant_id).order("name_en"),
    supabase.from("branches").select("id, name_en").eq("tenant_id", membership.tenant_id).eq("is_active", true).order("name_en"),
  ]);
  if (error) throw error;
  const action = createTeam.bind(null, locale, membership.tenant_id);

  return <>
    <div className="page-head"><h1 className="page-title">{d.teams}</h1></div>
    <section className="card stack">
      <form action={action} className="form-grid">
        <div className="field"><label>{d.code}</label><input className="input" name="code" required /></div>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId"><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="full"><button className="button">{d.add}</button></div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.branch}</th><th>{d.statusLabel}</th></tr></thead><tbody>
        {teams?.map((row) => { const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches; return <tr key={row.id}><td className="code">{row.code}</td><td>{row.name_en}</td><td>{branch?.name_en ?? "—"}</td><td><span className="badge">{row.is_active ? d.active : d.inactive}</span></td></tr>; })}
      </tbody></table>{!teams?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
