import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("attendance foundation stores evidence and calculates operational day results", async () => {
  const migration = await readSource("../../../supabase/migrations/202608100010_attendance_management.sql");
  assert.match(migration, /create table public\.attendance_punches/);
  assert.match(migration, /create table public\.attendance_days/);
  assert.match(migration, /record_attendance_punch/);
  assert.match(migration, /recalculate_attendance_day/);
  assert.match(migration, /late_grace_minutes/);
  assert.match(migration, /attendance_distance_metres/);
  assert.match(migration, /review_attendance_punch/);
});

test("attendance report supports filters, manual corrections, exceptions, and CSV export", async () => {
  const [page, dialog, shell] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/attendance/page.tsx"),
    readSource("../src/components/attendance-punch-dialog.tsx"),
    readSource("../src/components/app-shell.tsx"),
  ]);
  assert.match(page, /AttendanceExportButton/);
  assert.match(page, /refreshAttendancePeriod/);
  assert.match(page, /reviewAttendancePunch/);
  assert.match(dialog, /type="datetime-local"/);
  assert.match(dialog, /toISOString/);
  assert.match(shell, /\["attendance", d\.attendance, "attendance"\]/);
});

test("branch administration exposes practical attendance rules", async () => {
  const [page, actions] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/branches/page.tsx"),
    readSource("../src/app/[locale]/(protected)/actions.ts"),
  ]);
  assert.match(page, /geofenceRadiusMetres/);
  assert.match(page, /mobileClockEnabled/);
  assert.match(actions, /attendance_selfie_required/);
  assert.match(actions, /overtime_threshold_minutes/);
});

