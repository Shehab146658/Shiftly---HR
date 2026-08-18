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
  assert.match(styles, /\.sidebar-overlay-visible[^}]*inset-inline-start: min\(320px, 86vw\)/);
  assert.match(shell, /setMenuOpen\(false\)/);
  assert.match(shell, /setMenuOpen\(\(open\) => !open\)/);
  assert.match(shell, /shell-menu-button-open/);
  assert.match(styles, /\.menu-button\s*\{/);
  assert.match(styles, /\.shell-menu-button\s*\{[\s\S]*?z-index:\s*70/);
  assert.match(styles, /\.shell \.sidebar\s*\{[^}]*z-index:\s*60/);
  assert.match(styles, /\.shell \.sidebar\.sidebar-open[^}]*transition:\s*none[^}]*transform:\s*none !important/);
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
  const [page, dialog, actions, defaultRolesMigration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/employees/page.tsx"),
    readSource("../src/components/employee-create-dialog.tsx"),
    readSource("../src/app/[locale]/(protected)/actions.ts"),
    readSource("../../../supabase/migrations/202607260005_default_employee_roles.sql"),
  ]);

  assert.match(dialog, /name="roleId"/);
  assert.match(page, /role\.name === "employee"/);
  assert.match(actions, /p_role_ids:\s*\[roleId\]/);
  assert.match(defaultRolesMigration, /create trigger assign_default_employee_role/);
  assert.match(defaultRolesMigration, /join public\.roles r[\s\S]*r\.name = 'employee'/);
});

test("only owner-delegated role managers can assign eligible employee roles", async () => {
  const [employeePage, details, dialog, rolePage, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/employees/page.tsx"),
    readSource("../src/app/[locale]/(protected)/employees/[employeeId]/page.tsx"),
    readSource("../src/components/employee-create-dialog.tsx"),
    readSource("../src/app/[locale]/(protected)/roles/[roleId]/page.tsx"),
    readSource("../../../supabase/migrations/202608180023_owner_role_authorization.sql"),
  ]);

  assert.match(employeePage, /p_permission: "roles\.manage"/);
  assert.match(employeePage, /roles=\{canManageRoles \? roles \?\? \[\] : \[\]\}/);
  assert.match(details, /canManageRoles \? <section/);
  assert.match(dialog, /roles\.length \? <div className="field"/);
  assert.match(rolePage, /disabled=\{isProtected \|\| !canManage\}/);
  assert.match(migration, /has_permission\(v_tenant_id, 'roles\.manage'\)/);
  assert.match(migration, /r\.name = 'owner'/);
});

test("roles provide dedicated permission management and project status is not in navigation", async () => {
  const [roles, details, actions, shell, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/roles/page.tsx"),
    readSource("../src/app/[locale]/(protected)/roles/[roleId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/actions.ts"),
    readSource("../src/components/app-shell.tsx"),
    readSource("../../../supabase/migrations/202607260006_role_permission_management.sql"),
  ]);

  assert.match(roles, /customizePermissions/);
  assert.match(details, /name="permissionKeys"/);
  assert.match(details, /permission-choice-grid/);
  assert.match(actions, /updateRolePermissions/);
  assert.match(migration, /create or replace function public\.set_role_permissions/);
  assert.doesNotMatch(shell, /\["status", d\.status\]/);
});

test("audit history resolves people and renders descriptive field changes", async () => {
  const audit = await readSource("../src/app/[locale]/(protected)/audit/page.tsx");

  assert.match(audit, /employeeByUser/);
  assert.match(audit, /before_data, after_data/);
  assert.match(audit, /audit-change-row/);
  assert.match(audit, /employees\/\$\{employee\.id\}/);
  assert.doesNotMatch(audit, /className="code">\{row\.actor_user_id/);
});

test("company administration actions are permission-gated and employee defaults stay self-service only", async () => {
  const [dashboard, branches, teams, shifts, schedules, schedule, attendance, employees, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/dashboard/page.tsx"),
    readSource("../src/app/[locale]/(protected)/branches/page.tsx"),
    readSource("../src/app/[locale]/(protected)/teams/page.tsx"),
    readSource("../src/app/[locale]/(protected)/shifts/page.tsx"),
    readSource("../src/app/[locale]/(protected)/schedules/page.tsx"),
    readSource("../src/app/[locale]/(protected)/schedules/[scheduleId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/attendance/page.tsx"),
    readSource("../src/app/[locale]/(protected)/employees/page.tsx"),
    readSource("../../../supabase/migrations/202608180025_employee_self_service_authorization.sql"),
  ]);

  assert.match(dashboard, /const can = \(permission: string\)/);
  assert.match(dashboard, /quickLinks[\s\S]*\.filter\(\(link\) => can\(link\.permission\)\)/);
  assert.match(dashboard, /can\("requests\.manage"\)/);
  assert.match(branches, /p_permission: "branches\.manage"/);
  assert.match(teams, /p_permission: "teams\.manage"/);
  assert.match(shifts, /p_permission: "shifts\.manage"/);
  assert.match(schedules, /p_permission: "schedules\.manage"/);
  assert.match(schedule, /canPublish && schedule\.status/);
  assert.match(schedule, /canUnlock &&/);
  assert.match(attendance, /canManage \? <div className="page-actions"/);
  assert.match(attendance, /canReport \|\| canReadAll/);
  assert.match(employees, /canManageEmployees \? <EmployeeCreateDialog/);
  assert.match(migration, /'branches\.read', 'teams\.read', 'shifts\.read'/);
  assert.match(migration, /drop policy if exists branches_read/);
  assert.match(migration, /drop policy if exists roles_read/);
});
