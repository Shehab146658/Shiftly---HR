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
  defaultManagerId = "",
}: {
  branches: Option[];
  teams: TeamOption[];
  managers: Option[];
  labels: Record<string, string>;
  defaultBranchId?: string;
  defaultTeamId?: string;
  defaultManagerId?: string;
}) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [teamId, setTeamId] = useState(defaultTeamId);
  const availableTeams = useMemo(
    () => teams.filter((team) => !team.branch_id || !branchId || team.branch_id === branchId),
    [branchId, teams],
  );

  function changeBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    const currentTeam = teams.find((team) => team.id === teamId);
    if (currentTeam?.branch_id && currentTeam.branch_id !== nextBranchId) setTeamId("");
  }

  return <>
    <div className="field"><label>{labels.branch}</label><select className="select" name="branchId" onChange={(event) => changeBranch(event.target.value)} value={branchId}><option value="">{labels.noBranch}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_en}</option>)}</select></div>
    <div className="field"><label>{labels.teamOptional}</label><select className="select" name="teamId" onChange={(event) => setTeamId(event.target.value)} value={teamId}><option value="">{labels.noTeam}</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name_en}</option>)}</select><small className="muted">{labels.teamOptionalHelp}</small></div>
    <div className="field"><label>{labels.manager}</label><select className="select" defaultValue={defaultManagerId} name="managerEmployeeId"><option value="">{labels.noManager}</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name_en}</option>)}</select></div>
  </>;
}

