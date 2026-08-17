import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  console.error("Set SUPABASE_SECRET_KEY to the local secret/service-role key printed by `supabase start`.");
  process.exit(1);
}

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const demoAccounts = [
  { role: "owner", email: process.env.SHIFTLY_DEMO_OWNER_EMAIL ?? "owner@shiftly.local", password: process.env.SHIFTLY_DEMO_OWNER_PASSWORD ?? "Shiftly!2026-Owner", fullName: "Shiftly Owner" },
  { role: "hr_admin", email: process.env.SHIFTLY_DEMO_HR_EMAIL ?? "hr@shiftly.local", password: process.env.SHIFTLY_DEMO_HR_PASSWORD ?? "Shiftly!2026-HR", fullName: "Nour HR" },
  { role: "payroll_officer", email: process.env.SHIFTLY_DEMO_PAYROLL_EMAIL ?? "payroll@shiftly.local", password: process.env.SHIFTLY_DEMO_PAYROLL_PASSWORD ?? "Shiftly!2026-Payroll", fullName: "Mariam Payroll" },
  { role: "accountant", email: process.env.SHIFTLY_DEMO_ACCOUNTANT_EMAIL ?? "accountant@shiftly.local", password: process.env.SHIFTLY_DEMO_ACCOUNTANT_PASSWORD ?? "Shiftly!2026-Accountant", fullName: "Omar Accountant" },
  { role: "branch_manager", email: process.env.SHIFTLY_DEMO_BRANCH_MANAGER_EMAIL ?? "branch.manager@shiftly.local", password: process.env.SHIFTLY_DEMO_BRANCH_MANAGER_PASSWORD ?? "Shiftly!2026-Branch", fullName: "Karim Branch Manager" },
  { role: "team_manager", email: process.env.SHIFTLY_DEMO_TEAM_MANAGER_EMAIL ?? "team.manager@shiftly.local", password: process.env.SHIFTLY_DEMO_TEAM_MANAGER_PASSWORD ?? "Shiftly!2026-Team", fullName: "Dina Team Manager" },
  { role: "employee", email: process.env.SHIFTLY_DEMO_EMPLOYEE_EMAIL ?? "employee@shiftly.local", password: process.env.SHIFTLY_DEMO_EMPLOYEE_PASSWORD ?? "Shiftly!2026-Employee", fullName: "Youssef Employee" },
];

const listedUsers = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listedUsers.error) throw listedUsers.error;
const authUsersByEmail = new Map(listedUsers.data.users.map((user) => [user.email?.toLowerCase(), user]));
const accountUserIds = {};

for (const account of demoAccounts) {
  let authUser = authUsersByEmail.get(account.email.toLowerCase());
  if (!authUser) {
    const created = await client.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: account.fullName, locale: "en", shiftly_demo_role: account.role } });
    if (created.error) throw created.error;
    authUser = created.data.user;
  } else {
    const updated = await client.auth.admin.updateUserById(authUser.id, { password: account.password, email_confirm: true, user_metadata: { ...authUser.user_metadata, full_name: account.fullName, locale: "en", shiftly_demo_role: account.role } });
    if (updated.error) throw updated.error;
    authUser = updated.data.user;
  }
  if (!authUser) throw new Error(`Could not resolve demo ${account.role} user.`);
  authUsersByEmail.set(account.email.toLowerCase(), authUser);
  accountUserIds[account.role] = authUser.id;
}

const userId = accountUserIds.owner;

let { data: tenant } = await client.from("tenants").select("id").eq("slug", "shiftly-demo").maybeSingle();
if (!tenant) {
  const inserted = await client.from("tenants").insert({ slug: "shiftly-demo", name_en: "Shiftly Demo Company", name_ar: "شركة شيفتلي التجريبية", status: "active", timezone: "Africa/Cairo", created_by: userId }).select("id").single();
  if (inserted.error) throw inserted.error;
  tenant = inserted.data;
}

const { data: roleRows, error: roleError } = await client.from("roles").select("id, name").eq("tenant_id", tenant.id);
if (roleError) throw roleError;
const roleByName = Object.fromEntries(roleRows.map((role) => [role.name, role.id]));

