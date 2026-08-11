import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("tasks provide scoped assignment evidence review and recurrence", () => {
  const migration = readFileSync("../../supabase/migrations/202608110018_tasks_and_announcements.sql", "utf8");
  const list = readFileSync("src/app/[locale]/(protected)/tasks/page.tsx", "utf8");
  const detail = readFileSync("src/app/[locale]/(protected)/tasks/[taskId]/page.tsx", "utf8");
  const composer = readFileSync("src/components/task-composer.tsx", "utf8");
  assert.match(migration, /create table public\.task_assignments/);
  assert.match(migration, /submit_task_assignment/);
  assert.match(migration, /clone_next_task_occurrence/);
  assert.match(migration, /can_manage_task_employee/);
  assert.match(list, /TaskComposer/);
  assert.match(detail, /submitTaskEvidence/);
  assert.match(detail, /reviewTaskEvidence/);
  assert.match(composer, /scopeIds/);
});

test("announcements provide targeted delivery attachments and read acknowledgement", () => {
  const migration = readFileSync("../../supabase/migrations/202608110018_tasks_and_announcements.sql", "utf8");
  const page = readFileSync("src/app/[locale]/(protected)/announcements/page.tsx", "utf8");
  const composer = readFileSync("src/components/announcement-composer.tsx", "utf8");
  assert.match(migration, /create table public\.announcement_recipients/);
  assert.match(migration, /publish_announcement/);
  assert.match(migration, /mark_announcement_read/);
  assert.match(migration, /announcement-files/);
  assert.match(page, /AnnouncementComposer/);
  assert.match(page, /readRate/);
  assert.match(composer, /acknowledgement/);
});

test("collaboration modules are responsive localized and in primary navigation", () => {
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  const icons = readFileSync("src/components/brand-mark.tsx", "utf8");
  const styles = readFileSync("src/app/globals.css", "utf8");
  const i18n = readFileSync("src/lib/i18n.ts", "utf8");
  assert.match(shell, /\["tasks", d\.tasks, "tasks"\]/);
  assert.match(shell, /\["announcements", d\.announcements, "announcements"\]/);
  assert.match(icons, /announcements:/);
  assert.match(styles, /\.task-board/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.announcement-analytics/);
  assert.match(i18n, /tasks: "المهام والإنجاز"/);
});
