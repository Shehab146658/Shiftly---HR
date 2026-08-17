"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n";

export function GlobalSearch({ locale }: { locale: AppLocale }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const formId = useId();
  const label = locale === "ar" ? "بحث شامل" : "Global search";
  const closeLabel = locale === "ar" ? "إغلاق البحث" : "Close search";

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      if (window.matchMedia("(max-width: 640px)").matches) setMobileOpen(true);
      else inputRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    inputRef.current?.focus();
    document.body.classList.add("search-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("search-open");
    };
  }, [mobileOpen]);

  const searchIcon = <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;

  return <div className={`global-search-wrap${mobileOpen ? " global-search-wrap-open" : ""}`}>
    <button
      aria-controls={formId}
      aria-expanded={mobileOpen}
      aria-label={label}
      className="global-search-mobile-trigger"
      onClick={() => setMobileOpen(true)}
      type="button"
    >
      {searchIcon}
    </button>
    <button aria-label={closeLabel} className="global-search-backdrop" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1} type="button" />
    <form action={`/${locale}/search`} aria-label={label} className="global-search" id={formId} method="get" onSubmit={() => setMobileOpen(false)}>
      {searchIcon}
      <input aria-label={label} maxLength={80} minLength={2} name="q" placeholder={locale === "ar" ? "ابحث عن موظف أو طلب أو مهمة…" : "Search people, requests, tasks…"} ref={inputRef} required />
      <kbd>/</kbd>
      <button aria-label={label} className="global-search-submit" type="submit">↵</button>
      <button aria-label={closeLabel} className="global-search-close" onClick={() => setMobileOpen(false)} type="button">×</button>
    </form>
  </div>;
}
