"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";

type EmployeeOption = { id: string; code: string; name: string; branchId?: string | null };
type BranchOption = { id: string; name: string };

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AttendancePunchDialog({ action, employees, branches, labels }: {
  action: (formData: FormData) => Promise<void>;
  employees: EmployeeOption[];
  branches: BranchOption[];
  labels: Record<string, string>;
}) {
  const initial = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [branchId, setBranchId] = useState(employees[0]?.branchId ?? "");
  const [occurredLocal, setOccurredLocal] = useState(localDateTimeValue(initial));
  const [workDate, setWorkDate] = useState(localDateTimeValue(initial).slice(0, 10));
  const occurredAt = occurredLocal ? new Date(occurredLocal).toISOString() : "";

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("modal-open"); };
  }, [open]);

  function changeEmployee(nextId: string) {
    setEmployeeId(nextId);
    const employee = employees.find((option) => option.id === nextId);
    if (employee?.branchId) setBranchId(employee.branchId);
  }

  return <>
    <button className="button button-with-icon" onClick={() => setOpen(true)} type="button"><span aria-hidden="true">＋</span>{labels.addPunch}</button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section aria-labelledby="attendance-punch-title" aria-modal="true" className="modal-panel attendance-punch-modal" role="dialog">
        <div className="modal-head"><div><span className="eyebrow">{labels.attendance}</span><h2 id="attendance-punch-title">{labels.addPunch}</h2><p>{labels.addPunchHelp}</p></div><button aria-label={labels.close} className="modal-close" onClick={() => setOpen(false)} type="button">×</button></div>
        <ActionForm action={action} className="form-grid" errorMessage={labels.actionFailed} pendingMessage={labels.saving} resetOnSuccess successMessage={labels.punchSaved}>
          <div className="field"><label>{labels.employee}</label><select className="select" name="employeeId" onChange={(event) => changeEmployee(event.target.value)} required value={employeeId}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></div>
          <div className="field"><label>{labels.branch}</label><select className="select" name="branchId" onChange={(event) => setBranchId(event.target.value)} value={branchId}><option value="">{labels.noBranch}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          <div className="field"><label>{labels.workDate}</label><input className="input" name="workDate" onChange={(event) => setWorkDate(event.target.value)} required type="date" value={workDate} /></div>
          <div className="field"><label>{labels.punchType}</label><select className="select" defaultValue="check_in" name="punchType"><option value="check_in">{labels.checkIn}</option><option value="check_out">{labels.checkOut}</option></select></div>
          <div className="field full"><label>{labels.occurredAt}</label><input className="input" onChange={(event) => setOccurredLocal(event.target.value)} required type="datetime-local" value={occurredLocal} /><input name="occurredAt" type="hidden" value={occurredAt} /><small className="muted">{labels.localTimeHelp}</small></div>
          <div className="field full"><label>{labels.notes}</label><textarea className="input" name="notes" rows={3} /></div>
          <div className="notice compact-notice full">{labels.manualAuditHelp}</div>
          <div className="modal-actions full"><button className="button ghost" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button" disabled={!employees.length || !occurredAt} type="submit">{labels.savePunch}</button></div>
        </ActionForm>
      </section>
    </div> : null}
  </>;
}

