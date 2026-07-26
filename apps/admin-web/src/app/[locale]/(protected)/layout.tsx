import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getActiveMembership, requireUser } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";

export default async function ProtectedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const { user } = await requireUser(rawLocale);
  const membership = await getActiveMembership(user.id);
  const tenant = Array.isArray(membership?.tenants) ? membership.tenants[0] : membership?.tenants;

  return (
    <AppShell locale={rawLocale} userEmail={user.email ?? ""} companyName={tenant?.name_en}>
      {children}
    </AppShell>
  );
}
