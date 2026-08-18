import Link from "next/link";
import { notFound } from "next/navigation";
import { bulkAssignScheduleEntries, copyWeeklySchedule, deleteScheduleEntry, transitionSchedule } from "../../actions";
import { ActionForm } from "@/components/action-form";
import { ScheduleAssignmentPlanner } from "@/components/schedule-assignment-planner";
import { getTenantPageContext } from "@/lib/page-context";
import { formatScheduleTime, weekdayKey, weekDates } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

function entryText(entry: Record<string, unknown>, d: ReturnType<typeof import("@/lib/i18n").getDictionary>) {
  const type = String(entry.entry_type);
  if (type !== "shift") {
    if (type === "off") return d.off;
    if (type === "leave") return d.leave;
    if (type === "training") return d.training;
    return d.assignment;
  }
  const shift = Array.isArray(entry.shift_templates) ? entry.shift_templates[0] : entry.shift_templates as { name_en?: string; start_time?: string; end_time?: string; end_day_offset?: number } | null;
  if (shift?.name_en) return `${shift.name_en} (${formatScheduleTime(shift.start_time)}–${formatScheduleTime(shift.end_time)}${shift.end_day_offset ? "+1" : ""})`;
  return `${formatScheduleTime(String(entry.custom_start_time ?? ""))}–${formatScheduleTime(String(entry.custom_end_time ?? ""))}${entry.end_day_offset ? "+1" : ""}`;
}

