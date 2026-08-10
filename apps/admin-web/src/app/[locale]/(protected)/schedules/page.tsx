import Link from "next/link";
import { createWeeklySchedule } from "../actions";
import { ActionForm } from "@/components/action-form";
import { getTenantPageContext } from "@/lib/page-context";

export const dynamic = "force-dynamic";

function statusLabel(status: string, d: ReturnType<typeof import("@/lib/i18n").getDictionary>) {
  if (status === "published") return d.published;
  if (status === "locked") return d.locked;
  if (status === "archived") return d.archived;
  return d.draft;
}

export default async function SchedulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ branch?: string; week?: string; status?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;

  let scheduleQuery = supabase.from("weekly_schedules")
    .select("id, week_start, status, visibility, published_at, locked_at, notes, branches(name_en, name_ar), schedule_entries(count)")
    .eq("tenant_id", tenantId)
    .order("week_start", { ascending: false });
  if (filters.branch) scheduleQuery = scheduleQuery.eq("branch_id", filters.branch);
  if (filters.week) scheduleQuery = scheduleQuery.eq("week_start", filters.week);
  if (filters.status) scheduleQuery = scheduleQuery.eq("status", filters.status);

  const [{ data: schedules, error }, { data: branches }] = await Promise.all([
    scheduleQuery,
    supabase.from("branches").select("id, name_en, name_ar, default_schedule_visibility").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
  ]);
  if (error) throw error;
  const action = createWeeklySchedule.bind(null, locale, tenantId);

  return <>
    <div className="page-head"><div><h1 className="page-title">{d.schedules}</h1><p className="muted">{schedules?.length ?? 0} {d.schedules.toLowerCase()}</p></div></div>

    <section className="card stack">
      <h2>{d.createSchedule}</h2>
      <ActionForm action={action} className="form-grid" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleCreated}>
        <div className="field"><label>{d.branch}</label><select className="select" name="branchId" required><option value="">—</option>{branches?.map((b) => <option key={b.id} value={b.id}>{locale === "ar" && b.name_ar ? b.name_ar : b.name_en}</option>)}</select></div>
        <div className="field"><label>{d.weekStart}</label><input className="input" name="weekStart" type="date" required /></div>
        <div className="field"><label>{d.visibility}</label><select className="select" name="visibility" defaultValue="self"><option value="self">{d.selfOnly}</option><option value="team">{d.teamVisibility}</option><option value="branch">{d.branchVisibility}</option><option value="all">{d.everyone}</option></select></div>
        <div className="field"><label>{d.notes}</label><input className="input" name="notes" /></div>
        <div className="full"><button className="button">{d.create}</button></div>
      </ActionForm>
    </section>

    <section className="card stack section-gap">
      <form className="toolbar" method="get">
        <select className="select compact" name="branch" defaultValue={filters.branch ?? ""}><option value="">{d.allBranches}</option>{branches?.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}</select>
        <input className="input compact" type="date" name="week" defaultValue={filters.week} />
        <select className="select compact" name="status" defaultValue={filters.status ?? ""}><option value="">{d.allStatuses}</option><option value="draft">{d.draft}</option><option value="published">{d.published}</option><option value="locked">{d.locked}</option><option value="archived">{d.archived}</option></select>
        <button className="button">{d.search}</button>
        <Link className="button ghost" href={`/${locale}/schedules`}>{d.clear}</Link>
      </form>
      <div className="table-wrap"><table><thead><tr><th>{d.weekStart}</th><th>{d.branch}</th><th>{d.statusLabel}</th><th>{d.visibility}</th><th>{d.shift}</th><th>{d.publishedAt}</th><th>{d.actions}</th></tr></thead><tbody>
        {schedules?.map((row) => {
          const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
          const countRecord = Array.isArray(row.schedule_entries) ? row.schedule_entries[0] : row.schedule_entries;
          return <tr key={row.id}>
            <td><strong>{row.week_start}</strong></td>
            <td>{locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en}</td>
            <td><span className={`badge status-${row.status}`}>{statusLabel(row.status, d)}</span></td>
            <td>{row.visibility}</td>
            <td>{countRecord?.count ?? 0}</td>
            <td>{row.published_at ? new Date(row.published_at).toLocaleString(locale) : "—"}</td>
            <td><Link className="text-link" href={`/${locale}/schedules/${row.id}`}>{d.open}</Link></td>
          </tr>;
        })}
      </tbody></table>{!schedules?.length ? <div className="empty">{d.empty}</div> : null}</div>
    </section>
  </>;
}
