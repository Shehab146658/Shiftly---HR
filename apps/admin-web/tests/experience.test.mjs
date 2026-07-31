import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the product brand and signed-in identity navigate to useful destinations", async () => {
  const shell = await readSource("../src/components/app-shell.tsx");
  assert.match(shell, /sidebar-brand/);
  assert.match(shell, /<BrandMark/);
  assert.match(shell, /profiles\/\$\{userId\}/);
  assert.match(shell, /<AppIcon className="nav-icon"/);
});

test("employee creation opens in a dialog and the directory has one responsive table", async () => {
  const [page, dialog] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/employees/page.tsx"),
    readSource("../src/components/employee-create-dialog.tsx"),
  ]);
  assert.match(page, /<EmployeeCreateDialog/);
  assert.doesNotMatch(page, /employee-card-list/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /setOpen\(true\)/);
});

test("mutating forms provide pending, success, and failure feedback", async () => {
  const [feedback, details, branches] = await Promise.all([
    readSource("../src/components/action-form.tsx"),
    readSource("../src/app/[locale]/(protected)/employees/[employeeId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/branches/page.tsx"),
  ]);
  assert.match(feedback, /type: "success"/);
  assert.match(feedback, /type: "error"/);
  assert.match(feedback, /aria-busy=\{pending\}/);
  assert.match(details, /successMessage=\{d\.employeeUpdated\}/);
  assert.match(branches, /successMessage=\{d\.branchUpdated\}/);
});

test("owner profiles and company-wide team assignment are implemented", async () => {
  const [profile, teams, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/profiles/[userId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/teams/page.tsx"),
    readSource("../../../supabase/migrations/202607260007_member_profiles_and_team_assignment.sql"),
  ]);
  assert.match(profile, /updateOwnProfile/);
  assert.match(profile, /membership_roles/);
  assert.match(teams, /assignAllEmployeesToTeam/);
  assert.match(migration, /assign_all_employees_to_team/);
  assert.match(migration, /set branch_id = null/);
});
