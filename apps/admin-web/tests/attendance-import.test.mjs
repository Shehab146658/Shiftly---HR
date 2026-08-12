import test from "node:test";
import assert from "node:assert/strict";
import { parseAttendanceCsv, parseAttendanceTable } from "../src/lib/attendance-import.ts";

test("fingerprint CSV import detects common device columns and quoted values", () => {
  const result = parseAttendanceCsv(`PIN,Punch Time,State,Log ID,Branch\r\n001,"2026-08-11 09:04:00",0,LOG-1,MAIN\r\n001,"2026-08-11 18:01:00",2,LOG-2,MAIN`);
  assert.equal(result.sourceRowCount, 2);
  assert.deepEqual(result.rows, [
    { employee_number: "001", occurred_at: "2026-08-11 09:04:00", punch_type: "check_in", external_reference: "LOG-1", branch_code: "MAIN" },
    { employee_number: "001", occurred_at: "2026-08-11 18:01:00", punch_type: "check_out", external_reference: "LOG-2", branch_code: "MAIN" },
  ]);
  assert.equal(result.mapping.employee_number, "PIN");
});

test("fingerprint import supports semicolon files and configurable device states", () => {
  const result = parseAttendanceCsv(
    "Employee Code;Date Time;Direction\nEMP-1;2026-08-11T08:59:00+03:00;ENTRY_CODE\nEMP-1;2026-08-11T18:00:00+03:00;EXIT_CODE",
    { checkInValues: ["ENTRY_CODE"], checkOutValues: ["EXIT_CODE"] },
  );
  assert.equal(result.rows[0].punch_type, "check_in");
  assert.equal(result.rows[1].punch_type, "check_out");
});

test("Excel date cells remain timezone-neutral for device timezone interpretation", () => {
  const result = parseAttendanceTable([
    ["employee_number", "timestamp", "type"],
    ["EMP-1", new Date("2026-08-11T07:30:15.000Z"), "in"],
  ]);
  assert.equal(result.rows[0].occurred_at, "2026-08-11 07:30:15");
});

test("fingerprint import rejects files without the required business columns", () => {
  assert.throws(() => parseAttendanceCsv("name,when,value\nEmployee,Today,1"), /employee number column was not found/);
  assert.throws(() => parseAttendanceCsv("employee_number,timestamp\nEMP-1,2026-08-11"), /columns could not be detected/);
});
