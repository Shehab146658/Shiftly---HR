import { createEmployee } from "../actions";
import { getTenantPageContext } from "@/lib/page-context";

export default async function EmployeesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const [{ data: employees, error }, { data: branches }, { data: teams }] = await Promise.all([
    supabase.from("employees").select("id, employee_code, name_en, name_ar, position, status, branches(name_en), teams(name_en)").eq("tenant_id", tenantId).order("name_en"),
    supabase.from("branches").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("teams").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
  ]);
  if (error) throw error;
  const action = createEmployee.bind(null, locale, tenantId);

  return <>
    <div className="page-head"><h1 className="page-title">{d.employees}</h1></div>
    <section className="card stack">
      <form action={action} className="form-grid">
        <div className="field"><label>{d.code}</label><input className="input" name="employeeCode" required /></div>
        <div className="field"><label>{d.position}</label><input className="input" name="position" /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId"><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.team}</label><select className="select" name="teamId"><option value="">—</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}</select></div>
        <div className="full"><button className="button">{d.add}</button></div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.position}</th><th>{d.branch}</th><th>{d.team}</th><th>{d.statusLabel}</th></tr></thead><tbody>
        {employees?.map((row) => { const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches; const team = Array.isArray(row.teams) ? row.teams[0] : row.teams; return <tr key={row.id}><td className="code">{row.employee_code}</td><td>{row.name_en}</td><td>{row.position ?? "—"}</td><td>{branch?.name_en ?? "—"}</td><td>{team?.name_en ?? "—"}</td><td><span className="badge">{row.status}</span></td></tr>; })}
      </tbody></table>{!employees?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
