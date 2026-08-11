"use client";

import { useEffect, useRef } from "react";
import type { AppLocale } from "@/lib/i18n";

export function GlobalSearch({ locale }: { locale: AppLocale }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = locale === "ar" ? "بحث شامل" : "Global search";

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  return <form action={`/${locale}/search`} aria-label={label} className="global-search" method="get">
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    <input aria-label={label} maxLength={80} minLength={2} name="q" placeholder={locale === "ar" ? "ابحث عن موظف أو طلب أو مهمة…" : "Search people, requests, tasks…"} ref={inputRef} required />
    <kbd>/</kbd>
    <button aria-label={label} type="submit">↵</button>
  </form>;
}
