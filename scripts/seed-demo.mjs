import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  console.error("Set SUPABASE_SECRET_KEY to the local secret/service-role key printed by `supabase start`.");
  process.exit(1);
}

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const email = process.env.SHIFTLY_DEMO_OWNER_EMAIL ?? "owner@shiftly.local";
const password = process.env.SHIFTLY_DEMO_OWNER_PASSWORD ?? "Shiftly!2026-Owner";

let userId;
const created = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Shiftly Owner", locale: "en" } });
if (created.error && !created.error.message.toLowerCase().includes("already")) throw created.error;
if (created.data.user) userId = created.data.user.id;
if (!userId) {
  const users = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  userId = users.data.users.find((u) => u.email === email)?.id;
}
if (!userId) throw new Error("Could not resolve demo owner user.");

let { data: tenant } = await client.from("tenants").select("id").eq("slug", "shiftly-demo").maybeSingle();
if (!tenant) {
  const inserted = await client.from("tenants").insert({ slug: "shiftly-demo", name_en: "Shiftly Demo Company", name_ar: "شركة شيفتلي التجريبية", status: "active", timezone: "Africa/Cairo", created_by: userId }).select("id").single();
  if (inserted.error) throw inserted.error;
  tenant = inserted.data;
}

let { data: membership } = await client.from("memberships").select("id").eq("tenant_id", tenant.id).eq("user_id", userId).maybeSingle();
if (!membership) {
  const inserted = await client.from("memberships").insert({ tenant_id: tenant.id, user_id: userId, status: "active", is_owner: true, invited_by: userId, joined_at: new Date().toISOString() }).select("id").single();
  if (inserted.error) throw inserted.error;
  membership = inserted.data;
}
const { data: ownerRole, error: roleError } = await client.from("roles").select("id").eq("tenant_id", tenant.id).eq("name", "owner").single();
if (roleError) throw roleError;
await client.from("membership_roles").upsert({ membership_id: membership.id, role_id: ownerRole.id, assigned_by: userId });

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
console.log(`Owner login: ${email} / ${password}`);
