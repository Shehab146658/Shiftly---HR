import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getActiveMembership, requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

// Authenticated tenant pages depend on cookies and must never be prerendered as public static output.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const { user, supabase } = await requireUser(rawLocale);
  const membership = await getActiveMembership(user.id);
  const tenant = Array.isArray(membership?.tenants) ? membership.tenants[0] : membership?.tenants;
  const [{ data: profile }, { data: notifications }, roleLinksResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    tenant?.id
      ? supabase.from("notifications").select("id, title_en, title_ar, body_en, body_ar, href, read_at, created_at").eq("tenant_id", tenant.id).eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
    membership?.id
      ? supabase.from("membership_roles").select("role_id").eq("membership_id", membership.id)
      : Promise.resolve({ data: [] as Array<{ role_id: string }>, error: null }),
  ]);
  if (roleLinksResult.error) throw roleLinksResult.error;
  const roleIds = (roleLinksResult.data ?? []).map((row) => row.role_id);
  const permissionResult = roleIds.length
    ? await supabase.from("role_permissions").select("permission_key").in("role_id", roleIds)
    : { data: [] as Array<{ permission_key: string }>, error: null };
  if (permissionResult.error) throw permissionResult.error;
  const permissions = [...new Set((permissionResult.data ?? []).map((row) => row.permission_key))];

  return (
    <AppShell locale={rawLocale} userEmail={user.email ?? ""} userId={user.id} userName={profile?.full_name} isOwner={membership?.is_owner} companyName={tenant?.name_en} tenantId={tenant?.id} notifications={notifications ?? []} permissions={permissions}>
      {children}
    </AppShell>
  );
}
