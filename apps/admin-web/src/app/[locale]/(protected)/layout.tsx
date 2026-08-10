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
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <AppShell locale={rawLocale} userEmail={user.email ?? ""} userId={user.id} userName={profile?.full_name} isOwner={membership?.is_owner} companyName={tenant?.name_en}>
      {children}
    </AppShell>
  );
}
