import test from "node:test";
import assert from "node:assert/strict";
import { addIsoDays, configuredWeekStart, currentMonday, formatScheduleTime, weekdayKey, weekDates } from "../src/lib/scheduling.ts";

test("weekDates supports configurable non-Monday week starts", () => {
  assert.deepEqual(weekDates("2026-07-17"), [
    "2026-07-17", "2026-07-18", "2026-07-19", "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
  ]);
  assert.equal(weekdayKey("2026-07-17"), "friday");
  assert.equal(weekdayKey("2026-07-23"), "thursday");
});

test("date and time helpers remain timezone independent", () => {
  assert.equal(addIsoDays("2026-12-31", 1), "2027-01-01");
  assert.equal(currentMonday(new Date("2026-07-26T23:30:00Z")), "2026-07-20");
  assert.equal(formatScheduleTime("13:00:00"), "13:00");
});

test("any selected date normalizes to the branch-configured week start", () => {
  assert.equal(configuredWeekStart("2026-08-10", 5), "2026-08-07");
  assert.equal(configuredWeekStart("2026-08-07", 5), "2026-08-07");
  assert.equal(configuredWeekStart("2026-08-09", 7), "2026-08-09");
  assert.throws(() => configuredWeekStart("2026-08-10", 0), RangeError);
});
