import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveEmployee, updateEmployee } from "../../actions";
import { getTenantPageContext } from "@/lib/page-context";

export default async function EmployeeDetailsPage({ params }: { params: Promise<{ locale: string; employeeId: string }> }) {
  const { locale: rawLocale, employeeId } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const [{ data: employee, error }, { data: branches }, { data: teams }, { data: managers }, { data: assignments }] = await Promise.all([
    supabase.from("employees").select("*").eq("tenant_id", tenantId).eq("id", employeeId).maybeSingle(),
    supabase.from("branches").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("teams").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("employees").select("id, name_en").eq("tenant_id", tenantId).neq("id", employeeId).neq("status", "terminated").order("name_en"),
    supabase.from("employee_assignments").select("id, position, effective_from, effective_to, reason, branches(name_en), teams(name_en), manager:employees!employee_assignments_manager_employee_id_fkey(name_en)").eq("tenant_id", tenantId).eq("employee_id", employeeId).order("effective_from", { ascending: false }),
  ]);
  if (error) throw error;
  if (!employee) notFound();
  const action = updateEmployee.bind(null, locale, tenantId, employeeId);
  const archiveAction = archiveEmployee.bind(null, locale, tenantId, employeeId);

  return <>
    <div className="page-head">
      <div>
        <Link className="text-link" href={`/${locale}/employees`}>← {d.employees}</Link>
        <h1 className="page-title">{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</h1>
        <p className="muted code">{employee.employee_code}</p>
      </div>
      {employee.status !== "terminated" ? <form action={archiveAction}><button className="button danger">{d.archiveEmployee}</button></form> : null}
    </div>

    <section className="card stack">
      <h2>{d.employeeDetails}</h2>
      <form action={action} className="form-grid three-columns">
        <div className="field"><label>{d.code}</label><input className="input" name="employeeCode" defaultValue={employee.employee_code} required /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" defaultValue={employee.name_en} required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" defaultValue={employee.name_ar ?? ""} /></div>
        <div className="field"><label>{d.position}</label><input className="input" name="position" defaultValue={employee.position ?? ""} /></div>
        <div className="field"><label>{d.email}</label><input className="input" name="email" type="email" defaultValue={employee.email ?? ""} /></div>
        <div className="field"><label>{d.phone}</label><input className="input" name="phone" defaultValue={employee.phone ?? ""} /></div>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId" defaultValue={employee.branch_id ?? ""}><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.team}</label><select className="select" name="teamId" defaultValue={employee.team_id ?? ""}><option value="">—</option>{teams?.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}</select></div>
        <div className="field"><label>{d.manager}</label><select className="select" name="managerEmployeeId" defaultValue={employee.manager_employee_id ?? ""}><option value="">—</option>{managers?.map((m) => <option key={m.id} value={m.id}>{m.name_en}</option>)}</select></div>
        <div className="field"><label>{d.hireDate}</label><input className="input" name="hireDate" type="date" defaultValue={employee.hire_date ?? ""} /></div>
        <div className="field"><label>{d.preferredLanguage}</label><select className="select" name="preferredLocale" defaultValue={employee.preferred_locale}><option value="en">English</option><option value="ar">العربية</option></select></div>
        <div className="field"><label>{d.statusLabel}</label><select className="select" name="status" defaultValue={employee.status}><option value="active">{d.active}</option><option value="inactive">{d.inactive}</option><option value="on_leave">{d.onLeave}</option><option value="terminated">{d.terminated}</option></select></div>
        <div className="field full"><label>{d.notes}</label><textarea className="input" name="notes" rows={3} defaultValue={employee.notes ?? ""} /></div>
        <div className="full"><button className="button">{d.update}</button></div>
      </form>
    </section>

    <section className="card stack section-gap">
      <h2>{d.assignmentHistory}</h2>
      <div className="table-wrap"><table><thead><tr><th>{d.effectiveFrom}</th><th>{d.effectiveTo}</th><th>{d.branch}</th><th>{d.team}</th><th>{d.position}</th><th>{d.manager}</th><th>{d.reason}</th></tr></thead><tbody>
        {assignments?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const manager = Array.isArray(row.manager) ? row.manager[0] : row.manager;
          return <tr key={row.id}><td>{row.effective_from}</td><td>{row.effective_to ?? d.current}</td><td>{branch?.name_en ?? "—"}</td><td>{team?.name_en ?? "—"}</td><td>{row.position ?? "—"}</td><td>{manager?.name_en ?? "—"}</td><td>{row.reason ?? "—"}</td></tr>;
        })}
      </tbody></table>{!assignments?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
