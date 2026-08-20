"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";

type Scope = "branch" | "team" | "employee";
type Option = { id: string; label: string };

export function PerformanceTargetForm({
  action,
  branches,
  teams,
  employees,
  policies,
  labels,
  defaults,
}: {
  action: (formData: FormData) => Promise<void>;
  branches: Option[];
  teams: Option[];
  employees: Option[];
  policies: Option[];
  labels: Record<string, string>;
  defaults: { start: string; end: string };
}) {
  const [scope, setScope] = useState<Scope>("branch");
  const options =
    scope === "branch" ? branches : scope === "team" ? teams : employees;
  return (
    <ActionForm
      action={action}
      className="form-grid business-form"
      errorMessage={labels.failed}
      pendingMessage={labels.saving}
      resetOnSuccess
      successMessage={labels.created}
    >
      <div className="automatic-record-note full">
        <span aria-hidden="true">⚡</span>
        <div>
          <strong>{labels.automaticCode}</strong>
          <small>{labels.automaticCodeHelp}</small>
        </div>
      </div>
      <div className="field">
        <label>{labels.name}</label>
        <input className="input" name="name" required />
      </div>
      <div className="field">
        <label>{labels.start}</label>
        <input
          className="input"
          defaultValue={defaults.start}
          name="startDate"
          required
          type="date"
        />
      </div>
      <div className="field">
        <label>{labels.end}</label>
        <input
          className="input"
          defaultValue={defaults.end}
          name="endDate"
          required
          type="date"
        />
      </div>
      <div className="field">
        <label>{labels.scope}</label>
        <select
          className="select"
          name="scope"
          onChange={(event) => setScope(event.target.value as Scope)}
          value={scope}
        >
          <option value="branch">{labels.branch}</option>
          <option value="team">{labels.team}</option>
          <option value="employee">{labels.employee}</option>
        </select>
      </div>
      <div className="field">
        <label>{labels.scopeRecord}</label>
        <select className="select" key={scope} name="scopeId" required>
          <option value="">{labels.select}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{labels.amount}</label>
        <input
          className="input"
          min="1"
          name="targetAmount"
          required
          step="0.01"
          type="number"
        />
      </div>
      <div className="field">
        <label>{labels.currency}</label>
        <input
          className="input"
          defaultValue="EGP"
          maxLength={3}
          name="currencyCode"
          required
        />
      </div>
      <div className="field">
        <label>{labels.policy}</label>
        <select className="select" name="policyId" required>
          <option value="">{labels.select}</option>
          {policies.map((policy) => (
            <option key={policy.id} value={policy.id}>
              {policy.label}
            </option>
          ))}
        </select>
      </div>
      <button className="button full" type="submit">
        {labels.create}
      </button>
    </ActionForm>
  );
}
