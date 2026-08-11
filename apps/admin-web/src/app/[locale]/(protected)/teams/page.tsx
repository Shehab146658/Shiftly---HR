import { assignAllEmployeesToTeam, createTeam } from "../actions";
import { ActionForm } from "@/components/action-form";
import { OverflowTooltip } from "@/components/overflow-tooltip";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";

export default async function TeamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const [{ data: teams, error }, { data: branches }] = await Promise.all([
    supabase.from("teams").select("id, code, name_en, name_ar, is_active, branches(name_en), employees(count)").eq("tenant_id", membership.tenant_id).order("name_en"),
    supabase.from("branches").select("id, name_en").eq("tenant_id", membership.tenant_id).eq("is_active", true).order("name_en"),
  ]);
  if (error) throw error;
  const action = createTeam.bind(null, locale, membership.tenant_id);

  return <>
    <div className="page-head"><div><h1 className="page-title">{d.teams}</h1><p className="muted">{d.teamsHelp}</p></div><CreateDialog closeLabel={d.close} description={d.createTeamHelp} eyebrow={d.teams} title={d.createTeam} triggerLabel={d.createTeam} width="medium">
      <ActionForm action={action} className="form-grid" errorMessage={d.actionFailed} pendingMessage={d.saving} resetOnSuccess successMessage={d.teamCreated}>
        <div className="field"><label>{d.code}</label><input className="input" name="code" required /></div>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId"><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="full"><button className="button">{d.createTeam}</button></div>
      </ActionForm>
    </CreateDialog></div>
    <section className="card stack">
      <div className="table-wrap"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.branch}</th><th>{d.teamMembers}</th><th>{d.statusLabel}</th><th>{d.actions}</th></tr></thead><tbody>
        {teams?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const countRecord = Array.isArray(row.employees) ? row.employees[0] : row.employees;
          const assignAction = assignAllEmployeesToTeam.bind(null, locale, membership.tenant_id, row.id);
          return <tr key={row.id}><td className="code">{row.code}</td><td><OverflowTooltip text={locale === "ar" && row.name_ar ? row.name_ar : row.name_en} /></td><td><OverflowTooltip text={branch?.name_en ?? d.companyWide} /></td><td><strong>{countRecord?.count ?? 0}</strong></td><td><span className="badge">{row.is_active ? d.active : d.inactive}</span></td><td><ActionForm action={assignAction} confirmMessage={d.assignEveryoneConfirm} errorMessage={d.actionFailed} pendingMessage={d.assigning} successMessage={d.teamAssignmentSuccess}><button className="text-button" type="submit">{d.assignEveryone}</button></ActionForm></td></tr>;
        })}
      </tbody></table>{!teams?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
