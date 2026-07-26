import { getDictionary, isLocale } from "@/lib/i18n";

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "en";
  const d = getDictionary(locale);
  const checks = [
    ["Multi-tenant schema and RLS", "Ready for review"],
    ["Authentication and profile provisioning", "Ready for review"],
    ["Configurable tenant roles", "Ready for review"],
    ["Branch, team, and employee foundation", "Ready for review"],
    ["Arabic and English navigation", "Ready for review"],
    ["Audit logging", "Ready for review"],
    ["Fingerprint device integration", "Deferred until device details"],
  ];
  return <><div className="page-head"><div><h1 className="page-title">{d.milestoneReady}</h1><p className="muted">Version 0.1.0-foundation</p></div></div><section className="card table-wrap"><table><thead><tr><th>Capability</th><th>{d.statusLabel}</th></tr></thead><tbody>{checks.map(([name,status]) => <tr key={name}><td>{name}</td><td><span className="badge">{status}</span></td></tr>)}</tbody></table></section></>;
}
