import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("request center ships a reusable workflow engine and notification inbox", () => {
  const migration = readFileSync("../../supabase/migrations/202608110011_request_workflow_engine.sql", "utf8");
  const page = readFileSync("src/app/[locale]/(protected)/requests/page.tsx", "utf8");
  const workflows = readFileSync("src/app/[locale]/(protected)/requests/workflows/page.tsx", "utf8");
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  assert.match(migration, /create table public\.request_types/);
  assert.match(migration, /create table public\.approval_workflows/);
  assert.match(migration, /request_approval_mode as enum \('any', 'all', 'count'\)/);
  assert.match(migration, /Active workflows are immutable/);
  assert.match(migration, /create table public\.notifications/);
  assert.match(page, /can_approve_hr_request/);
  assert.match(page, /RequestCreateDialog/);
  assert.match(workflows, /cloneRequestWorkflow/);
  assert.match(workflows, /activateRequestWorkflow/);
  assert.match(shell, /NotificationCenter/);
  assert.match(shell, /\["requests", d\.requests, "requests", "requests\.read"\]/);
});

test("request workflows support the operational request catalogue", () => {
  const migration = readFileSync("../../supabase/migrations/202608110011_request_workflow_engine.sql", "utf8");
  for (const code of ["late_arrival", "early_departure", "hourly_permission", "attendance_correction", "branch_exception", "overtime", "schedule_change", "general_hr"]) {
    assert.match(migration, new RegExp(`'${code}'`));
  }
});

test("the workflow editor manages both HR requests and statutory leave safely", () => {
  const migration = readFileSync("../../supabase/migrations/202608110013_leave_workflow_operations.sql", "utf8");
  const workflows = readFileSync("src/app/[locale]/(protected)/requests/workflows/page.tsx", "utf8");
  assert.match(migration, /approval_workflows_one_subject/);
  assert.match(migration, /leave_type_id/);
  assert.match(migration, /Active workflows are immutable|is_active/);
  assert.match(workflows, /from\("leave_types"\)/);
  assert.match(workflows, /leave\.manage/);
});
