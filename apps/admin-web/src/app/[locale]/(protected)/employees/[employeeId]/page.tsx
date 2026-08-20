import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveEmployee,
  updateEmployee,
  updateEmployeeRoles,
} from "../../actions";
import { ActionForm } from "@/components/action-form";
import { EmployeeOrganizationFields } from "@/components/employee-organization-fields";
import { getTenantPageContext } from "@/lib/page-context";

export default async function EmployeeDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; employeeId: string }>;
}) {
  const { locale: rawLocale, employeeId } = await params;
  const {
    locale,
    dictionary: d,
    supabase,
    membership,
  } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const [
    { data: employee, error },
    { data: branches },
    { data: teams },
    { data: managers },
    { data: managerAssignments },
    { data: assignments },
    { data: canManageEmployees },
    { data: canManageRoles },
    { data: roles, error: rolesError },
    { data: assignedRoleRows, error: assignedRolesError },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", employeeId)
      .maybeSingle(),
    supabase
      .from("branches")
      .select("id, name_en")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name_en"),
    supabase
      .from("teams")
      .select("id, name_en, branch_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name_en"),
    supabase
      .from("employees")
      .select("id, name_en")
      .eq("tenant_id", tenantId)
      .neq("id", employeeId)
      .neq("status", "terminated")
      .order("name_en"),
    supabase
      .from("employee_managers")
      .select("manager_employee_id")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .is("effective_to", null)
      .order("is_primary", { ascending: false }),
    supabase
      .from("employee_assignments")
      .select(
        "id, position, effective_from, effective_to, reason, branches(name_en), teams(name_en), manager:employees!employee_assignments_manager_employee_id_fkey(name_en)",
      )
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .order("effective_from", { ascending: false }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "employees.manage",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "roles.manage",
    }),
    supabase
      .from("roles")
      .select("id, name, description")
      .eq("tenant_id", tenantId)
      .neq("name", "owner")
      .order("name"),
    supabase
      .from("employee_role_assignments")
      .select("role_id")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId),
  ]);
  if (error) throw error;
  if (rolesError) throw rolesError;
  if (assignedRolesError) throw assignedRolesError;
  if (!employee) notFound();
  const action = updateEmployee.bind(null, locale, tenantId, employeeId);
  const archiveAction = archiveEmployee.bind(
    null,
    locale,
    tenantId,
    employeeId,
  );
  const rolesAction = updateEmployeeRoles.bind(
    null,
    locale,
    tenantId,
    employeeId,
  );
  const assignedRoleIds = new Set(
    assignedRoleRows?.map((row) => row.role_id) ?? [],
  );
  const leaveCopy =
    locale === "ar"
      ? {
          statutoryProfile: "بيانات استحقاق الإجازات",
          statutoryHelp:
            "تُستخدم هذه البيانات لحساب الحد الأدنى القانوني تلقائيًا.",
          birthDate: "تاريخ الميلاد",
          gender: "النوع",
          female: "أنثى",
          male: "ذكر",
          unspecified: "غير محدد",
          priorService: "سنوات خدمة سابقة",
          disability: "شخص ذو إعاقة",
          dwarf: "من الأقزام",
          hazardous: "يعمل في أعمال خطرة",
          unhealthy: "يعمل في أعمال ضارة بالصحة",
          remote: "يعمل في منطقة نائية",
        }
      : {
          statutoryProfile: "Statutory leave profile",
          statutoryHelp:
            "These facts drive the protected legal minimum calculation.",
          birthDate: "Birth date",
          gender: "Gender",
          female: "Female",
          male: "Male",
          unspecified: "Unspecified",
          priorService: "Prior service years",
          disability: "Person with disability",
          dwarf: "Person with dwarfism",
          hazardous: "Hazardous work",
          unhealthy: "Unhealthy work",
          remote: "Remote-location work",
        };

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="text-link" href={`/${locale}/employees`}>
            ← {d.employees}
          </Link>
          <h1 className="page-title">
            {locale === "ar" && employee.name_ar
              ? employee.name_ar
              : employee.name_en}
          </h1>
          <p className="muted code">{employee.employee_code}</p>
        </div>
        {canManageEmployees && employee.status !== "terminated" ? (
          <ActionForm
            action={archiveAction}
            confirmMessage={d.archiveEmployeeConfirm}
            errorMessage={d.actionFailed}
            pendingMessage={d.saving}
            successMessage={d.employeeArchived}
          >
            <button className="button danger" type="submit">
              {d.archiveEmployee}
            </button>
          </ActionForm>
        ) : null}
      </div>

      <section className="card stack">
        <h2>{d.employeeDetails}</h2>
        <ActionForm
          action={action}
          className="form-grid three-columns"
          errorMessage={d.actionFailed}
          pendingMessage={d.saving}
          successMessage={d.employeeUpdated}
        >
          <fieldset
            className="form-fieldset contents"
            disabled={!canManageEmployees}
          >
            <div className="field">
              <label>{d.code}</label>
              <input
                className="input"
                defaultValue={employee.employee_code}
                readOnly
              />
              <small className="muted">
                {locale === "ar"
                  ? "يُنشأ تلقائيًا ولا يحتاج إلى تعديل."
                  : "Generated automatically and kept stable."}
              </small>
            </div>
            <div className="field">
              <label>{d.nameEnglish}</label>
              <input
                className="input"
                name="nameEn"
                defaultValue={employee.name_en}
                required
              />
            </div>
            <div className="field">
              <label>{d.nameArabic}</label>
              <input
                className="input"
                name="nameAr"
                dir="rtl"
                defaultValue={employee.name_ar ?? ""}
              />
            </div>
            <div className="field">
              <label>{d.position}</label>
              <input
                className="input"
                name="position"
                defaultValue={employee.position ?? ""}
              />
            </div>
            <div className="field">
              <label>{d.email}</label>
              <input
                className="input"
                name="email"
                type="email"
                defaultValue={employee.email ?? ""}
              />
            </div>
            <div className="field">
              <label>{d.phone}</label>
              <input
                className="input"
                name="phone"
                defaultValue={employee.phone ?? ""}
              />
            </div>
            <EmployeeOrganizationFields
              branches={branches ?? []}
              defaultBranchId={employee.branch_id ?? ""}
              defaultManagerIds={
                managerAssignments?.map(
                  (assignment) => assignment.manager_employee_id,
                ) ??
                (employee.manager_employee_id
                  ? [employee.manager_employee_id]
                  : [])
              }
              defaultTeamId={employee.team_id ?? ""}
              labels={{
                branch: `${d.branch} (${locale === "ar" ? "اختياري" : "optional"})`,
                noBranch: d.unassigned,
                teamOptional: d.teamOptional,
                noTeam: d.noTeam,
                teamOptionalHelp: d.teamOptionalHelp,
                manager: d.manager,
                managers:
                  locale === "ar" ? "المديرون المباشرون" : "Reporting managers",
                noManager: d.none,
                managersHelp:
                  locale === "ar"
                    ? "اختر كل المديرين المخولين بمراجعة طلبات هذا الموظف."
                    : "Select every manager allowed to review this employee's requests.",
              }}
              managers={managers ?? []}
              teams={teams ?? []}
            />
            <div className="field">
              <label>{d.hireDate}</label>
              <input
                className="input"
                name="hireDate"
                type="date"
                defaultValue={employee.hire_date ?? ""}
              />
            </div>
            <div className="field">
              <label>{leaveCopy.birthDate}</label>
              <input
                className="input"
                name="birthDate"
                type="date"
                defaultValue={employee.birth_date ?? ""}
              />
            </div>
            <div className="field">
              <label>{leaveCopy.gender}</label>
              <select
                className="select"
                name="gender"
                defaultValue={employee.gender ?? "unspecified"}
              >
                <option value="unspecified">{leaveCopy.unspecified}</option>
                <option value="female">{leaveCopy.female}</option>
                <option value="male">{leaveCopy.male}</option>
              </select>
            </div>
            <div className="field">
              <label>{leaveCopy.priorService}</label>
              <input
                className="input"
                min="0"
                max="100"
                name="priorServiceYears"
                step="0.25"
                type="number"
                defaultValue={employee.prior_service_years ?? 0}
              />
            </div>
            <div className="field">
              <label>{d.preferredLanguage}</label>
              <select
                className="select"
                name="preferredLocale"
                defaultValue={employee.preferred_locale}
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            <div className="field">
              <label>{d.statusLabel}</label>
              <select
                className="select"
                name="status"
                defaultValue={employee.status}
              >
                <option value="active">{d.active}</option>
                <option value="inactive">{d.inactive}</option>
                <option value="on_leave">{d.onLeave}</option>
                <option value="terminated">{d.terminated}</option>
              </select>
            </div>
            <div className="field full">
              <label>{leaveCopy.statutoryProfile}</label>
              <small className="muted">{leaveCopy.statutoryHelp}</small>
              <div className="role-option-grid statutory-flags">
                <label className="role-option">
                  <input
                    defaultChecked={employee.is_person_with_disability}
                    name="isPersonWithDisability"
                    type="checkbox"
                  />
                  <span>
                    <strong>{leaveCopy.disability}</strong>
                  </span>
                </label>
                <label className="role-option">
                  <input
                    defaultChecked={employee.is_dwarf}
                    name="isDwarf"
                    type="checkbox"
                  />
                  <span>
                    <strong>{leaveCopy.dwarf}</strong>
                  </span>
                </label>
                <label className="role-option">
                  <input
                    defaultChecked={employee.works_hazardous}
                    name="worksHazardous"
                    type="checkbox"
                  />
                  <span>
                    <strong>{leaveCopy.hazardous}</strong>
                  </span>
                </label>
                <label className="role-option">
                  <input
                    defaultChecked={employee.works_unhealthy}
                    name="worksUnhealthy"
                    type="checkbox"
                  />
                  <span>
                    <strong>{leaveCopy.unhealthy}</strong>
                  </span>
                </label>
                <label className="role-option">
                  <input
                    defaultChecked={employee.works_remote_location}
                    name="worksRemoteLocation"
                    type="checkbox"
                  />
                  <span>
                    <strong>{leaveCopy.remote}</strong>
                  </span>
                </label>
              </div>
            </div>
            <div className="field full">
              <label>{d.notes}</label>
              <textarea
                className="input"
                name="notes"
                rows={3}
                defaultValue={employee.notes ?? ""}
              />
            </div>
            {canManageEmployees ? (
              <div className="full">
                <button className="button">{d.update}</button>
              </div>
            ) : null}
          </fieldset>
        </ActionForm>
      </section>

      {canManageRoles ? (
        <section className="card stack section-gap">
          <div className="card-heading">
            <div>
              <h2>{d.accessRoles}</h2>
              <p className="muted">{d.accessRolesHelp}</p>
            </div>
          </div>
          <div className="access-summary">
            <div>
              <strong>{d.userAccount}</strong>
              <p className="muted">
                {employee.user_id ? d.accountLinkedHelp : d.accountPendingHelp}
              </p>
            </div>
            <span
              className={`badge ${employee.user_id ? "account-linked" : "account-pending"}`}
            >
              {employee.user_id ? d.accountLinked : d.accountPending}
            </span>
          </div>
          <ActionForm
            action={rolesAction}
            className="stack"
            errorMessage={d.actionFailed}
            pendingMessage={d.saving}
            successMessage={d.rolesUpdated}
          >
            <div className="role-option-grid">
              {roles?.map((role) => (
                <label className="role-option" key={role.id}>
                  <input
                    defaultChecked={assignedRoleIds.has(role.id)}
                    name="roleIds"
                    type="checkbox"
                    value={role.id}
                  />
                  <span>
                    <strong>{role.name.replaceAll("_", " ")}</strong>
                    <small>{role.description ?? d.noDescription}</small>
                  </span>
                </label>
              ))}
            </div>
            {!roles?.length ? <div className="empty">{d.empty}</div> : null}
            <div>
              <button className="button">{d.saveRoles}</button>
            </div>
          </ActionForm>
        </section>
      ) : null}

      <section className="card stack section-gap">
        <h2>{d.assignmentHistory}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{d.effectiveFrom}</th>
                <th>{d.effectiveTo}</th>
                <th>{d.branch}</th>
                <th>{d.team}</th>
                <th>{d.position}</th>
                <th>{d.manager}</th>
                <th>{d.reason}</th>
              </tr>
            </thead>
            <tbody>
              {assignments?.map((row) => {
                const branch = Array.isArray(row.branches)
                  ? row.branches[0]
                  : row.branches;
                const team = Array.isArray(row.teams)
                  ? row.teams[0]
                  : row.teams;
                const manager = Array.isArray(row.manager)
                  ? row.manager[0]
                  : row.manager;
                return (
                  <tr key={row.id}>
                    <td>{row.effective_from}</td>
                    <td>{row.effective_to ?? d.current}</td>
                    <td>{branch?.name_en ?? d.unassigned}</td>
                    <td>{team?.name_en ?? d.noTeam}</td>
                    <td>{row.position ?? d.notSet}</td>
                    <td>{manager?.name_en ?? d.none}</td>
                    <td>{row.reason ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!assignments?.length ? <div className="empty">{d.empty}</div> : null}
        </div>
      </section>
    </>
  );
}
