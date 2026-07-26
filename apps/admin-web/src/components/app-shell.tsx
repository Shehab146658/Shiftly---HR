import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import { signOut } from "@/app/[locale]/(protected)/actions";

export function AppShell({
  locale,
  userEmail,
  companyName,
  children,
}: {
  locale: AppLocale;
  userEmail: string;
  companyName?: string | null;
  children: React.ReactNode;
}) {
  const d = getDictionary(locale);
  const items = [
    ["dashboard", d.dashboard], ["branches", d.branches], ["teams", d.teams], ["employees", d.employees],
    ["shifts", d.shifts], ["schedules", d.schedules], ["roles", d.roles], ["audit", d.audit], ["status", d.status],
  ];
  const logout = signOut.bind(null, locale);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{d.product}</div>
        <nav className="nav">
          {items.map(([path, label]) => <Link key={path} href={`/${locale}/${path}`}>{label}</Link>)}
        </nav>
        <div className="sidebar-footer">
          <div><strong>{companyName ?? d.noCompany}</strong></div>
          <div style={{ color: "#b8c3d9", fontSize: ".86rem" }}>{userEmail}</div>
          <form action={logout}><button className="button ghost" style={{ width: "100%", color: "white" }}>{d.signOut}</button></form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong>{companyName ?? d.product}</strong>
          <LanguageSwitch locale={locale} />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
