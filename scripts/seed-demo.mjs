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
  const result = await client.from("branches").upsert({ tenant_id: tenant.id, ...branch, timezone: "Africa/Cairo" }, { onConflict: "tenant_id,code" });
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

console.log(`Seeded Shiftly HR demo tenant ${tenant.id}`);
console.log(`Owner login: ${email} / ${password}`);
