"use client";

import { useMemo, useState } from "react";

type Option = { id: string; name_en: string };
type TeamOption = Option & { branch_id?: string | null };

export function EmployeeOrganizationFields({
  branches,
  teams,
  managers,
  labels,
  defaultBranchId = "",
  defaultTeamId = "",
  defaultManagerIds = [],
}: {
  branches: Option[];
  teams: TeamOption[];
  managers: Option[];
  labels: Record<string, string>;
  defaultBranchId?: string;
  defaultTeamId?: string;
  defaultManagerIds?: string[];
}) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [managerIds, setManagerIds] = useState<Set<string>>(
    () => new Set(defaultManagerIds),
  );
  const availableTeams = useMemo(
    () =>
      teams.filter(
        (team) => !team.branch_id || !branchId || team.branch_id === branchId,
      ),
    [branchId, teams],
  );

  function changeBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    const currentTeam = teams.find((team) => team.id === teamId);
    if (currentTeam?.branch_id && currentTeam.branch_id !== nextBranchId)
      setTeamId("");
  }

  function toggleManager(managerId: string) {
    setManagerIds((current) => {
      const next = new Set(current);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return next;
    });
  }

  return (
    <>
      <div className="field">
        <label>{labels.branch}</label>
        <select
          className="select"
          name="branchId"
          onChange={(event) => changeBranch(event.target.value)}
          value={branchId}
        >
          <option value="">{labels.noBranch}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{labels.teamOptional}</label>
        <select
          className="select"
          name="teamId"
          onChange={(event) => setTeamId(event.target.value)}
          value={teamId}
        >
          <option value="">{labels.noTeam}</option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name_en}
            </option>
          ))}
        </select>
        <small className="muted">{labels.teamOptionalHelp}</small>
      </div>
      <div className="field full manager-picker-field">
        <label>{labels.managers ?? labels.manager}</label>
        <div
          className="manager-picker"
          role="group"
          aria-label={labels.managers ?? labels.manager}
        >
          {managers.map((manager) => (
            <label
              className={`manager-option${managerIds.has(manager.id) ? " selected" : ""}`}
              key={manager.id}
            >
              <input
                checked={managerIds.has(manager.id)}
                name="managerEmployeeIds"
                onChange={() => toggleManager(manager.id)}
                type="checkbox"
                value={manager.id}
              />
              <span className="manager-option-avatar">
                {manager.name_en.trim().slice(0, 2).toUpperCase()}
              </span>
              <span>{manager.name_en}</span>
            </label>
          ))}
          {!managers.length ? (
            <span className="muted">{labels.noManager}</span>
          ) : null}
        </div>
        <small className="muted">
          {labels.managersHelp ?? labels.noManager}
        </small>
      </div>
    </>
  );
}
