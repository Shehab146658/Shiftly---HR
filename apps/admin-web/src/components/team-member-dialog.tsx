"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";

type EmployeeOption = {
  id: string;
  code: string;
  name: string;
  position?: string | null;
  selected: boolean;
};

export function TeamMemberDialog({
  action,
  employees,
  teamName,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  employees: EmployeeOption[];
  teamName: string;
  labels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      new Set(
        employees
          .filter((employee) => employee.selected)
          .map((employee) => employee.id),
      ),
  );
  const visibleEmployees = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return employees;
    return employees.filter((employee) =>
      `${employee.code} ${employee.name} ${employee.position ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [employees, query]);

  function toggleEmployee(employeeId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  return (
    <CreateDialog
      closeLabel={labels.close}
      description={labels.help}
      eyebrow={labels.members}
      title={`${labels.members} · ${teamName}`}
      triggerClassName="button secondary small-button"
      triggerLabel={labels.manage}
      width="medium"
    >
      <ActionForm
        action={action}
        className="stack"
        errorMessage={labels.failed}
        pendingMessage={labels.saving}
        successMessage={labels.saved}
      >
        {[...selectedIds].map((employeeId) => (
          <input
            key={employeeId}
            name="employeeIds"
            type="hidden"
            value={employeeId}
          />
        ))}
        <div className="field">
          <label>{labels.search}</label>
          <input
            className="input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.search}
            type="search"
            value={query}
          />
        </div>
        <div className="team-member-picker">
          {visibleEmployees.map((employee) => (
            <label className="team-member-option" key={employee.id}>
              <input
                checked={selectedIds.has(employee.id)}
                onChange={() => toggleEmployee(employee.id)}
                type="checkbox"
              />
              <span className="picker-avatar">
                {employee.name.trim().slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{employee.name}</strong>
                <small>
                  {employee.code}
                  {employee.position ? ` · ${employee.position}` : ""}
                </small>
              </span>
            </label>
          ))}
          {!visibleEmployees.length ? (
            <div className="empty">{labels.empty}</div>
          ) : null}
        </div>
        <p className="muted">{labels.syncHelp}</p>
        <button className="button" type="submit">
          {labels.save}
        </button>
      </ActionForm>
    </CreateDialog>
  );
}
