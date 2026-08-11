import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("payroll ships auditable calculations, approvals, and published payslips", () => {
  const migration = readFileSync("../../supabase/migrations/202608110014_payroll_operations.sql", "utf8");
  const page = readFileSync("src/app/[locale]/(protected)/payroll/page.tsx", "utf8");
  const period = readFileSync("src/app/[locale]/(protected)/payroll/[periodId]/page.tsx", "utf8");
  const payslip = readFileSync("src/app/[locale]/(protected)/payslips/[resultId]/page.tsx", "utf8");
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  assert.match(migration, /create table public\.employee_compensation/);
  assert.match(migration, /create table public\.payroll_employee_results/);
  assert.match(migration, /calculate_payroll_period/);
  assert.match(migration, /transition_payroll_period/);
  assert.match(migration, /settings_snapshot/);
  assert.match(page, /saveEmployeeCompensation/);
  assert.match(period, /addPayrollAdjustment/);
  assert.match(period, /payroll-lifecycle/);
  assert.match(payslip, /acknowledgePayslip/);
  assert.match(shell, /\["payroll", d\.payroll, "payroll"\]/);
});

test("payroll calculations include attendance and approved unpaid leave inputs", () => {
  const migration = readFileSync("../../supabase/migrations/202608110014_payroll_operations.sql", "utf8");
  assert.match(migration, /from public\.attendance_days/);
  assert.match(migration, /from public\.leave_request_days/);
  assert.match(migration, /overtime_multiplier/);
  assert.match(migration, /late_deduction_multiplier/);
  assert.match(migration, /absence_deduction_multiplier/);
  assert.match(migration, /source_type <> 'adjustment'/);
});
