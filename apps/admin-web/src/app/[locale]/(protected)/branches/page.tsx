import { createBranch } from "../actions";
import { getTenantPageContext } from "@/lib/page-context";

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const { data, error } = await supabase.from("branches").select("id, code, name_en, name_ar, is_active").eq("tenant_id", membership.tenant_id).order("name_en");
  if (error) throw error;
  const action = createBranch.bind(null, locale, membership.tenant_id);

  return <>
    <div className="page-head"><div><h1 className="page-title">{d.branches}</h1></div></div>
    <section className="card stack">
      <form action={action} className="form-grid">
        <div className="field"><label>{d.code}</label><input className="input" name="code" required /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field" style={{ alignSelf: "end" }}><button className="button">{d.add}</button></div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.nameArabic}</th><th>{d.statusLabel}</th></tr></thead>
      <tbody>{data?.map((row) => <tr key={row.id}><td className="code">{row.code}</td><td>{row.name_en}</td><td dir="rtl">{row.name_ar ?? "—"}</td><td><span className="badge">{row.is_active ? d.active : d.inactive}</span></td></tr>)}</tbody></table>
      {!data?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
