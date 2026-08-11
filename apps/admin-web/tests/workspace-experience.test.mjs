import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("creation workflows use an accessible on-demand dialog", async () => {
  const dialog = await readSource("../src/components/create-dialog.tsx");
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /event\.currentTarget === event\.target/);

  for (const page of ["branches", "teams", "shifts", "schedules", "roles", "payroll", "loans", "performance", "tasks", "announcements"]) {
    const source = await readSource(`../src/app/[locale]/(protected)/${page}/page.tsx`);
    assert.match(source, /<CreateDialog/);
  }

  const [performance, loan, payroll, workflows] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/performance/page.tsx"),
    readSource("../src/app/[locale]/(protected)/loans/[loanId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/payroll/[periodId]/page.tsx"),
    readSource("../src/app/[locale]/(protected)/requests/workflows/page.tsx"),
  ]);
  assert.match(performance, /title={copy\.newPolicy}[\s\S]*title={copy\.newTarget}/);
  assert.match(loan, /title={copy\.record}/);
  assert.match(payroll, /triggerLabel={`＋ \${copy\.adjustment}`}/);
  assert.match(workflows, /title={copy\.clone}[\s\S]*title={copy\.addStep}/);
});

test("the mobile sidebar scrolls its navigation while keeping account actions reachable", async () => {
  const styles = await readSource("../src/app/globals.css");
  assert.match(styles, /\.nav \{[^}]*flex: 1 1 auto;[^}]*overflow-y: auto;/);
  assert.match(styles, /\.sidebar-footer \{[^}]*flex: 0 0 auto;/);
  assert.match(styles, /\.shell \.sidebar \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
});

test("the home dashboard includes decision-useful cross-module charts", async () => {
  const [dashboard, chart] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/dashboard/page.tsx"),
    readSource("../src/components/insight-bars.tsx"),
  ]);
  for (const source of ["attendance_days", "leave_requests", "hr_requests", "tasks", "sales_entries"]) {
    assert.match(dashboard, new RegExp(`from\\("${source}"\\)`));
  }
  assert.match(dashboard, /People operations pulse/);
  assert.match(dashboard, /Action queue/);
  assert.match(chart, /insight-bar-track/);
});

test("protected pages recover gracefully from unexpected failures", async () => {
  const errorBoundary = await readSource("../src/app/[locale]/(protected)/error.tsx");
  assert.match(errorBoundary, /reset/);
  assert.match(errorBoundary, /Back to dashboard/);
  assert.match(errorBoundary, /Support reference/);
});
