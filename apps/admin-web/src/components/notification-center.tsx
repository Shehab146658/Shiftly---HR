"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/[locale]/(protected)/actions";
import type { AppLocale } from "@/lib/i18n";

export type NotificationItem = {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function localizedHref(href: string | null, locale: AppLocale) {
  if (!href) return `/${locale}/requests`;
  return href.replace(/^\/(en|ar)(?=\/)/, `/${locale}`);
}

export function NotificationCenter({ locale, tenantId, notifications }: { locale: AppLocale; tenantId?: string; notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [optimisticallyRead, setOptimisticallyRead] = useState(() => new Set<string>());
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const items = notifications.map((item) => optimisticallyRead.has(item.id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item);
  const unread = items.filter((item) => !item.read_at).length;
  const labels = locale === "ar" ? { title: "الإشعارات", empty: "لا توجد إشعارات جديدة.", markAll: "تحديد الكل كمقروء", pending: "جاري التحديث…" } : { title: "Notifications", empty: "No notifications yet.", markAll: "Mark all as read", pending: "Updating…" };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  function acknowledge(item: NotificationItem) {
    if (item.read_at) return;
    setOptimisticallyRead((current) => new Set(current).add(item.id));
    startTransition(async () => {
      await markNotificationRead(locale, item.id);
      router.refresh();
    });
  }

  function acknowledgeAll() {
    if (!tenantId || !unread) return;
    setOptimisticallyRead(new Set(notifications.map((item) => item.id)));
    startTransition(async () => {
      await markAllNotificationsRead(locale, tenantId);
      router.refresh();
    });
  }

  return <div className="notification-center" ref={root}>
    <button aria-expanded={open} aria-label={labels.title} className="notification-trigger" onClick={() => setOpen((value) => !value)} type="button">
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg>
      {unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}
    </button>
    {open ? <section aria-label={labels.title} className="notification-popover">
      <div className="notification-head"><div><strong>{labels.title}</strong><small>{unread} {locale === "ar" ? "غير مقروء" : "unread"}</small></div>{unread ? <button disabled={pending} onClick={acknowledgeAll} type="button">{pending ? labels.pending : labels.markAll}</button> : null}</div>
      <div className="notification-list">{items.map((item) => <Link className={item.read_at ? "" : "unread"} href={localizedHref(item.href, locale)} key={item.id} onClick={() => { acknowledge(item); setOpen(false); }}><i /><span><strong>{locale === "ar" ? item.title_ar : item.title_en}</strong><small>{locale === "ar" ? item.body_ar : item.body_en}</small><time>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time></span></Link>)}{!items.length ? <div className="notification-empty">{labels.empty}</div> : null}</div>
    </section> : null}
  </div>;
}
