import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("management reports combine operational and financial modules", async () => {
  const report = await readSource("../src/app/[locale]/(protected)/reports/page.tsx");

  for (const source of ["attendance_days", "leave_requests", "hr_requests", "payroll_employee_results", "employee_loans", "sales_entries", "sales_targets", "task_assignments", "announcement_recipients"]) {
    assert.match(report, new RegExp(`from\\(\"${source}\"\\)`), `${source} is included`);
  }
  assert.match(report, /reports\.read/);
  assert.match(report, /reports\.export/);
  assert.match(report, /branchScorecards/);
  assert.match(report, /report-risk/);
  assert.match(report, /AttendanceExportButton/);
  assert.doesNotMatch(report, /\"overdue\"\]\)/, "reports use only persisted installment enum values");
});

test("reports are discoverable and responsive", async () => {
  const [shell, dashboard, styles, icons] = await Promise.all([
    readSource("../src/components/app-shell.tsx"),
    readSource("../src/app/[locale]/(protected)/dashboard/page.tsx"),
    readSource("../src/app/globals.css"),
    readSource("../src/components/brand-mark.tsx"),
  ]);

  assert.match(shell, /\[\"reports\", d\.reports, \"reports\", \"reports\.read\"\]/);
  assert.match(shell, /reports\.read/);
  assert.match(shell, /permissionSet\.has/);
  assert.match(dashboard, /href: `\/\$\{locale\}\/reports`/);
  assert.match(icons, /reports:/);
  assert.match(styles, /\.report-kpi-grid/);
  assert.match(styles, /\.report-trend-chart/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.report-filter/);
});
