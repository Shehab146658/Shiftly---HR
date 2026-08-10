"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";

type EmployeeOption = {
  id: string;
  code: string;
  name: string;
  position?: string | null;
  branchName?: string | null;
  belongsToScheduleBranch: boolean;
};

type DayOption = { value: string; dayLabel: string; shortLabel: string };
type ShiftOption = { id: string; label: string };

export function ScheduleAssignmentPlanner({
  action,
  employees,
  days,
  shifts,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  employees: EmployeeOption[];
  days: DayOption[];
  shifts: ShiftOption[];
  labels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [branchOnly, setBranchOnly] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(days[0] ? [days[0].value] : []));
  const [entryType, setEntryType] = useState("shift");
  const [shiftTemplateId, setShiftTemplateId] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("22:00");

  const visibleEmployees = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      if (branchOnly && !employee.belongsToScheduleBranch) return false;
      if (!normalized) return true;
      return `${employee.code} ${employee.name} ${employee.position ?? ""} ${employee.branchName ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [branchOnly, employees, query]);

  const assignmentCount = selectedEmployees.size * selectedDays.size;
  const usesCustomTimes = entryType === "shift" && !shiftTemplateId;
  const overnight = usesCustomTimes && Boolean(startTime && endTime) && endTime <= startTime;

  function toggle(setter: (value: Set<string>) => void, current: Set<string>, value: string) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function selectVisible() {
    setSelectedEmployees((current) => new Set([...current, ...visibleEmployees.map((employee) => employee.id)]));
  }

  return <section className="card schedule-planner-card">
    <div className="planner-heading">
      <div>
        <span className="eyebrow">{labels.schedulePlanner}</span>
        <h2>{labels.assignWorkingTime}</h2>
        <p className="muted">{labels.schedulePlannerHelp}</p>
      </div>
      <div className="planner-summary" aria-live="polite">
        <strong>{assignmentCount}</strong>
        <span>{labels.entries}</span>
      </div>
    </div>

    <ActionForm action={action} className="schedule-planner-form" errorMessage={labels.actionFailed} pendingMessage={labels.saving} successMessage={labels.scheduleEntriesSaved}>
      <section className="planner-step">
        <div className="planner-step-title"><span>1</span><div><h3>{labels.stepEmployees}</h3><p>{labels.stepEmployeesHelp}</p></div></div>
        <div className="employee-picker-tools">
          <label className="employee-search"><span className="sr-only">{labels.searchEmployees}</span><input className="input" onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchEmployees} type="search" value={query} /></label>
          <div className="segmented-control" role="group" aria-label={labels.employeeScope}>
            <button className={branchOnly ? "active" : ""} onClick={() => setBranchOnly(true)} type="button">{labels.scheduleBranchStaff}</button>
            <button className={!branchOnly ? "active" : ""} onClick={() => setBranchOnly(false)} type="button">{labels.allCompanyStaff}</button>
          </div>
          <button className="text-button" onClick={selectVisible} type="button">{labels.selectVisible}</button>
          <button className="text-button muted-button" onClick={() => setSelectedEmployees(new Set())} type="button">{labels.clearSelection}</button>
        </div>
        <div className="employee-picker-list">
          {visibleEmployees.map((employee) => {
            const selected = selectedEmployees.has(employee.id);
            return <label className={`employee-picker-option${selected ? " selected" : ""}`} key={employee.id}>
              <input checked={selected} name="employeeIds" onChange={() => toggle(setSelectedEmployees, selectedEmployees, employee.id)} type="checkbox" value={employee.id} />
              <span className="picker-avatar">{employee.name.trim().slice(0, 2).toUpperCase()}</span>
              <span className="picker-copy"><strong>{employee.name}</strong><small>{employee.code}{employee.position ? ` · ${employee.position}` : ""}</small></span>
              {employee.branchName ? <span className={`picker-branch${employee.belongsToScheduleBranch ? " home" : ""}`}>{employee.branchName}</span> : null}
            </label>;
          })}
          {!visibleEmployees.length ? <div className="empty">{labels.noMatchingEmployees}</div> : null}
        </div>
        <p className="selection-caption"><strong>{selectedEmployees.size}</strong> {labels.peopleSelected}</p>
      </section>

      <section className="planner-step">
        <div className="planner-step-title"><span>2</span><div><h3>{labels.stepDays}</h3><p>{labels.stepDaysHelp}</p></div></div>
        <div className="day-picker-grid">
          {days.map((day) => {
            const selected = selectedDays.has(day.value);
            return <label className={`day-picker-option${selected ? " selected" : ""}`} key={day.value}>
              <input checked={selected} name="workDates" onChange={() => toggle(setSelectedDays, selectedDays, day.value)} type="checkbox" value={day.value} />
              <strong>{day.dayLabel}</strong><small>{day.shortLabel}</small>
            </label>;
          })}
        </div>
      </section>

      <section className="planner-step">
        <div className="planner-step-title"><span>3</span><div><h3>{labels.stepHours}</h3><p>{labels.stepHoursHelp}</p></div></div>
        <div className="form-grid three-columns planner-fields">
          <div className="field"><label>{labels.entryType}</label><select className="select" name="entryType" onChange={(event) => setEntryType(event.target.value)} value={entryType}><option value="shift">{labels.shift}</option><option value="off">{labels.off}</option><option value="leave">{labels.leave}</option><option value="training">{labels.training}</option><option value="assignment">{labels.assignment}</option></select></div>
          {entryType === "shift" ? <>
            <div className="field"><label>{labels.shiftTemplate}</label><select className="select" name="shiftTemplateId" onChange={(event) => setShiftTemplateId(event.target.value)} value={shiftTemplateId}><option value="">{labels.exactHours}</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.label}</option>)}</select></div>
            <div className="field"><label>{labels.breakMinutes}</label><input className="input" defaultValue="0" max="480" min="0" name="breakMinutes" type="number" /></div>
            {usesCustomTimes ? <>
              <div className="field"><label>{labels.startTime}</label><input className="input" name="customStartTime" onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} /></div>
              <div className="field"><label>{labels.endTime}</label><input className="input" name="customEndTime" onChange={(event) => setEndTime(event.target.value)} required type="time" value={endTime} /></div>
              <div className={`overnight-indicator${overnight ? " active" : ""}`}><span aria-hidden="true">↗</span><div><strong>{overnight ? labels.endsNextDay : labels.sameDayShift}</strong><small>{overnight ? labels.overnightDetected : labels.overnightAutomatic}</small></div></div>
            </> : null}
          </> : <div className="notice compact-notice full">{labels.replaceDayHelp}</div>}
          <div className="field"><label>{labels.position}</label><input className="input" name="positionLabel" placeholder={labels.optionalOverride} /></div>
          <div className="field span-two"><label>{labels.notes}</label><input className="input" name="notes" /></div>
        </div>
        {entryType === "shift" ? <p className="planner-tip">{labels.splitShiftHelp}</p> : null}
      </section>

      <div className="planner-submit-bar">
        <div><strong>{selectedEmployees.size} × {selectedDays.size} = {assignmentCount}</strong><span>{labels.assignmentPreview}</span></div>
        <button className="button" disabled={!assignmentCount} type="submit">{labels.assignToSchedule}</button>
      </div>
    </ActionForm>
  </section>;
}
