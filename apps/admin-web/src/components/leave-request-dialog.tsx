"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";

type EmployeeOption = { id: string; name: string; code: string };
type LeaveTypeOption = { id: string; name: string; requiresDocument: boolean };

export function LeaveRequestDialog({
  action,
  employees,
  leaveTypes,
  defaultEmployeeId,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  employees: EmployeeOption[];
  leaveTypes: LeaveTypeOption[];
  defaultEmployeeId?: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  return <>
    <button className="button button-with-icon" onClick={() => setOpen(true)} type="button">
      <span aria-hidden="true">＋</span>{labels.requestLeave}
    </button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section aria-labelledby="leave-dialog-title" aria-modal="true" className="modal-panel leave-request-modal" role="dialog">
        <div className="modal-head">
          <div><span className="eyebrow">{labels.leaveManagement}</span><h2 id="leave-dialog-title">{labels.requestLeave}</h2><p>{labels.requestHelp}</p></div>
          <button aria-label={labels.close} className="modal-close" onClick={() => setOpen(false)} type="button">×</button>
        </div>
        <ActionForm action={action} className="form-grid" errorMessage={labels.actionFailed} pendingMessage={labels.saving} resetOnSuccess successMessage={labels.requestCreated}>
          <div className="field"><label>{labels.employee}</label><select className="select" defaultValue={defaultEmployeeId ?? employees[0]?.id} name="employeeId" required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></div>
          <div className="field"><label>{labels.leaveType}</label><select className="select" name="leaveTypeId" required>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}{type.requiresDocument ? ` · ${labels.documentRequired}` : ""}</option>)}</select></div>
          <div className="field"><label>{labels.startDate}</label><input className="input" name="startDate" type="date" required /></div>
          <div className="field"><label>{labels.endDate}</label><input className="input" name="endDate" type="date" required /></div>
          <div className="field"><label>{labels.dayPart}</label><select className="select" defaultValue="full" name="dayPart"><option value="full">{labels.fullDay}</option><option value="first_half">{labels.firstHalf}</option><option value="second_half">{labels.secondHalf}</option><option value="hours">{labels.hours}</option></select></div>
          <div className="field"><label>{labels.minutesWhenHourly}</label><input className="input" min="1" max="720" name="requestedMinutes" type="number" /></div>
          <div className="field"><label>{labels.expectedDelivery}</label><input className="input" name="expectedDeliveryDate" type="date" /></div>
          <div className="field"><label>{labels.actualDelivery}</label><input className="input" name="actualDeliveryDate" type="date" /></div>
          <div className="field full"><label>{labels.reason}</label><textarea className="input" name="reason" rows={3} /></div>
          <div className="field full"><label>{labels.supportingDocument}</label><input accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="input file-input" name="supportingDocument" type="file" /><small className="muted">{labels.documentHelp}</small></div>
          <div className="modal-actions full"><button className="button ghost" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button" type="submit">{labels.submitRequest}</button></div>
        </ActionForm>
      </section>
    </div> : null}
  </>;
}
