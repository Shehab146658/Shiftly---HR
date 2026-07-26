import { CompanyOnboarding } from "@/components/company-onboarding";
import { getActiveMembership, requireUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const d = getDictionary(locale);
  const { supabase, user } = await requireUser(locale);
  const membership = await getActiveMembership(user.id);

  if (!membership) return <CompanyOnboarding locale={locale} labels={d} />;
  const tenantId = membership.tenant_id;
  const [branches, teams, employees, owners] = await Promise.all([
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_owner", true).eq("status", "active"),
  ]);

  const stats = [[d.totalBranches, branches.count ?? 0], [d.totalTeams, teams.count ?? 0], [d.totalEmployees, employees.count ?? 0], [d.totalOwners, owners.count ?? 0]];
  const features = [
    [d.secureTenant, d.secureTenantDesc], [d.configurableRoles, d.configurableRolesDesc],
    [d.bilingual, d.bilingualDesc], [d.audited, d.auditedDesc],
  ];

  return (
    <>
      <div className="page-head"><div><h1 className="page-title">{d.welcome}</h1><p className="muted">{d.foundation}</p></div></div>
      <section className="grid stats">
        {stats.map(([label, value]) => <article className="card" key={String(label)}><div className="muted">{label}</div><div className="stat-value">{value}</div></article>)}
      </section>
      <section className="grid feature-grid">
        {features.map(([title, body]) => <article className="card feature-card" key={title}><h3>{title}</h3><p className="muted">{body}</p></article>)}
      </section>
    </>
  );
}
