import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/", import.meta.url);

test("employee setup communicates and preserves optional team assignment", async () => {
  const organizationFields = await readFile(
    new URL("components/employee-organization-fields.tsx", root),
    "utf8",
  );
  assert.match(organizationFields, /name="teamId"/);
  assert.match(
    organizationFields,
    /<option value="">\{labels\.noTeam\}<\/option>/,
  );
  assert.doesNotMatch(organizationFields, /name="teamId"[^>]*required/);
  assert.match(organizationFields, /team\.branch_id === branchId/);
});

test("schedule cells open predefined, custom, split, overnight, and OFF assignment choices", async () => {
  const planner = await readFile(
    new URL("components/schedule-cell-editor.tsx", root),
    "utf8",
  );
  const page = await readFile(
    new URL("app/[locale]/(protected)/schedules/[scheduleId]/page.tsx", root),
    "utf8",
  );
  const actions = await readFile(
    new URL("app/[locale]/(protected)/actions.ts", root),
    "utf8",
  );
  assert.match(page, /ScheduleCellEditor/);
  assert.match(planner, /name="shiftTemplateId"/);
  assert.match(planner, /name="assignmentMode"/);
  assert.match(planner, /value="append"/);
  assert.match(planner, /labels\.off/);
  assert.match(planner, /endTime <= startTime/);
  assert.match(actions, /export async function addScheduleEntry/);
  assert.match(actions, /values\.assignmentMode === "append"/);
  assert.match(actions, /\.from\("schedule_entries"\)[\s\S]*\.delete\(\)/);
});

test("schedule creation accepts any date and normalizes it to the branch week", async () => {
  const actions = await readFile(
    new URL("app/[locale]/(protected)/actions.ts", root),
    "utf8",
  );
  const page = await readFile(
    new URL("app/[locale]/(protected)/schedules/page.tsx", root),
    "utf8",
  );
  assert.match(
    actions,
    /configuredWeekStart\([\s\S]*values\.weekStart,[\s\S]*branch\.week_start_isodow/,
  );
  assert.match(actions, /eq\("week_start", normalizedWeekStart\)/);
  assert.match(page, /d\.weekDateHelp/);
});
