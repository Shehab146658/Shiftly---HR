import type { ReactNode } from "react";

export type AppIconName = "dashboard" | "branches" | "teams" | "employees" | "shifts" | "schedules" | "attendance" | "leaves" | "requests" | "payroll" | "loans" | "performance" | "tasks" | "announcements" | "roles" | "audit" | "profile";

const iconPaths: Record<AppIconName, ReactNode> = {
  dashboard: <><rect height="7" rx="1.5" width="7" x="3" y="3" /><rect height="7" rx="1.5" width="7" x="14" y="3" /><rect height="7" rx="1.5" width="7" x="3" y="14" /><rect height="7" rx="1.5" width="7" x="14" y="14" /></>,
  branches: <><path d="M4 21V7l8-4 8 4v14" /><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M9 21v-3h6v3" /></>,
  teams: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  employees: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  shifts: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  schedules: <><rect height="18" rx="2" width="18" x="3" y="4" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  attendance: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2M7.5 3.8 5.7 2M16.5 3.8 18.3 2" /><path d="m8.5 16.5 2 2 4.5-5" /></>,
  leaves: <><path d="M12 3c3.5 2.4 6.2 5.3 6.2 9.1A6.2 6.2 0 1 1 5.8 12C5.8 8.3 8.5 5.4 12 3Z" /><path d="M8.5 13.2 10.8 15l4.6-5" /></>,
  requests: <><rect height="18" rx="2" width="16" x="4" y="3" /><path d="M8 8h8M8 12h5M8 16h3" /><path d="m15 16 1.5 1.5L20 14" /></>,
  payroll: <><rect height="16" rx="2" width="18" x="3" y="5" /><path d="M3 10h18M7 16h3M15 15.5h2" /><circle cx="16" cy="8" r=".5" /></>,
  loans: <><rect height="14" rx="3" width="18" x="3" y="7" /><path d="M7 7V5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2M3 12h18M8 16h4" /></>,
  performance: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /><path d="m3 8 7-6 6 8 6-5" /></>,
  tasks: <><rect height="18" rx="2" width="18" x="3" y="3" /><path d="m7 8 1.5 1.5L11 7M13 8h4M7 14l1.5 1.5L11 13M13 14h4" /></>,
  announcements: <><path d="m3 11 16-7v16L3 13Z" /><path d="M11 16v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6M19 9a3 3 0 0 1 0 6" /></>,
  roles: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  audit: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
};

export function AppIcon({ name, className = "" }: { name: AppIconName; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{iconPaths[name]}</svg>;
}
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
    <span className="brand-symbol" aria-hidden="true">
      <svg fill="none" viewBox="0 0 42 42"><path d="M11 13.5 19.5 8c2.2-1.4 5.1-1.4 7.3 0L32 11.4c1.8 1.2 1.8 3.8 0 5l-5.8 3.8a3.4 3.4 0 0 1-3.7 0L17 16.7" /><path d="m31 28.5-8.5 5.5a6.8 6.8 0 0 1-7.3 0L10 30.6c-1.8-1.2-1.8-3.8 0-5l5.8-3.8a3.4 3.4 0 0 1 3.7 0l5.5 3.5" /></svg>
    </span>
    <span className="brand-wordmark"><strong>SHIFTLY</strong><small>PEOPLE OPERATIONS</small></span>
  </span>;
}
