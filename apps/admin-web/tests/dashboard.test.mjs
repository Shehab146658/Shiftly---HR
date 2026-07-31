import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("dashboard cards and chart rows navigate to dedicated areas", async () => {
  const dashboard = await readSource("../src/app/[locale]/(protected)/dashboard/page.tsx");

  assert.doesNotMatch(dashboard, /secureTenant|configurableRoles|bilingualDesc|auditedDesc/);
  assert.match(dashboard, /dashboard-stat dashboard-link/);
  assert.match(dashboard, /employees\?branch=/);
  assert.match(dashboard, /employees\?status=/);
  assert.match(dashboard, /quick-link-grid/);
});

test("dashboard includes workforce and schedule visualizations", async () => {
  const [dashboard, styles] = await Promise.all([
    readSource("../src/app/[locale]/(protected)/dashboard/page.tsx"),
    readSource("../src/app/globals.css"),
  ]);

  assert.match(dashboard, /conic-gradient/);
  assert.match(dashboard, /branch-bar-fill/);
  assert.match(dashboard, /scheduleStatuses/);
  assert.match(styles, /\.donut-chart/);
  assert.match(styles, /\.branch-bar-track/);
});
