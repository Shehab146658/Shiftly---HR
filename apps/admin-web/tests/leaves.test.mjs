import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjacentMonth, calendarMonthDays, dateFallsWithin, monthRange, validCalendarMonth } from "../src/lib/leaves.ts";

test("leave calendar is timezone-independent and Saturday-first", () => {
  assert.deepEqual(monthRange(2026, 3), { start: "2026-03-01", end: "2026-03-31" });
  const days = calendarMonthDays(2026, 3);
  assert.equal(days.length, 42);
  assert.equal(days[0].date, "2026-02-28");
  assert.equal(days[1].date, "2026-03-01");
  assert.deepEqual(adjacentMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(adjacentMonth(2026, 12, 1), { year: 2027, month: 1 });
});

test("calendar filters and date ranges are validated", () => {
  assert.deepEqual(validCalendarMonth("2026", "7"), { year: 2026, month: 7 });
  assert.deepEqual(validCalendarMonth("bad", "14", new Date("2026-07-01T00:00:00Z")), { year: 2026, month: 7 });
  assert.equal(dateFallsWithin("2026-07-23", "2026-07-20", "2026-07-25"), true);
  assert.equal(dateFallsWithin("2026-07-26", "2026-07-20", "2026-07-25"), false);
});

test("leave operations expose versioned approvals, official holidays, navigation, and a global loader", () => {
  const migration = readFileSync("../../supabase/migrations/202607310008_egypt_leave_management.sql", "utf8");
  const workflowMigration = readFileSync("../../supabase/migrations/202608110013_leave_workflow_operations.sql", "utf8");
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  const page = readFileSync("src/app/[locale]/(protected)/leaves/page.tsx", "utf8");
  const settings = readFileSync("src/app/[locale]/(protected)/leaves/settings/page.tsx", "utf8");
  const loader = readFileSync("src/app/[locale]/loading.tsx", "utf8");
  assert.match(migration, /leave_approval_stage as enum \('manager_review', 'owner_review', 'completed'\)/);
  assert.match(migration, /seed_egypt_2026_public_holidays/);
  assert.match(migration, /date '2026-01-07'/);
  assert.match(migration, /date '2026-10-06'/);
  assert.match(shell, /\["leaves", d\.leaves, "leaves"\]/);
  assert.match(workflowMigration, /seed_leave_approval_workflows/);
  assert.match(workflowMigration, /can_approve_leave_request/);
  assert.match(page, /can_approve_leave_request/);
  assert.match(page, /createSignedUrl/);
  assert.match(page, /cancelLeaveRequest/);
  assert.match(settings, /adjustLeaveBalance/);
  assert.match(settings, /createPublicHoliday/);
  assert.match(settings, /updateLeaveType/);
  assert.match(loader, /global-loader-ring/);
});
