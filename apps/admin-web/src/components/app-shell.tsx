"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = [
    ["dashboard", d.dashboard], ["branches", d.branches], ["teams", d.teams], ["employees", d.employees],
    ["shifts", d.shifts], ["schedules", d.schedules], ["roles", d.roles], ["audit", d.audit], ["status", d.status],
  ];
  const logout = signOut.bind(null, locale);

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
        aria-label={locale === "ar" ? "إغلاق القائمة" : "Close navigation"}
        className={`sidebar-overlay${menuOpen ? " sidebar-overlay-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
        type="button"
      />
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`} id="primary-navigation">
        <div className="sidebar-head">
          <div className="brand">{d.product}</div>
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
          {items.map(([path, label]) => {
            const href = `/${locale}/${path}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link aria-current={active ? "page" : undefined} className={active ? "active" : undefined} key={path} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div><strong>{companyName ?? d.noCompany}</strong></div>
          <div style={{ color: "#b8c3d9", fontSize: ".86rem" }}>{userEmail}</div>
          <form action={logout}><button className="button ghost" style={{ width: "100%", color: "white" }}>{d.signOut}</button></form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              aria-controls="primary-navigation"
              aria-expanded={menuOpen}
              aria-label={locale === "ar" ? "فتح القائمة" : "Open navigation"}
              className="menu-button"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <span aria-hidden="true" className="menu-button-lines"><i /><i /><i /></span>
            </button>
            <div className="topbar-identity">
              <span className="topbar-product">{d.product}</span>
              <strong>{companyName ?? d.product}</strong>
            </div>
          </div>
          <LanguageSwitch locale={locale} />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
