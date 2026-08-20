"use client";

import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { EmployeeOrganizationFields } from "@/components/employee-organization-fields";

type Option = { id: string; name_en: string };
type TeamOption = Option & { branch_id?: string | null };
type RoleOption = { id: string; name: string };

export function EmployeeCreateDialog({
  action,
  branches,
  teams,
  managers,
  roles,
  defaultRoleId,
  canManageCompensation = false,
  defaultCurrency = "EGP",
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  branches: Option[];
  teams: TeamOption[];
  managers: Option[];
  roles: RoleOption[];
  defaultRoleId?: string;
  canManageCompensation?: boolean;
  defaultCurrency?: string;
  labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  return (
    <>
      <button
        className="button button-with-icon"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true">＋</span>
        {labels.addEmployee}
      </button>
      {open ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            aria-labelledby="employee-dialog-title"
            aria-modal="true"
            className="modal-panel employee-create-modal"
            role="dialog"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">{labels.employeeDirectory}</span>
                <h2 id="employee-dialog-title">{labels.addEmployee}</h2>
                <p>{labels.addEmployeeHelp}</p>
              </div>
              <button
                aria-label={labels.close}
                className="modal-close"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <ActionForm
              action={action}
              className="form-grid three-columns"
              errorMessage={labels.actionFailed}
              pendingMessage={labels.saving}
              resetOnSuccess
              successMessage={labels.employeeCreated}
            >
              <div className="automatic-record-note full">
                <span aria-hidden="true">⚡</span>
                <div>
                  <strong>{labels.automaticSetup}</strong>
                  <small>{labels.automaticSetupHelp}</small>
                </div>
              </div>
              <input name="status" type="hidden" value="active" />
              <div className="field">
                <label>{labels.nameEnglish}</label>
                <input autoFocus className="input" name="nameEn" required />
              </div>
              <div className="field">
                <label>{labels.nameArabic}</label>
                <input className="input" name="nameAr" dir="rtl" />
              </div>
              <div className="field">
                <label>{labels.position}</label>
                <input className="input" name="position" />
              </div>
              <div className="field">
                <label>{labels.email}</label>
                <input className="input" name="email" type="email" />
              </div>
              <div className="field">
                <label>{labels.phone}</label>
                <input className="input" name="phone" />
              </div>
              <EmployeeOrganizationFields
                branches={branches}
                labels={labels}
                managers={managers}
                teams={teams}
              />
              <div className="field">
                <label>{labels.hireDate}</label>
                <input className="input" name="hireDate" type="date" />
              </div>
              <div className="field">
                <label>{labels.preferredLanguage}</label>
                <select className="select" name="preferredLocale">
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              {roles.length ? (
                <div className="field">
                  <label>{labels.accessRole}</label>
                  <select
                    className="select"
                    defaultValue={defaultRoleId}
                    name="roleId"
                    required
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <small className="muted">{labels.accessRoleHelp}</small>
                </div>
              ) : null}
              {canManageCompensation ? (
                <fieldset className="salary-create-section full">
                  <legend>{labels.startingSalary}</legend>
                  <p className="muted">{labels.startingSalaryHelp}</p>
                  <div className="form-grid three-columns">
                    <div className="field">
                      <label>{labels.salaryBasis}</label>
                      <select className="select" name="salaryBasis">
                        <option value="monthly">{labels.monthly}</option>
                        <option value="daily">{labels.daily}</option>
                        <option value="hourly">{labels.hourly}</option>
                        <option value="mixed">{labels.mixed}</option>
                        <option value="commission">{labels.commission}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{labels.baseSalary}</label>
                      <input
                        className="input"
                        min="0"
                        name="baseSalary"
                        placeholder={labels.optional}
                        step="0.01"
                        type="number"
                      />
                    </div>
                    <div className="field">
                      <label>{labels.currency}</label>
                      <input
                        className="input"
                        defaultValue={defaultCurrency}
                        maxLength={3}
                        name="currencyCode"
                      />
                    </div>
                    <div className="field">
                      <label>{labels.salaryEffectiveFrom}</label>
                      <input
                        className="input"
                        name="salaryEffectiveFrom"
                        type="date"
                      />
                    </div>
                  </div>
                </fieldset>
              ) : null}
              <div className="field full">
                <label>{labels.notes}</label>
                <textarea className="input" name="notes" rows={2} />
              </div>
              <div className="modal-actions full">
                <button
                  className="button ghost"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  {labels.cancel}
                </button>
                <button className="button" type="submit">
                  {labels.addEmployee}
                </button>
              </div>
            </ActionForm>
          </section>
        </div>
      ) : null}
    </>
  );
}
