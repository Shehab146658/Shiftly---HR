import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("global search spans tenant-safe business records", async () => {
  const search = await readSource("../src/app/[locale]/(protected)/search/page.tsx");
  for (const source of ["employees", "branches", "teams", "hr_requests", "tasks", "announcements", "payroll_periods", "weekly_schedules"]) {
    assert.match(search, new RegExp(`from\\(\"${source}\"\\)`));
  }
  assert.match(search, /membership\.tenant_id/);
  assert.match(search, /safeTerm/);
  assert.match(search, /search-result-groups/);
});

test("topbar search is keyboard accessible and navigation is permission-aware", async () => {
  const [component, shell, layout, styles] = await Promise.all([
    readSource("../src/components/global-search.tsx"),
    readSource("../src/components/app-shell.tsx"),
    readSource("../src/app/[locale]/(protected)/layout.tsx"),
    readSource("../src/app/globals.css"),
  ]);
  assert.match(component, /event\.key !== "\/"/);
  assert.match(component, /aria-label={label}/);
  assert.match(component, /global-search-mobile-trigger/);
  assert.match(component, /global-search-wrap-open/);
  assert.match(component, /closeOnEscape/);
  assert.match(shell, /<GlobalSearch locale={locale}/);
  assert.match(layout, /role_permissions/);
  assert.match(shell, /permissionSet\.has/);
  assert.match(styles, /\.global-search/);
  assert.match(styles, /\.global-search-wrap-open \.global-search/);
  assert.match(styles, /\.global-search-mobile-trigger/);
  assert.match(styles, /\.search-result-groups/);
});
