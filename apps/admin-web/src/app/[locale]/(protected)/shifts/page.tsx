import { createShiftTemplate, toggleShiftTemplate } from "../actions";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { redirect } from "next/navigation";

function formatTime(value: string) {
  return String(value).slice(0, 5);
}

export default async function ShiftTemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const [{ data: canRead }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "shifts.read" }),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "shifts.manage" }),
  ]);
  if (!canRead) redirect(`/${locale}/dashboard`);
  const [{ data: shifts, error }, { data: branches }] = await Promise.all([
    supabase.from("shift_templates").select("id, code, name_en, name_ar, start_time, end_time, end_day_offset, break_minutes, color_hex, is_active, branches(name_en)").eq("tenant_id", tenantId).order("start_time"),
    supabase.from("branches").select("id, name_en").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
  ]);
  if (error) throw error;
  const action = createShiftTemplate.bind(null, locale, tenantId);

  const addShift = locale === "ar" ? "إضافة قالب وردية" : "Add shift template";
  return <>
    <div className="page-head"><div><h1 className="page-title">{d.shifts}</h1><p className="muted">{shifts?.length ?? 0} {d.shifts.toLowerCase()}</p></div>{canManage ? <CreateDialog closeLabel={d.close} description={locale === "ar" ? "أنشئ وردية قابلة لإعادة الاستخدام، بما في ذلك الورديات الليلية وفترات الراحة." : "Create a reusable working pattern, including overnight shifts and breaks."} eyebrow={d.shifts} title={addShift} triggerLabel={addShift}>
      <ActionForm action={action} className="form-grid three-columns" errorMessage={d.actionFailed} pendingMessage={d.saving} resetOnSuccess successMessage={d.shiftCreated}>
        <div className="field"><label>{d.code}</label><input className="input" name="code" placeholder="12_10" required /></div>
        <div className="field"><label>{d.nameEnglish}</label><input className="input" name="nameEn" placeholder="12 PM - 10 PM" required /></div>
        <div className="field"><label>{d.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
        <div className="field"><label>{d.scope}</label><select className="select" name="branchId"><option value="">{d.companyWide}</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.startTime}</label><input className="input" type="time" name="startTime" required /></div>
        <div className="field"><label>{d.endTime}</label><input className="input" type="time" name="endTime" required /></div>
        <div className="field"><label>{d.nextDay}</label><select className="select" name="endDayOffset"><option value="0">No</option><option value="1">Yes</option></select></div>
        <div className="field"><label>{d.breakMinutes}</label><input className="input" type="number" min="0" max="480" name="breakMinutes" defaultValue="0" /></div>
        <div className="field"><label>{d.color}</label><input className="input color-input" type="color" name="colorHex" defaultValue="#2357D9" /></div>
        <div className="full"><button className="button">{addShift}</button></div>
      </ActionForm>
    </CreateDialog> : null}</div>

    <section className="card stack section-gap">
      <div className="table-wrap"><table><thead><tr><th>{d.code}</th><th>{d.nameEnglish}</th><th>{d.scope}</th><th>{d.startTime}</th><th>{d.endTime}</th><th>{d.breakMinutes}</th><th>{d.statusLabel}</th><th>{d.actions}</th></tr></thead><tbody>
        {shifts?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const toggleAction = toggleShiftTemplate.bind(null, locale, tenantId, row.id, !row.is_active);
          return <tr key={row.id}>
            <td><span className="color-dot" style={{ background: row.color_hex ?? "#2357D9" }} /><span className="code">{row.code}</span></td>
            <td>{locale === "ar" && row.name_ar ? row.name_ar : row.name_en}</td>
            <td>{branch?.name_en ?? d.companyWide}</td>
            <td>{formatTime(row.start_time)}</td>
            <td>{formatTime(row.end_time)}{row.end_day_offset ? " +1" : ""}</td>
            <td>{row.break_minutes}</td>
            <td><span className="badge">{row.is_active ? d.active : d.inactive}</span></td>
            <td>{canManage ? <ActionForm action={toggleAction} errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={row.is_active ? d.shiftDeactivated : d.shiftActivated}><button className="text-button" type="submit">{row.is_active ? d.deactivate : d.activate}</button></ActionForm> : "—"}</td>
          </tr>;
        })}
      </tbody></table>{!shifts?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