for (const account of demoAccounts) {
  const membershipResult = await client.from("memberships").upsert({
    tenant_id: tenant.id,
    user_id: accountUserIds[account.role],
    status: "active",
    is_owner: account.role === "owner",
    invited_by: userId,
    joined_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id" }).select("id").single();
  if (membershipResult.error) throw membershipResult.error;
  const clearedRoles = await client.from("membership_roles").delete().eq("membership_id", membershipResult.data.id);
  if (clearedRoles.error) throw clearedRoles.error;
  const assignedRole = await client.from("membership_roles").insert({ membership_id: membershipResult.data.id, role_id: roleByName[account.role], assigned_by: userId });
  if (assignedRole.error) throw assignedRole.error;
}

const branches = [
  { code: "GATEWAY", name_en: "Gate Way", name_ar: "جيت واي" },
  { code: "THEONE", name_en: "The One", name_ar: "ذا وان" },
  { code: "BERRYROSE", name_en: "Berry Rose", name_ar: "بيري روز" },
  { code: "ONOVI", name_en: "Onovi", name_ar: "أونوفي" },
];
for (const branch of branches) {
  const result = await client.from("branches").upsert({ tenant_id: tenant.id, ...branch, timezone: "Africa/Cairo", operational_day_start: "06:00", maximum_shift_hours: 16, week_start_isodow: 5, default_schedule_visibility: "branch" }, { onConflict: "tenant_id,code" });
  if (result.error) throw result.error;
}
const { data: branchRows, error: branchError } = await client.from("branches").select("id, code").eq("tenant_id", tenant.id);
if (branchError) throw branchError;
const byCode = Object.fromEntries(branchRows.map((b) => [b.code, b.id]));

const teamResult = await client.from("teams").upsert({ tenant_id: tenant.id, branch_id: byCode.GATEWAY, code: "TEAM001", name_en: "Team 001", name_ar: "فريق 001", is_active: true }, { onConflict: "tenant_id,code" }).select("id").single();
if (teamResult.error) throw teamResult.error;
const team001Id = teamResult.data.id;

const deviceResult = await client.from("attendance_devices").upsert({
  tenant_id: tenant.id,
  branch_id: byCode.GATEWAY,
  code: "FP-DEMO-01",
  name: "Gate Way entrance terminal",
  provider: "generic",
  model: "CSV/XLSX preview adapter",
  serial_number: "DEMO-NOT-A-PHYSICAL-DEVICE",
  connection_mode: "file",
  timezone: "Africa/Cairo",
  status: "active",
  created_by: userId,
}, { onConflict: "tenant_id,code" });
if (deviceResult.error) throw deviceResult.error;

const employees = [
  ["GW-001", "Heba", "هبة", "GATEWAY"],
  ["ONE-001", "Fatma", "فاطمة", "THEONE"],
  ["ONE-002", "Esraa", "إسراء", "THEONE"],
  ["ONE-003", "Shahd", "شهد", "THEONE"],
  ["BR-001", "Kholoud", "خلود", "BERRYROSE"],
  ["BR-002", "Huda", "هدى", "BERRYROSE"],
  ["BR-003", "Abdo", "عبده", "BERRYROSE"],
  ["ON-001", "Nehal", "نهال", "ONOVI"],
  ["ON-002", "Malak", "ملك", "ONOVI"],
  ["ON-003", "Basmala", "بسملة", "ONOVI"],
  ["UN-001", "Basmala Mahmoud", "بسملة محمود", null],
  ["UN-002", "Salma", "سلمى", null],
];
for (const [employee_code, name_en, name_ar, branchCode] of employees) {
  const result = await client.from("employees").upsert({ tenant_id: tenant.id, employee_code, name_en, name_ar, branch_id: branchCode ? byCode[branchCode] : null, position: "Sales", status: "active" }, { onConflict: "tenant_id,employee_code" });
  if (result.error) throw result.error;
}

const roleEmployees = [
  { role: "hr_admin", employee_code: "DEMO-HR", name_en: "Nour HR", name_ar: "نور - الموارد البشرية", position: "HR Administrator", branch_id: byCode.GATEWAY, team_id: null },
  { role: "payroll_officer", employee_code: "DEMO-PAY", name_en: "Mariam Payroll", name_ar: "مريم - الرواتب", position: "Payroll Officer", branch_id: byCode.GATEWAY, team_id: null },
  { role: "accountant", employee_code: "DEMO-ACC", name_en: "Omar Accountant", name_ar: "عمر - المحاسبة", position: "Accountant", branch_id: byCode.GATEWAY, team_id: null },
  { role: "branch_manager", employee_code: "DEMO-BM", name_en: "Karim Branch Manager", name_ar: "كريم - مدير الفرع", position: "Branch Manager", branch_id: byCode.GATEWAY, team_id: null },
  { role: "team_manager", employee_code: "DEMO-TM", name_en: "Dina Team Manager", name_ar: "دينا - مديرة الفريق", position: "Team Manager", branch_id: byCode.GATEWAY, team_id: team001Id },
  { role: "employee", employee_code: "DEMO-EMP", name_en: "Youssef Employee", name_ar: "يوسف - موظف", position: "Sales Associate", branch_id: byCode.GATEWAY, team_id: team001Id },
];

for (const employee of roleEmployees) {
  const result = await client.from("employees").upsert({
    tenant_id: tenant.id,
    user_id: accountUserIds[employee.role],
    employee_code: employee.employee_code,
    name_en: employee.name_en,
    name_ar: employee.name_ar,
    email: demoAccounts.find((account) => account.role === employee.role).email,
    position: employee.position,
    branch_id: employee.branch_id,
    team_id: employee.team_id,
    status: "active",
  }, { onConflict: "tenant_id,employee_code" }).select("id").single();
  if (result.error) throw result.error;
  const clearedEmployeeRoles = await client.from("employee_role_assignments").delete().eq("employee_id", result.data.id);
  if (clearedEmployeeRoles.error) throw clearedEmployeeRoles.error;
  const assignedEmployeeRole = await client.from("employee_role_assignments").insert({ tenant_id: tenant.id, employee_id: result.data.id, role_id: roleByName[employee.role], assigned_by: userId });
  if (assignedEmployeeRole.error) throw assignedEmployeeRole.error;
}


const { data: employeeRows, error: employeeRowsError } = await client
  .from("employees")
  .select("id, employee_code")
  .eq("tenant_id", tenant.id);
if (employeeRowsError) throw employeeRowsError;
const employeeByCode = Object.fromEntries(employeeRows.map((employee) => [employee.employee_code, employee.id]));

const shiftTemplates = [
  { code: "1_11", name_en: "1 PM - 11 PM", name_ar: "١ م - ١١ م", start_time: "13:00", end_time: "23:00", end_day_offset: 0 },
  { code: "12_10", name_en: "12 PM - 10 PM", name_ar: "١٢ م - ١٠ م", start_time: "12:00", end_time: "22:00", end_day_offset: 0 },
  { code: "2_12", name_en: "2 PM - 12 AM", name_ar: "٢ م - ١٢ ص", start_time: "14:00", end_time: "00:00", end_day_offset: 1 },
  { code: "11_9", name_en: "11 AM - 9 PM", name_ar: "١١ ص - ٩ م", start_time: "11:00", end_time: "21:00", end_day_offset: 0 },
  { code: "11_8", name_en: "11 AM - 8 PM", name_ar: "١١ ص - ٨ م", start_time: "11:00", end_time: "20:00", end_day_offset: 0 },
  { code: "12_9", name_en: "12 PM - 9 PM", name_ar: "١٢ م - ٩ م", start_time: "12:00", end_time: "21:00", end_day_offset: 0 },
  { code: "12_12", name_en: "12 PM - 12 AM", name_ar: "١٢ م - ١٢ ص", start_time: "12:00", end_time: "00:00", end_day_offset: 1 },
  { code: "11_11", name_en: "11 AM - 11 PM", name_ar: "١١ ص - ١١ م", start_time: "11:00", end_time: "23:00", end_day_offset: 0 },
];
for (const shift of shiftTemplates) {
  const result = await client.from("shift_templates").upsert({
    tenant_id: tenant.id,
    ...shift,
    break_minutes: 0,
    color_hex: "#2357D9",
    is_active: true,
  }, { onConflict: "tenant_id,code" });
  if (result.error) throw result.error;
}
const { data: shiftRows, error: shiftRowsError } = await client
  .from("shift_templates")
  .select("id, code")
  .eq("tenant_id", tenant.id);
if (shiftRowsError) throw shiftRowsError;
const shiftByCode = Object.fromEntries(shiftRows.map((shift) => [shift.code, shift.id]));

const weekStart = "2026-07-17";
const scheduleMatrix = {
  GATEWAY: {
    "GW-001": ["1_11", "12_10", "12_10", "12_10", "OFF", "12_10", "1_11"],
  },
  THEONE: {
    "ONE-001": ["2_12", "OFF", "1_11", "1_11", "1_11", "1_11", "2_12"],
    "ONE-002": ["12_10", "11_9", "11_9", "1_11", "OFF", "1_11", "12_10"],
    "ONE-003": ["2_12", "1_11", "OFF", "11_9", "11_9", "11_9", "2_12"],
  },
  BERRYROSE: {
    "BR-001": ["2_12", "1_11", "1_11", "OFF", "1_11", "1_11", "2_12"],
    "BR-002": ["2_12", "11_9", "OFF", "11_9", "11_9", "11_9", "1_11"],
    "BR-003": ["12_12", "11_11", "11_11", "11_11", "OFF", "OFF", "12_12"],
  },
  ONOVI: {
    "ON-001": ["12_9", "11_8", "1_11", "1_11", "1_11", "1_11", "OFF"],
    "ON-002": ["2_12", "1_11", "1_11", "1_11", "11_9", "11_9", "2_12"],
    "ON-003": ["OFF", "1_11", "11_9", "11_9", "1_11", "1_11", "2_12"],
  },
};

function isoDatePlusDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

for (const [branchCode, branchSchedule] of Object.entries(scheduleMatrix)) {
  const branchId = byCode[branchCode];
  const scheduleResult = await client.from("weekly_schedules").upsert({
    tenant_id: tenant.id,
    branch_id: branchId,
    week_start: weekStart,
    status: "draft",
    visibility: "branch",
    notes: "Imported from the supplied real weekly schedule image (17-23 July 2026).",
    created_by: userId,
    published_at: null,
    published_by: null,
    locked_at: null,
    locked_by: null,
  }, { onConflict: "tenant_id,branch_id,week_start" }).select("id").single();
  if (scheduleResult.error) throw scheduleResult.error;
  const scheduleId = scheduleResult.data.id;

  const deleteEntries = await client.from("schedule_entries").delete().eq("schedule_id", scheduleId);
  if (deleteEntries.error) throw deleteEntries.error;

  const entries = [];
  for (const [employeeCode, days] of Object.entries(branchSchedule)) {
    days.forEach((shiftCode, dayIndex) => {
      entries.push({
        tenant_id: tenant.id,
        schedule_id: scheduleId,
        employee_id: employeeByCode[employeeCode],
        scheduled_branch_id: branchId,
        work_date: isoDatePlusDays(weekStart, dayIndex),
        segment_no: 1,
        entry_type: shiftCode === "OFF" ? "off" : "shift",
        shift_template_id: shiftCode === "OFF" ? null : shiftByCode[shiftCode],
        custom_start_time: null,
        custom_end_time: null,
        end_day_offset: 0,
        break_minutes: 0,
        position_label: "Sales",
        notes: "Imported schedule",
        created_by: userId,
      });
    });
  }
  const insertEntries = await client.from("schedule_entries").insert(entries);
  if (insertEntries.error) throw insertEntries.error;

  const publishResult = await client.from("weekly_schedules").update({
    status: "published",
    published_at: new Date().toISOString(),
    published_by: userId,
  }).eq("id", scheduleId);
  if (publishResult.error) throw publishResult.error;

  await client.from("schedule_status_events").delete().eq("schedule_id", scheduleId);
  const eventResult = await client.from("schedule_status_events").insert({
    tenant_id: tenant.id,
    schedule_id: scheduleId,
    from_status: "draft",
    to_status: "published",
    reason: "Initial real schedule import",
    actor_user_id: userId,
  });
  if (eventResult.error) throw eventResult.error;
}

console.log(`Seeded Shiftly HR demo tenant ${tenant.id}`);
console.table(demoAccounts.map(({ role, email, password }) => ({ role, email, password })));
