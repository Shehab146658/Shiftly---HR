import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/", import.meta.url);

test("employee setup communicates and preserves optional team assignment", async () => {
  const organizationFields = await readFile(new URL("components/employee-organization-fields.tsx", root), "utf8");
  assert.match(organizationFields, /name="teamId"/);
  assert.match(organizationFields, /<option value="">\{labels\.noTeam\}<\/option>/);
  assert.doesNotMatch(organizationFields, /name="teamId"[^>]*required/);
  assert.match(organizationFields, /team\.branch_id === branchId/);
});

test("schedule planner submits employee and day selections to the bulk assignment action", async () => {
  const planner = await readFile(new URL("components/schedule-assignment-planner.tsx", root), "utf8");
  const actions = await readFile(new URL("app/[locale]/(protected)/actions.ts", root), "utf8");
  assert.match(planner, /name="employeeIds"/);
  assert.match(planner, /name="workDates"/);
  assert.match(planner, /endTime <= startTime/);
  assert.match(actions, /bulk_assign_schedule_entries/);
  assert.match(actions, /values\.customEndTime! <= values\.customStartTime!/);
});

test("schedule creation accepts any date and normalizes it to the branch week", async () => {
  const actions = await readFile(new URL("app/[locale]/(protected)/actions.ts", root), "utf8");
  const page = await readFile(new URL("app/[locale]/(protected)/schedules/page.tsx", root), "utf8");
  assert.match(actions, /configuredWeekStart\(values\.weekStart, branch\.week_start_isodow\)/);
  assert.match(actions, /eq\("week_start", normalizedWeekStart\)/);
  assert.match(page, /d\.weekDateHelp/);
});
