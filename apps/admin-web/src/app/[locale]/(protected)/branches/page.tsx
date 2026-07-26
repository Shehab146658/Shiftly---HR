import { createBranch, updateBranchSchedulingRules } from "../actions";
import { getTenantPageContext } from "@/lib/page-context";

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const { data, error } = await supabase.from("branches")
    .select("id, code, name_en, name_ar, is_active, operational_day_start, maximum_shift_hours, week_start_isodow, default_schedule_visibility")
    .eq("tenant_id", tenantId).order("name_en");
  if (error) throw error;
  const action = createBranch.bind(null, locale, tenantId);

  return <>
    <div className="page-head"><div><h1 className="page-title">{d.branches}</h1></div></div>
    <section className="card stack">
      <form action={action} className="form-grid">
        <div className="field"><label>{d.code}</label><input className="input" name="code" required /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field" style={{ alignSelf: "end" }}><button className="button">{d.add}</button></div>
      </form>
    </section>

    <div className="grid branch-grid section-gap">
      {data?.map((row) => {
        const updateAction = updateBranchSchedulingRules.bind(null, locale, tenantId, row.id);
        return <section className="card stack" key={row.id}>
          <div className="card-heading"><div><strong>{row.name_en}</strong><div className="muted code">{row.code}</div></div><span className="badge">{row.is_active ? d.active : d.inactive}</span></div>
          <h3>{d.schedulingRules}</h3>
          <form action={updateAction} className="stack">
            <div className="field"><label>{d.operationalDayStart}</label><input className="input" type="time" name="operationalDayStart" defaultValue={String(row.operational_day_start).slice(0, 5)} required /></div>
            <div className="field"><label>{d.maximumShiftHours}</label><input className="input" type="number" min="1" max="24" name="maximumShiftHours" defaultValue={row.maximum_shift_hours} required /></div>
            <div className="field"><label>{d.weekStartsOn}</label><select className="select" name="weekStartIsodow" defaultValue={row.week_start_isodow}><option value="1">{d.monday}</option><option value="2">{d.tuesday}</option><option value="3">{d.wednesday}</option><option value="4">{d.thursday}</option><option value="5">{d.friday}</option><option value="6">{d.saturday}</option><option value="7">{d.sunday}</option></select></div>
            <div className="field"><label>{d.defaultVisibility}</label><select className="select" name="defaultScheduleVisibility" defaultValue={row.default_schedule_visibility}><option value="self">{d.selfOnly}</option><option value="team">{d.teamVisibility}</option><option value="branch">{d.branchVisibility}</option><option value="all">{d.everyone}</option></select></div>
            <button className="button secondary">{d.save}</button>
          </form>
        </section>;
      })}
    </div>
    {!data?.length ? <div className="card empty section-gap">{d.empty}</div> : null}
  </>;
}
