import Link from "next/link";
import { createTeam, setTeamMembers } from "../actions";
import { ActionForm } from "@/components/action-form";
import { OverflowTooltip } from "@/components/overflow-tooltip";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { redirect } from "next/navigation";
import { TeamMemberDialog } from "@/components/team-member-dialog";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const {
    locale,
    dictionary: d,
    supabase,
    membership,
  } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const [{ data: canRead }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "teams.read",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "teams.manage",
    }),
  ]);
  if (!canRead) redirect(`/${locale}/dashboard`);
  const [{ data: teams, error }, { data: branches }, { data: employees }] =
    await Promise.all([
      supabase
        .from("teams")
        .select(
          "id, code, name_en, name_ar, is_active, branch_id, branches(name_en), employees(count)",
        )
        .eq("tenant_id", tenantId)
        .order("name_en"),
      supabase
        .from("branches")
        .select("id, name_en")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name_en"),
      supabase
        .from("employees")
        .select(
          "id, employee_code, name_en, name_ar, position, branch_id, team_id",
        )
        .eq("tenant_id", tenantId)
        .neq("status", "terminated")
        .order("name_en"),
    ]);
  if (error) throw error;
  const action = createTeam.bind(null, locale, tenantId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{d.teams}</h1>
          <p className="muted">{d.teamsHelp}</p>
        </div>
        {canManage ? (
          <CreateDialog
            closeLabel={d.close}
            description={d.createTeamHelp}
            eyebrow={d.teams}
            title={d.createTeam}
            triggerLabel={d.createTeam}
            width="medium"
          >
            <ActionForm
              action={action}
              className="form-grid"
              errorMessage={d.actionFailed}
              pendingMessage={d.saving}
              resetOnSuccess
              successMessage={d.teamCreated}
            >
              <div className="automatic-record-note full">
                <span aria-hidden="true">⚡</span>
                <div>
                  <strong>
                    {locale === "ar" ? "كود تلقائي" : "Automatic code"}
                  </strong>
                  <small>
                    {locale === "ar"
                      ? "سيُنشئ Shiftly كود الفريق عند الحفظ."
                      : "Shiftly creates the team code when you save."}
                  </small>
                </div>
              </div>
              <div className="field">
                <label>{d.branch}</label>
                <select className="select" name="branchId">
                  <option value="">—</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{d.nameEnglish}</label>
                <input className="input" name="nameEn" required />
              </div>
              <div className="field">
                <label>{d.nameArabic}</label>
                <input className="input" name="nameAr" dir="rtl" />
              </div>
              <div className="full">
                <button className="button">{d.createTeam}</button>
              </div>
            </ActionForm>
          </CreateDialog>
        ) : null}
      </div>
      <section className="card stack">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{d.code}</th>
                <th>{d.nameEnglish}</th>
                <th>{d.branch}</th>
                <th>{d.teamMembers}</th>
                <th>{d.statusLabel}</th>
                <th>{d.actions}</th>
              </tr>
            </thead>
            <tbody>
              {teams?.map((row) => {
                const branch = Array.isArray(row.branches)
                  ? row.branches[0]
                  : row.branches;
                const countRecord = Array.isArray(row.employees)
                  ? row.employees[0]
                  : row.employees;
                const eligibleEmployees = (employees ?? [])
                  .filter(
                    (employee) =>
                      !row.branch_id ||
                      !employee.branch_id ||
                      employee.branch_id === row.branch_id,
                  )
                  .map((employee) => ({
                    id: employee.id,
                    code: employee.employee_code,
                    name:
                      locale === "ar" && employee.name_ar
                        ? employee.name_ar
                        : employee.name_en,
                    position: employee.position,
                    selected: employee.team_id === row.id,
                  }));
                const memberAction = setTeamMembers.bind(
                  null,
                  locale,
                  tenantId,
                  row.id,
                );
                const teamName =
                  locale === "ar" && row.name_ar ? row.name_ar : row.name_en;
                return (
                  <tr key={row.id}>
                    <td className="code">{row.code}</td>
                    <td>
                      <OverflowTooltip text={teamName} />
                    </td>
                    <td>
                      <OverflowTooltip
                        text={branch?.name_en ?? d.companyWide}
                      />
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/${locale}/employees?team=${row.id}`}
                      >
                        <strong>{countRecord?.count ?? 0}</strong>{" "}
                        {locale === "ar" ? "موظف" : "employees"}
                      </Link>
                    </td>
                    <td>
                      <span className="badge">
                        {row.is_active ? d.active : d.inactive}
                      </span>
                    </td>
                    <td>
                      {canManage ? (
                        <TeamMemberDialog
                          action={memberAction}
                          employees={eligibleEmployees}
                          labels={{
                            close: d.close,
                            members: d.teamMembers,
                            manage:
                              locale === "ar"
                                ? "إدارة الأعضاء"
                                : "Manage members",
                            help:
                              locale === "ar"
                                ? "اختر الأفراد المناسبين لهذا الفريق. يمكنك نقل موظف من فريق آخر أو إزالة التعيين."
                                : "Choose exactly who belongs to this team. You can move people from another team or remove current members.",
                            failed: d.actionFailed,
                            saving: d.saving,
                            saved:
                              locale === "ar"
                                ? "تم تحديث أعضاء الفريق."
                                : "Team membership updated.",
                            search: d.search,
                            empty: d.empty,
                            syncHelp:
                              locale === "ar"
                                ? "عند الحفظ، ستصبح هذه القائمة هي قائمة أعضاء الفريق الحالية."
                                : "Saving synchronizes this selection as the team's current membership.",
                            save: d.save,
                          }}
                          teamName={teamName}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!teams?.length ? <div className="empty">{d.empty}</div> : null}
        </div>
      </section>
    </>
  );
}
