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
  assert.match(shell, /\["attendance", d\.attendance, "attendance", "attendance\.read"\]/);
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

test("employee self-service clock captures private selfie and geofence evidence", async () => {
  const [page, clock, shell, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/clock/page.tsx"),
    readSource("../src/components/employee-clock.tsx"),
    readSource("../src/components/app-shell.tsx"),
    readSource("../../../supabase/migrations/202608110020_employee_self_service_attendance.sql"),
  ]);
  assert.match(page, /operational_day_start/);
  assert.match(page, /attendance\.clock/);
  assert.match(clock, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(clock, /attendance-selfies/);
  assert.match(clock, /record_attendance_punch/);
  assert.match(clock, /capture="user"/);
  assert.match(shell, /\["clock", d\.clock, "attendance", "attendance\.clock"\]/);
  assert.match(migration, /attendance_selfies_insert/);
  assert.match(migration, /attendance_selfies_delete_orphan/);
});

test("fingerprint operations provide device setup, guarded imports, and row reconciliation", async () => {
  const [page, actions, migration] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/attendance/devices/page.tsx"),
    readSource("../src/app/[locale]/(protected)/actions.ts"),
    readSource("../../../supabase/migrations/202608110021_fingerprint_device_sync.sql"),
  ]);
  assert.match(page, /createAttendanceDevice/);
  assert.match(page, /importFingerprintAttendance/);
  assert.match(page, /attendance_import_rows/);
  assert.match(page, /accept="\.csv,\.txt,\.xlsx/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(actions, /read-excel-file\/node/);
  assert.match(migration, /create table public\.attendance_devices/);
  assert.match(migration, /create table public\.attendance_import_batches/);
  assert.match(migration, /create or replace function public\.import_fingerprint_punches/);
  assert.match(migration, /attendance_device_id/);
});