export default async function ScheduleDetailsPage({ params }: { params: Promise<{ locale: string; scheduleId: string }> }) {
  const { locale: rawLocale, scheduleId } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;

  const { data: schedule, error } = await supabase.from("weekly_schedules")
    .select("id, tenant_id, branch_id, week_start, status, visibility, notes, published_at, locked_at, branches(name_en, name_ar)")
    .eq("tenant_id", tenantId).eq("id", scheduleId).maybeSingle();
  if (error) throw error;
  if (!schedule) notFound();

  const [{ data: canManage }, { data: canPublish }, { data: canUnlock }] = await Promise.all([
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "schedules.manage" }),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "schedules.publish" }),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "schedules.unlock" }),
  ]);

  const [{ data: entries }, { data: branchEmployees }, { data: allEmployees }, { data: shifts }, { data: events }] = await Promise.all([
    supabase.from("schedule_entries").select("id, employee_id, work_date, segment_no, entry_type, custom_start_time, custom_end_time, end_day_offset, break_minutes, notes, shift_templates(name_en, name_ar, start_time, end_time, end_day_offset, color_hex), employees(employee_code, name_en, name_ar)").eq("schedule_id", scheduleId).order("work_date").order("segment_no"),
    supabase.from("employees").select("id, employee_code, name_en, name_ar, position").eq("tenant_id", tenantId).eq("branch_id", schedule.branch_id).neq("status", "terminated").order("name_en"),
    supabase.from("employees").select("id, employee_code, name_en, name_ar, position, branches(name_en)").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("shift_templates").select("id, code, name_en, name_ar, start_time, end_time, end_day_offset, branch_id").eq("tenant_id", tenantId).eq("is_active", true).or(`branch_id.is.null,branch_id.eq.${schedule.branch_id}`).order("start_time"),
    supabase.from("schedule_status_events").select("id, from_status, to_status, reason, created_at").eq("schedule_id", scheduleId).order("created_at", { ascending: false }),
  ]);

  const branch = Array.isArray(schedule.branches) ? schedule.branches[0] : schedule.branches;
  const dates = weekDates(schedule.week_start);
  const scheduledEmployeeIds = new Set((entries ?? []).map((entry) => entry.employee_id));
  const boardEmployees = [...(branchEmployees ?? [])];
  for (const employee of allEmployees ?? []) {
    if (scheduledEmployeeIds.has(employee.id) && !boardEmployees.some((existing) => existing.id === employee.id)) boardEmployees.push(employee);
  }
  const entryMap = new Map<string, typeof entries>();
  for (const entry of entries ?? []) {
    const key = `${entry.employee_id}:${entry.work_date}`;
    const current = entryMap.get(key) ?? [];
    current.push(entry);
    entryMap.set(key, current);
  }

  const addAction = bulkAssignScheduleEntries.bind(null, locale, tenantId, scheduleId);
  const publishAction = transitionSchedule.bind(null, locale, scheduleId, "published");
  const lockAction = transitionSchedule.bind(null, locale, scheduleId, "locked");
  const reopenAction = transitionSchedule.bind(null, locale, scheduleId, "draft");
  const archiveAction = transitionSchedule.bind(null, locale, scheduleId, "archived");
  const copyAction = copyWeeklySchedule.bind(null, locale, scheduleId);
  const editable = schedule.status === "draft" && Boolean(canManage);
  const scheduledPeople = new Set((entries ?? []).map((entry) => entry.employee_id));
  const assignedDays = new Set((entries ?? []).map((entry) => `${entry.employee_id}:${entry.work_date}`));
  const possibleVisibleDays = Math.max(boardEmployees.length * 7, 1);
  const coverage = Math.min(100, Math.round((assignedDays.size / possibleVisibleDays) * 100));
  const plannerEmployees = (allEmployees ?? []).map((employee) => {
    const employeeBranch = Array.isArray(employee.branches) ? employee.branches[0] : employee.branches;
    return {
      id: employee.id,
      code: employee.employee_code,
      name: locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en,
      position: employee.position,
      branchName: employeeBranch?.name_en ?? null,
      belongsToScheduleBranch: (branchEmployees ?? []).some((branchEmployee) => branchEmployee.id === employee.id),
    };
  });
  const plannerDays = dates.map((date) => ({ value: date, dayLabel: d[weekdayKey(date)], shortLabel: date.slice(5) }));
  const plannerShifts = (shifts ?? []).map((shift) => ({
    id: shift.id,
    label: `${shift.code} · ${locale === "ar" && shift.name_ar ? shift.name_ar : shift.name_en} (${formatScheduleTime(shift.start_time)}–${formatScheduleTime(shift.end_time)}${shift.end_day_offset ? "+1" : ""})`,
  }));

  return <>
    <div className="page-head">
      <div>
        <Link className="text-link" href={`/${locale}/schedules`}>← {d.backToSchedules}</Link>
        <h1 className="page-title">{locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en} · {schedule.week_start}</h1>
        <p className="muted">{d.visibility}: {schedule.visibility} · <span className={`badge status-${schedule.status}`}>{schedule.status}</span></p>
      </div>
      <div className="toolbar">
        {canPublish && schedule.status === "draft" ? <ActionForm action={publishAction} errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.schedulePublished}><button className="button" type="submit">{d.publish}</button></ActionForm> : null}
        {canPublish && schedule.status === "published" ? <ActionForm action={lockAction} errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleLocked}><button className="button" type="submit">{d.lock}</button></ActionForm> : null}
        {canUnlock && (schedule.status === "published" || schedule.status === "locked") ? <ActionForm action={reopenAction} className="toolbar" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleReopened}><input className="input compact" name="reason" minLength={5} placeholder={d.reason} required /><button className="button secondary" type="submit">{d.reopen}</button></ActionForm> : null}
        {canPublish && (schedule.status === "published" || schedule.status === "locked") ? <ActionForm action={archiveAction} confirmMessage={d.archiveScheduleConfirm} errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleArchived}><button className="button ghost" type="submit">{d.archive}</button></ActionForm> : null}
      </div>
    </div>

    {!editable ? <div className="notice section-gap">{canManage ? d.scheduleLockedHelp : (locale === "ar" ? "هذا الجدول للعرض فقط وفق صلاحيات دورك." : "This schedule is read-only for your assigned role.")}</div> : null}

    <div className="schedule-coverage-strip section-gap">
      <div><span>{d.branchStaff}</span><strong>{branchEmployees?.length ?? 0}</strong></div>
      <div><span>{d.scheduledPeople}</span><strong>{scheduledPeople.size}</strong></div>
      <div><span>{d.assignedDays}</span><strong>{assignedDays.size}</strong></div>
      <div><span>{d.weekCoverage}</span><strong>{coverage}%</strong></div>
    </div>

    {editable ? <ScheduleAssignmentPlanner
      action={addAction}
      days={plannerDays}
      employees={plannerEmployees}
      labels={{
        schedulePlanner: d.schedulePlanner, assignWorkingTime: d.assignWorkingTime, schedulePlannerHelp: d.schedulePlannerHelp,
        entries: d.entries, stepEmployees: d.stepEmployees, stepEmployeesHelp: d.stepEmployeesHelp, searchEmployees: d.searchEmployees,
        employeeScope: d.employeeScope, scheduleBranchStaff: d.scheduleBranchStaff, allCompanyStaff: d.allCompanyStaff,
        selectVisible: d.selectVisible, clearSelection: d.clearSelection, noMatchingEmployees: d.noMatchingEmployees,
        peopleSelected: d.peopleSelected, stepDays: d.stepDays, stepDaysHelp: d.stepDaysHelp, stepHours: d.stepHours,
        stepHoursHelp: d.stepHoursHelp, entryType: d.entryType, shift: d.shift, off: d.off, leave: d.leave,
        training: d.training, assignment: d.assignment, shiftTemplate: d.shiftTemplate, exactHours: d.exactHours,
        breakMinutes: d.breakMinutes, startTime: d.startTime, endTime: d.endTime, endsNextDay: d.endsNextDay,
        sameDayShift: d.sameDayShift, overnightDetected: d.overnightDetected, overnightAutomatic: d.overnightAutomatic,
        replaceDayHelp: d.replaceDayHelp, position: d.position, optionalOverride: d.optionalOverride, notes: d.notes,
        splitShiftHelp: d.splitShiftHelp, assignmentPreview: d.assignmentPreview, assignToSchedule: d.assignToSchedule,
        actionFailed: d.actionFailed, saving: d.saving, scheduleEntriesSaved: d.scheduleEntriesSaved,
      }}
      shifts={plannerShifts}
    /> : null}

    <section className="card stack section-gap">
      <div className="card-heading"><h2>{d.scheduleBoard}</h2><span className="muted">{schedule.notes}</span></div>
      <div className="schedule-board"><table><thead><tr><th>{d.employee}</th>{dates.map((date) => <th key={date}><span>{d[weekdayKey(date)]}</span><small>{date.slice(5)}</small></th>)}</tr></thead><tbody>
        {boardEmployees.map((employee) => <tr key={employee.id}><th className="employee-cell"><strong>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</strong><small>{employee.employee_code}</small></th>{dates.map((date) => {
          const cellEntries = entryMap.get(`${employee.id}:${date}`) ?? [];
          return <td key={date} className={cellEntries.length ? "scheduled-cell" : ""}>{cellEntries.map((entry) => {
            const removeAction = deleteScheduleEntry.bind(null, locale, tenantId, scheduleId, entry.id);
            return <div className={`schedule-chip entry-${entry.entry_type}`} key={entry.id}><span>{entryText(entry as unknown as Record<string, unknown>, d)}</span>{editable ? <ActionForm action={removeAction} confirmMessage={d.deleteEntryConfirm} errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleEntryRemoved}><button title={d.delete} className="chip-delete" type="submit">×</button></ActionForm> : null}</div>;
          })}</td>;
        })}</tr>)}
      </tbody></table>{!boardEmployees.length ? <div className="empty">{d.scheduleEmpty}</div> : null}</div>
    </section>

    <div className="grid two-columns section-gap">
      {canManage ? <section className="card stack">
        <h2>{d.copyWeek}</h2>
        <ActionForm action={copyAction} className="stack" errorMessage={d.actionFailed} pendingMessage={d.saving} successMessage={d.scheduleCopied}><div className="field"><label>{d.targetWeek}</label><input className="input" type="date" name="targetWeekStart" required /></div><button className="button secondary" type="submit">{d.copyWeek}</button></ActionForm>
      </section> : null}
      <section className="card stack">
        <h2>{d.statusHistory}</h2>
        <div className="timeline">{events?.map((event) => <div className="timeline-item" key={event.id}><strong>{event.from_status ?? "—"} → {event.to_status}</strong><span>{new Date(event.created_at).toLocaleString(locale)}</span>{event.reason ? <small>{event.reason}</small> : null}</div>)}{!events?.length ? <div className="muted">{d.empty}</div> : null}</div>
      </section>
    </div>
  </>;
}
