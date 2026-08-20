import { createBranch, updateBranchSchedulingRules } from "../actions";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { redirect } from "next/navigation";

export default async function BranchesPage({
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
      p_permission: "branches.read",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "branches.manage",
    }),
  ]);
  if (!canRead) redirect(`/${locale}/dashboard`);
  const { data, error } = await supabase
    .from("branches")
    .select(
      "id, code, name_en, name_ar, is_active, operational_day_start, maximum_shift_hours, week_start_isodow, weekly_rest_isodows, is_industrial_establishment, default_schedule_visibility, late_grace_minutes, early_departure_grace_minutes, overtime_threshold_minutes, geofence_latitude, geofence_longitude, geofence_radius_metres, mobile_clock_enabled, attendance_selfie_required",
    )
    .eq("tenant_id", tenantId)
    .order("name_en");
  if (error) throw error;
  const action = createBranch.bind(null, locale, tenantId);
  const leaveCopy =
    locale === "ar"
      ? {
          weeklyRest: "أيام الراحة الأسبوعية",
          industrial: "منشأة صناعية",
          industrialHelp:
            "يُفعّل شرائح الإجازة المرضية الخاصة بالمنشآت الصناعية.",
        }
      : {
          weeklyRest: "Weekly rest days",
          industrial: "Industrial establishment",
          industrialHelp: "Enables the statutory industrial sick-leave tiers.",
        };
  const attendanceCopy =
    locale === "ar"
      ? {
          title: "قواعد الحضور",
          late: "سماح التأخير (دقيقة)",
          early: "سماح الانصراف المبكر (دقيقة)",
          overtime: "حد بدء الإضافي (دقيقة)",
          latitude: "خط عرض الفرع",
          longitude: "خط طول الفرع",
          radius: "نطاق الموقع بالمتر",
          mobile: "السماح بالبصمة من الهاتف",
          selfie: "صورة شخصية مطلوبة",
          mobileHelp: "يتحقق النظام من موقع الفرع ويحتفظ بالصورة كدليل للحضور.",
        }
      : {
          title: "Attendance rules",
          late: "Late grace (minutes)",
          early: "Early-departure grace (minutes)",
          overtime: "Overtime threshold (minutes)",
          latitude: "Branch latitude",
          longitude: "Branch longitude",
          radius: "Geofence radius (metres)",
          mobile: "Allow mobile clock",
          selfie: "Require attendance selfie",
          mobileHelp:
            "Shiftly validates the branch location and keeps the selfie as attendance evidence.",
        };
  const weekdays = [
    [1, d.monday],
    [2, d.tuesday],
    [3, d.wednesday],
    [4, d.thursday],
    [5, d.friday],
    [6, d.saturday],
    [7, d.sunday],
  ] as const;

  const addBranch = locale === "ar" ? "إضافة فرع" : "Add branch";
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{d.branches}</h1>
        </div>
        {canManage ? (
          <CreateDialog
            closeLabel={d.close}
            description={
              locale === "ar"
                ? "أنشئ موقع عمل جديدًا ثم اضبط قواعد الجدولة والحضور الخاصة به."
                : "Create a work location, then configure its scheduling and attendance rules."
            }
            eyebrow={d.branches}
            title={addBranch}
            triggerLabel={addBranch}
            width="medium"
          >
            <ActionForm
              action={action}
              className="form-grid"
              errorMessage={d.actionFailed}
              pendingMessage={d.saving}
              resetOnSuccess
              successMessage={d.branchCreated}
            >
              <div className="automatic-record-note full">
                <span aria-hidden="true">⚡</span>
                <div>
                  <strong>
                    {locale === "ar"
                      ? "كود الفرع تلقائي"
                      : "Automatic branch code"}
                  </strong>
                  <small>
                    {locale === "ar"
                      ? "سيُنشئ Shiftly كودًا فريدًا عند حفظ الفرع."
                      : "Shiftly creates the next unique code when the branch is saved."}
                  </small>
                </div>
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
                <button className="button">{addBranch}</button>
              </div>
            </ActionForm>
          </CreateDialog>
        ) : null}
      </div>

      <div className="grid branch-grid section-gap">
        {data?.map((row) => {
          const updateAction = updateBranchSchedulingRules.bind(
            null,
            locale,
            tenantId,
            row.id,
          );
          return (
            <section className="card stack" key={row.id}>
              <div className="card-heading">
                <div>
                  <strong>{row.name_en}</strong>
                  <div className="muted code">{row.code}</div>
                </div>
                <span className="badge">
                  {row.is_active ? d.active : d.inactive}
                </span>
              </div>
              <h3>{d.schedulingRules}</h3>
              {canManage ? (
                <ActionForm
                  action={updateAction}
                  className="stack"
                  errorMessage={d.actionFailed}
                  pendingMessage={d.saving}
                  successMessage={d.branchUpdated}
                >
                  <div className="field">
                    <label>{d.operationalDayStart}</label>
                    <input
                      className="input"
                      type="time"
                      name="operationalDayStart"
                      defaultValue={String(row.operational_day_start).slice(
                        0,
                        5,
                      )}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>{d.maximumShiftHours}</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="24"
                      name="maximumShiftHours"
                      defaultValue={row.maximum_shift_hours}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>{d.weekStartsOn}</label>
                    <select
                      className="select"
                      name="weekStartIsodow"
                      defaultValue={row.week_start_isodow}
                    >
                      <option value="1">{d.monday}</option>
                      <option value="2">{d.tuesday}</option>
                      <option value="3">{d.wednesday}</option>
                      <option value="4">{d.thursday}</option>
                      <option value="5">{d.friday}</option>
                      <option value="6">{d.saturday}</option>
                      <option value="7">{d.sunday}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{leaveCopy.weeklyRest}</label>
                    <div className="weekday-checks">
                      {weekdays.map(([value, label]) => (
                        <label key={value}>
                          <input
                            defaultChecked={row.weekly_rest_isodows?.includes(
                              value,
                            )}
                            name="weeklyRestIsodows"
                            type="checkbox"
                            value={value}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="role-option">
                    <input
                      defaultChecked={row.is_industrial_establishment}
                      name="isIndustrialEstablishment"
                      type="checkbox"
                    />
                    <span>
                      <strong>{leaveCopy.industrial}</strong>
                      <small>{leaveCopy.industrialHelp}</small>
                    </span>
                  </label>
                  <div className="field">
                    <label>{d.defaultVisibility}</label>
                    <select
                      className="select"
                      name="defaultScheduleVisibility"
                      defaultValue={row.default_schedule_visibility}
                    >
                      <option value="self">{d.selfOnly}</option>
                      <option value="team">{d.teamVisibility}</option>
                      <option value="branch">{d.branchVisibility}</option>
                      <option value="all">{d.everyone}</option>
                    </select>
                  </div>
                  <h3 className="full">{attendanceCopy.title}</h3>
                  <div className="form-grid three-columns attendance-rule-grid">
                    <div className="field">
                      <label>{attendanceCopy.late}</label>
                      <input
                        className="input"
                        defaultValue={row.late_grace_minutes}
                        max="240"
                        min="0"
                        name="lateGraceMinutes"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{attendanceCopy.early}</label>
                      <input
                        className="input"
                        defaultValue={row.early_departure_grace_minutes}
                        max="240"
                        min="0"
                        name="earlyDepartureGraceMinutes"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{attendanceCopy.overtime}</label>
                      <input
                        className="input"
                        defaultValue={row.overtime_threshold_minutes}
                        max="480"
                        min="0"
                        name="overtimeThresholdMinutes"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{attendanceCopy.latitude}</label>
                      <input
                        className="input"
                        defaultValue={row.geofence_latitude ?? ""}
                        max="90"
                        min="-90"
                        name="geofenceLatitude"
                        step="0.000001"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{attendanceCopy.longitude}</label>
                      <input
                        className="input"
                        defaultValue={row.geofence_longitude ?? ""}
                        max="180"
                        min="-180"
                        name="geofenceLongitude"
                        step="0.000001"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{attendanceCopy.radius}</label>
                      <input
                        className="input"
                        defaultValue={row.geofence_radius_metres}
                        max="5000"
                        min="20"
                        name="geofenceRadiusMetres"
                        type="number"
                      />
                    </div>
                  </div>
                  <div className="role-option-grid">
                    <label className="role-option">
                      <input
                        defaultChecked={row.mobile_clock_enabled}
                        name="mobileClockEnabled"
                        type="checkbox"
                      />
                      <span>
                        <strong>{attendanceCopy.mobile}</strong>
                        <small>{attendanceCopy.mobileHelp}</small>
                      </span>
                    </label>
                    <label className="role-option">
                      <input
                        defaultChecked={row.attendance_selfie_required}
                        name="attendanceSelfieRequired"
                        type="checkbox"
                      />
                      <span>
                        <strong>{attendanceCopy.selfie}</strong>
                        <small>{attendanceCopy.mobileHelp}</small>
                      </span>
                    </label>
                  </div>
                  <button className="button secondary">{d.save}</button>
                </ActionForm>
              ) : (
                <dl className="detail-list">
                  <div>
                    <dt>{d.operationalDayStart}</dt>
                    <dd>{String(row.operational_day_start).slice(0, 5)}</dd>
                  </div>
                  <div>
                    <dt>{d.maximumShiftHours}</dt>
                    <dd>{row.maximum_shift_hours}</dd>
                  </div>
                  <div>
                    <dt>{d.defaultVisibility}</dt>
                    <dd>{row.default_schedule_visibility}</dd>
                  </div>
                  <div>
                    <dt>{attendanceCopy.late}</dt>
                    <dd>{row.late_grace_minutes}</dd>
                  </div>
                  <div>
                    <dt>{attendanceCopy.overtime}</dt>
                    <dd>{row.overtime_threshold_minutes}</dd>
                  </div>
                  <div>
                    <dt>{attendanceCopy.radius}</dt>
                    <dd>{row.geofence_radius_metres}</dd>
                  </div>
                </dl>
              )}
            </section>
          );
        })}
      </div>
      {!data?.length ? (
        <div className="card empty section-gap">{d.empty}</div>
      ) : null}
    </>
  );
}
