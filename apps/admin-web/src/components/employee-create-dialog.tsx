"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";

type Option = { id: string; name_en: string };
type RoleOption = { id: string; name: string };

export function EmployeeCreateDialog({
  action,
  branches,
  teams,
  managers,
  roles,
  defaultRoleId,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  branches: Option[];
  teams: Option[];
  managers: Option[];
  roles: RoleOption[];
  defaultRoleId?: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("modal-open"); };
  }, [open]);

  return <>
    <button className="button button-with-icon" onClick={() => setOpen(true)} type="button"><span aria-hidden="true">＋</span>{labels.addEmployee}</button>
    {open ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section aria-labelledby="employee-dialog-title" aria-modal="true" className="modal-panel employee-create-modal" role="dialog">
        <div className="modal-head"><div><span className="eyebrow">{labels.employeeDirectory}</span><h2 id="employee-dialog-title">{labels.addEmployee}</h2><p>{labels.addEmployeeHelp}</p></div><button aria-label={labels.close} className="modal-close" onClick={() => setOpen(false)} type="button">×</button></div>
        <ActionForm action={action} className="form-grid three-columns" errorMessage={labels.actionFailed} pendingMessage={labels.saving} resetOnSuccess successMessage={labels.employeeCreated}>
          <div className="field"><label>{labels.code}</label><input autoFocus className="input" name="employeeCode" required /></div>
          <div className="field"><label>{labels.nameEnglish}</label><input className="input" name="nameEn" required /></div>
          <div className="field"><label>{labels.nameArabic}</label><input className="input" name="nameAr" dir="rtl" /></div>
          <div className="field"><label>{labels.position}</label><input className="input" name="position" /></div>
          <div className="field"><label>{labels.email}</label><input className="input" name="email" type="email" /></div>
          <div className="field"><label>{labels.phone}</label><input className="input" name="phone" /></div>
          <div className="field"><label>{labels.branch}</label><select className="select" name="branchId"><option value="">—</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_en}</option>)}</select></div>
          <div className="field"><label>{labels.team}</label><select className="select" name="teamId"><option value="">—</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name_en}</option>)}</select></div>
          <div className="field"><label>{labels.manager}</label><select className="select" name="managerEmployeeId"><option value="">—</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name_en}</option>)}</select></div>
          <div className="field"><label>{labels.hireDate}</label><input className="input" name="hireDate" type="date" /></div>
          <div className="field"><label>{labels.preferredLanguage}</label><select className="select" name="preferredLocale"><option value="en">English</option><option value="ar">العربية</option></select></div>
          <div className="field"><label>{labels.statusLabel}</label><select className="select" name="status"><option value="active">{labels.active}</option><option value="inactive">{labels.inactive}</option><option value="on_leave">{labels.onLeave}</option><option value="terminated">{labels.terminated}</option></select></div>
          <div className="field"><label>{labels.accessRole}</label><select className="select" defaultValue={defaultRoleId} name="roleId" required>{roles.map((role) => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")}</option>)}</select><small className="muted">{labels.accessRoleHelp}</small></div>
          <div className="field full"><label>{labels.notes}</label><textarea className="input" name="notes" rows={2} /></div>
          <div className="modal-actions full"><button className="button ghost" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button" type="submit">{labels.addEmployee}</button></div>
        </ActionForm>
      </section>
    </div> : null}
  </>;
}
