"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";

type RequestTypeOption = {
  id: string;
  name: string;
  description: string | null;
  fields: string[];
  requiresAttachment: boolean;
  requiresReason: boolean;
};

type EmployeeOption = { id: string; name: string; code: string };
type BranchOption = { id: string; name: string };

export function RequestCreateDialog({
  action,
  requestTypes,
  employees,
  branches,
  defaultEmployeeId,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  requestTypes: RequestTypeOption[];
  employees: EmployeeOption[];
  branches: BranchOption[];
  defaultEmployeeId?: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [requestTypeId, setRequestTypeId] = useState(requestTypes[0]?.id ?? "");
  const selectedType = useMemo(
    () => requestTypes.find((type) => type.id === requestTypeId) ?? requestTypes[0],
    [requestTypeId, requestTypes],
  );
  const fields = new Set(selectedType?.fields ?? []);

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
    <button className="button button-with-icon" onClick={() => setOpen(true)} type="button"><span aria-hidden="true">＋</span>{labels.newRequest}</button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section aria-labelledby="request-dialog-title" aria-modal="true" className="modal-panel request-create-modal" role="dialog">
        <div className="modal-head">
          <div><span className="eyebrow">{labels.requestCenter}</span><h2 id="request-dialog-title">{labels.newRequest}</h2><p>{selectedType?.description ?? labels.newRequestHelp}</p></div>
          <button aria-label={labels.close} className="modal-close" onClick={() => setOpen(false)} type="button">×</button>
        </div>
        <ActionForm action={action} className="form-grid" errorMessage={labels.actionFailed} pendingMessage={labels.saving} resetOnSuccess successMessage={labels.requestSubmitted}>
          <div className="field"><label>{labels.employee}</label><select className="select" defaultValue={defaultEmployeeId ?? employees[0]?.id} name="employeeId" required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}</option>)}</select></div>
          <div className="field"><label>{labels.requestType}</label><select className="select" name="requestTypeId" onChange={(event) => setRequestTypeId(event.target.value)} value={requestTypeId} required>{requestTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
          {fields.has("title") ? <div className="field full"><label>{labels.title}</label><input className="input" maxLength={180} name="title" required /></div> : null}
          {fields.has("start_date") ? <div className="field"><label>{labels.requestDate}</label><input className="input" name="startDate" type="date" required /></div> : null}
          {fields.has("end_date") ? <div className="field"><label>{labels.endDate}</label><input className="input" name="endDate" type="date" /></div> : null}
          {fields.has("start_time") ? <div className="field"><label>{labels.startTime}</label><input className="input" name="startTime" type="time" required={fields.has("end_time")} /></div> : null}
          {fields.has("end_time") ? <div className="field"><label>{labels.endTime}</label><input className="input" name="endTime" type="time" required={fields.has("start_time")} /></div> : null}
          {fields.has("requested_minutes") ? <div className="field"><label>{labels.requestedMinutes}</label><input className="input" min="1" max="1440" name="requestedMinutes" type="number" /></div> : null}
          {fields.has("branch_id") ? <div className="field"><label>{labels.requestedBranch}</label><select className="select" name="branchId" required><option value="">{labels.chooseBranch}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div> : null}
          <div className="field full"><label>{labels.reason}</label><textarea className="input" maxLength={3000} name="reason" required={selectedType?.requiresReason} rows={4} /></div>
          <div className="field full"><label>{labels.supportingDocument}</label><input accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="input file-input" name="supportingDocument" required={selectedType?.requiresAttachment} type="file" /><small className="muted">{labels.documentHelp}</small></div>
          <div className="request-workflow-preview full"><span className="workflow-node">1</span><span>{labels.managerStep}</span><i>→</i><span className="workflow-node">2</span><span>{labels.finalStep}</span></div>
          <div className="modal-actions full"><button className="button ghost" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button" type="submit">{labels.submitRequest}</button></div>
        </ActionForm>
      </section>
    </div> : null}
  </>;
}
