export type AttendanceImportCell = string | number | boolean | Date | null | undefined;

export type AttendanceImportRow = {
  employee_number: string;
  occurred_at: string;
  punch_type: string;
  external_reference?: string;
  branch_code?: string;
};

export type AttendanceColumnOverrides = {
  employee?: string;
  occurredAt?: string;
  punchType?: string;
  externalReference?: string;
  branchCode?: string;
  checkInValues?: string[];
  checkOutValues?: string[];
};

export type AttendanceImportResult = {
  rows: AttendanceImportRow[];
  mapping: Record<string, string>;
  sourceRowCount: number;
};

const HEADER_ALIASES = {
  employee: ["employee_number", "employee", "employee_code", "emp_id", "employee_id", "user_id", "pin", "enroll_number", "enrol_number", "person_id"],
  occurredAt: ["occurred_at", "timestamp", "datetime", "date_time", "punch_time", "attendance_time", "event_time", "time"],
  punchType: ["punch_type", "type", "state", "status", "event", "direction", "in_out"],
  externalReference: ["external_reference", "transaction_id", "log_id", "record_id", "event_id", "id"],
  branchCode: ["branch_code", "branch", "location", "location_code", "department"],
} as const;

const DEFAULT_CHECK_IN_VALUES = ["check_in", "check in", "clock_in", "clock in", "in", "0", "1", "entry"];
const DEFAULT_CHECK_OUT_VALUES = ["check_out", "check out", "clock_out", "clock out", "out", "2", "exit"];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s./\\-]+/g, "_").replace(/_+/g, "_");
}

function cellText(value: AttendanceImportCell) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    const seconds = String(value.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  return value == null ? "" : String(value).trim();
}

function findColumn(headers: string[], explicit: string | undefined, aliases: readonly string[], required: boolean, label: string) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const requested = explicit ? normalizeHeader(explicit) : "";
  const index = requested
    ? normalizedHeaders.indexOf(requested)
    : aliases.map(normalizeHeader).map((alias) => normalizedHeaders.indexOf(alias)).find((candidate) => candidate >= 0) ?? -1;
  if (required && index < 0) {
    throw new Error(`The ${label} column was not found. Available columns: ${headers.join(", ")}.`);
  }
  return index;
}

function normalizePunchType(value: string, checkInValues: string[], checkOutValues: string[]) {
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  const inSet = new Set(checkInValues.map((item) => item.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")));
  const outSet = new Set(checkOutValues.map((item) => item.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")));
  if (inSet.has(normalized)) return "check_in";
  if (outSet.has(normalized)) return "check_out";
  return value.trim();
}

export function parseAttendanceTable(table: AttendanceImportCell[][], overrides: AttendanceColumnOverrides = {}): AttendanceImportResult {
  const nonEmptyRows = table.filter((row) => row.some((cell) => cellText(cell) !== ""));
  if (nonEmptyRows.length < 2) throw new Error("The attendance file must contain a header and at least one data row.");
  if (nonEmptyRows.length > 10_001) throw new Error("One import is limited to 10,000 attendance rows.");

  const headers = nonEmptyRows[0].map(cellText);
  if (new Set(headers.map(normalizeHeader).filter(Boolean)).size !== headers.filter(Boolean).length) {
    throw new Error("Attendance file column names must be unique.");
  }

  const employeeIndex = findColumn(headers, overrides.employee, HEADER_ALIASES.employee, true, "employee number");
  const occurredAtIndex = findColumn(headers, overrides.occurredAt, HEADER_ALIASES.occurredAt, true, "date/time");
  const punchTypeIndex = findColumn(headers, overrides.punchType, HEADER_ALIASES.punchType, true, "punch type");
  const externalReferenceIndex = findColumn(headers, overrides.externalReference, HEADER_ALIASES.externalReference, false, "external reference");
  const branchCodeIndex = findColumn(headers, overrides.branchCode, HEADER_ALIASES.branchCode, false, "branch code");
  const checkInValues = overrides.checkInValues?.length ? overrides.checkInValues : DEFAULT_CHECK_IN_VALUES;
  const checkOutValues = overrides.checkOutValues?.length ? overrides.checkOutValues : DEFAULT_CHECK_OUT_VALUES;

  const rows = nonEmptyRows.slice(1).map((row) => {
    const employeeNumber = cellText(row[employeeIndex]);
    const occurredAt = cellText(row[occurredAtIndex]);
    const rawPunchType = cellText(row[punchTypeIndex]);
    return {
      employee_number: employeeNumber,
      occurred_at: occurredAt,
      punch_type: normalizePunchType(rawPunchType, checkInValues, checkOutValues),
      ...(externalReferenceIndex >= 0 && cellText(row[externalReferenceIndex]) ? { external_reference: cellText(row[externalReferenceIndex]) } : {}),
      ...(branchCodeIndex >= 0 && cellText(row[branchCodeIndex]) ? { branch_code: cellText(row[branchCodeIndex]) } : {}),
    };
  });

  return {
    rows,
    sourceRowCount: rows.length,
    mapping: {
      employee_number: headers[employeeIndex],
      occurred_at: headers[occurredAtIndex],
      punch_type: headers[punchTypeIndex],
      ...(externalReferenceIndex >= 0 ? { external_reference: headers[externalReferenceIndex] } : {}),
      ...(branchCodeIndex >= 0 ? { branch_code: headers[branchCodeIndex] } : {}),
      check_in_values: checkInValues.join(","),
      check_out_values: checkOutValues.join(","),
    },
  };
}

function parseDelimited(input: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV file contains an unterminated quoted value.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseAttendanceCsv(input: string, overrides: AttendanceColumnOverrides = {}) {
  const content = input.replace(/^\uFEFF/, "");
  if (!content.trim()) throw new Error("The attendance file is empty.");
  const candidates = [",", ";", "\t", "|"]
    .map((delimiter) => ({ delimiter, table: parseDelimited(content, delimiter) }))
    .sort((left, right) => (right.table[0]?.length ?? 0) - (left.table[0]?.length ?? 0));
  const selected = candidates[0];
  if (!selected || (selected.table[0]?.length ?? 0) < 3) {
    throw new Error("The CSV delimiter or columns could not be detected.");
  }
  return parseAttendanceTable(selected.table, overrides);
}
