"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { AppIcon, BrandMark, type AppIconName } from "@/components/brand-mark";
import { NotificationCenter, type NotificationItem } from "@/components/notification-center";
import { GlobalSearch } from "@/components/global-search";
import { getDictionary, type AppLocale } from "@/lib/i18n";
import { signOut } from "@/app/[locale]/(protected)/actions";

export function AppShell({
  locale,
  userEmail,
  userId,
  userName,
  isOwner,
  companyName,
  tenantId,
  notifications = [],
  permissions = [],
  children,
}: {
  locale: AppLocale;
  userEmail: string;
  userId: string;
  userName?: string | null;
  isOwner?: boolean;
  companyName?: string | null;
  tenantId?: string;
  notifications?: NotificationItem[];
  permissions?: string[];
  children: React.ReactNode;
}) {
  const d = getDictionary(locale);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const permissionSet = new Set(permissions);
  const allItems: Array<[string, string, AppIconName, string | null]> = [
    ["dashboard", d.dashboard, "dashboard", null], ["branches", d.branches, "branches", "branches.read"], ["teams", d.teams, "teams", "teams.read"], ["employees", d.employees, "employees", "employees.read"],
    ["shifts", d.shifts, "shifts", "shifts.read"], ["schedules", d.schedules, "schedules", "schedules.read"], ["attendance", d.attendance, "attendance", "attendance.read"], ["leaves", d.leaves, "leaves", "leave.read"], ["requests", d.requests, "requests", "requests.read"], ["payroll", d.payroll, "payroll", null], ["loans", d.loans, "loans", "loans.read"], ["performance", d.performance, "performance", "sales.read"], ["tasks", d.tasks, "tasks", "tasks.read"], ["announcements", d.announcements, "announcements", "announcements.read"], ["reports", d.reports, "reports", "reports.read"], ["roles", d.roles, "roles", "roles.read"], ["audit", d.audit, "audit", "audit.read"],
  ];
  const items = allItems.filter(([, , , permission]) => isOwner || permission === null || permissionSet.has(permission));
  const logout = signOut.bind(null, locale);
  const profileHref = `/${locale}/profiles/${userId}`;
  const displayName = userName?.trim() || userEmail;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("menu-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  return (
    <div className="shell">
      <button
        aria-controls="primary-navigation"
        aria-expanded={menuOpen}
        aria-label={menuOpen
          ? (locale === "ar" ? "إغلاق القائمة" : "Close navigation")
          : (locale === "ar" ? "فتح القائمة" : "Open navigation")}
        className={`menu-button shell-menu-button${menuOpen ? " shell-menu-button-open" : ""}`}
        onClick={() => setMenuOpen((open) => !open)}
        type="button"
      >
        {menuOpen
          ? <span aria-hidden="true" className="menu-button-close">×</span>
          : <span aria-hidden="true" className="menu-button-lines"><i /><i /><i /></span>}
      </button>
      <button
        aria-label={locale === "ar" ? "إغلاق القائمة" : "Close navigation"}
        className={`sidebar-overlay${menuOpen ? " sidebar-overlay-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
        type="button"
      />
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`} id="primary-navigation">
        <div className="sidebar-head">
          <Link aria-label={`${d.product} · ${d.dashboard}`} className="sidebar-brand" href={`/${locale}/dashboard`} onClick={() => setMenuOpen(false)}><BrandMark /></Link>
          <button
            aria-label={locale === "ar" ? "إغلاق القائمة" : "Close navigation"}
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <nav className="nav">
          {items.map(([path, label, icon]) => {
            const href = `/${locale}/${path}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} key={path} href={href} onClick={() => setMenuOpen(false)}><AppIcon className="nav-icon" name={icon} /><span>{label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <Link className="sidebar-profile" href={profileHref} onClick={() => setMenuOpen(false)}>
            <span className="sidebar-avatar">{initials || "U"}</span>
            <span className="sidebar-profile-copy"><strong title={displayName}>{displayName}</strong><small title={userEmail}>{isOwner ? d.companyOwner : d.companyUser} · {userEmail}</small></span>
            <AppIcon className="profile-chevron" name="profile" />
          </Link>
          <form action={logout}><button className="button ghost" style={{ width: "100%", color: "white" }}>{d.signOut}</button></form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-start">
            <div className="topbar-identity">
              <Link className="topbar-brand-link" href={`/${locale}/dashboard`}><BrandMark compact /></Link>
              <strong title={companyName ?? d.product}>{companyName ?? d.product}</strong>
            </div>
          </div>
          <GlobalSearch locale={locale} />
          <div className="topbar-actions"><NotificationCenter locale={locale} notifications={notifications} tenantId={tenantId} /><LanguageSwitch locale={locale} /></div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
