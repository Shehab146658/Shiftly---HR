import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile shell exposes an accessible drawer instead of stacking navigation", async () => {
  const [shell, styles] = await Promise.all([
    readSource("../src/components/app-shell.tsx"),
    readSource("../src/app/globals.css"),
  ]);

  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /sidebar-overlay-visible/);
  assert.match(shell, /setMenuOpen\(false\)/);
  assert.match(styles, /\.menu-button\s*\{/);
  assert.match(styles, /position:\s*fixed;[\s\S]*\.sidebar\.sidebar-open/);
});

test("employee access roles are editable and persisted through the role RPC", async () => {
  const [actions, details, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/actions.ts"),
    readSource("../src/app/[locale]/(protected)/employees/[employeeId]/page.tsx"),
    readSource("../../../supabase/migrations/202607260004_employee_role_assignments.sql"),
  ]);

  assert.match(actions, /export async function updateEmployeeRoles/);
  assert.match(actions, /rpc\("set_employee_roles"/);
  assert.match(details, /name="roleIds"/);
  assert.match(details, /accountPendingHelp/);
  assert.match(migration, /create table public\.employee_role_assignments/);
  assert.match(migration, /create policy employee_role_assignments_manage/);
});

test("employee creation includes a role dropdown and existing employees receive the employee role", async () => {
  const [page, actions, defaultRolesMigration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/employees/page.tsx"),
    readSource("../src/app/[locale]/(protected)/actions.ts"),
    readSource("../../../supabase/migrations/202607260005_default_employee_roles.sql"),
  ]);

  assert.match(page, /name="roleId"/);
  assert.match(page, /role\.name === "employee"/);
  assert.match(actions, /p_role_ids:\s*\[roleId\]/);
  assert.match(defaultRolesMigration, /create trigger assign_default_employee_role/);
  assert.match(defaultRolesMigration, /join public\.roles r[\s\S]*r\.name = 'employee'/);
});
