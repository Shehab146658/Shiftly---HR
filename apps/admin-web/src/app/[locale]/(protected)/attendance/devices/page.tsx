import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { createAttendanceDevice, importFingerprintAttendance, setAttendanceDeviceStatus } from "../../actions";

export const dynamic = "force-dynamic";

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function dateTime(value: string | null, locale: string, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: timezone,
  }).format(new Date(value));
}

export default async function AttendanceDevicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, membership, supabase } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;

  const [{ data: devices, error: deviceError }, { data: batches, error: batchError }, { data: branches }, { data: tenant }, { data: canManage }] = await Promise.all([
    supabase.from("attendance_devices").select("*, branches(name_en,name_ar)").eq("tenant_id", tenantId).order("name"),
    supabase.from("attendance_import_batches").select("*").eq("tenant_id", tenantId).order("started_at", { ascending: false }).limit(30),
    supabase.from("branches").select("id,code,name_en,name_ar").eq("tenant_id", tenantId).eq("is_active", true).order("name_en"),
    supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle(),
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "attendance.manage" }),
  ]);
  if (deviceError) throw deviceError;
  if (batchError) throw batchError;
  const batchIds = (batches ?? []).map((batch) => batch.id);
  const { data: errorRows, error: rowError } = batchIds.length
    ? await supabase.from("attendance_import_rows").select("id,batch_id,row_number,employee_number,occurred_at_text,punch_type_text,error_message").in("batch_id", batchIds).eq("status", "error").order("row_number").limit(200)
    : { data: [], error: null };
  if (rowError) throw rowError;

  const timezone = tenant?.timezone ?? "Africa/Cairo";
  const activeDevices = (devices ?? []).filter((device) => device.status === "active").length;
  const totalRows = (batches ?? []).reduce((sum, batch) => sum + batch.row_count, 0);
  const importedRows = (batches ?? []).reduce((sum, batch) => sum + batch.imported_count, 0);
  const duplicateRows = (batches ?? []).reduce((sum, batch) => sum + batch.duplicate_count, 0);
  const failedRows = (batches ?? []).reduce((sum, batch) => sum + batch.error_count, 0);
  const successRate = totalRows ? Math.round(((importedRows + duplicateRows) / totalRows) * 100) : 0;
  const latestSync = (devices ?? []).map((device) => device.last_synced_at).filter(Boolean).sort().at(-1) ?? null;
  const batchById = new Map((batches ?? []).map((batch) => [batch.id, batch]));

  const copy = locale === "ar" ? {
    title: "أجهزة البصمة والاستيراد", subtitle: "سجل الأجهزة، استورد ملفات الحضور بأمان، وراجع كل صف لم تتم مطابقته.", attendance: "تقرير الحضور", addDevice: "إضافة جهاز", addTitle: "تسجيل جهاز بصمة", addHelp: "عرّف الجهاز والفرع والمنطقة الزمنية. بيانات الاتصال السرية لا تُحفظ هنا.", import: "استيراد بصمات", importTitle: "استيراد ملف الجهاز", importHelp: "يدعم CSV وTXT وXLSX حتى 10,000 صف. يمنع تكرار الملف والبصمات تلقائياً.",
    devices: "الأجهزة", active: "نشط", inactive: "متوقف", error: "يحتاج متابعة", latestSync: "آخر مزامنة", successRate: "نسبة المطابقة", attention: "صفوف تحتاج مراجعة", noSync: "لم تتم مزامنة بعد", code: "كود الجهاز", name: "اسم الجهاز", provider: "الشركة/النوع", model: "الموديل", serial: "الرقم التسلسلي", branch: "الفرع", allBranches: "يحدد من الموظف أو الملف", mode: "طريقة الربط", timezone: "المنطقة الزمنية", save: "حفظ الجهاز", saved: "تمت إضافة الجهاز.", activate: "تفعيل", pause: "إيقاف", statusChanged: "تم تحديث حالة الجهاز.",
    file: "ملف الحضور", device: "الجهاز", columns: "مطابقة أعمدة اختيارية", columnsHelp: "اتركها فارغة للتعرف التلقائي. استخدم أسماء الأعمدة كما تظهر في الصف الأول.", employeeColumn: "عمود رقم الموظف", timeColumn: "عمود التاريخ والوقت", typeColumn: "عمود نوع البصمة", referenceColumn: "عمود رقم السجل", branchColumn: "عمود كود الفرع", inValues: "قيم الحضور", outValues: "قيم الانصراف", valuesHelp: "قيم مفصولة بفواصل حسب الجهاز.", runImport: "استيراد ومطابقة", imported: "تمت معالجة الملف. راجع النتيجة أدناه.", batches: "سجل الاستيراد", rows: "الصفوف", accepted: "مستوردة", duplicates: "مكررة", failed: "أخطاء", started: "بدأ", noDevices: "أضف جهازاً قبل استيراد ملف حضور.", noBatches: "لا توجد ملفات مستوردة بعد.", row: "صف", employee: "الموظف", timestamp: "وقت البصمة", punchType: "النوع", issue: "سبب عدم المطابقة", close: d.close, cancel: d.cancel, saving: d.saving, actionFailed: d.actionFailed,
  } : {
    title: "Fingerprint devices & imports", subtitle: "Register terminals, import attendance safely, and reconcile every unmatched row.", attendance: "Attendance report", addDevice: "Add device", addTitle: "Register fingerprint device", addHelp: "Identify the terminal, branch, and timezone. Connection secrets are never stored in this form.", import: "Import punches", importTitle: "Import device attendance", importHelp: "Supports CSV, TXT, and XLSX up to 10,000 rows. File and punch duplicates are blocked automatically.",
    devices: "Devices", active: "Active", inactive: "Paused", error: "Needs attention", latestSync: "Latest sync", successRate: "Match rate", attention: "Rows to review", noSync: "Never synced", code: "Device code", name: "Device name", provider: "Provider/type", model: "Model", serial: "Serial number", branch: "Branch", allBranches: "Resolve from employee or file", mode: "Connection mode", timezone: "Timezone", save: "Save device", saved: "Device registered successfully.", activate: "Activate", pause: "Pause", statusChanged: "Device status updated.",
    file: "Attendance file", device: "Device", columns: "Optional column mapping", columnsHelp: "Leave blank for automatic detection. Use names exactly as they appear in the first row.", employeeColumn: "Employee number column", timeColumn: "Date/time column", typeColumn: "Punch type column", referenceColumn: "Record ID column", branchColumn: "Branch code column", inValues: "Check-in values", outValues: "Check-out values", valuesHelp: "Comma-separated values used by this device.", runImport: "Import and reconcile", imported: "File processed. Review its result below.", batches: "Import history", rows: "Rows", accepted: "Imported", duplicates: "Duplicates", failed: "Errors", started: "Started", noDevices: "Register a device before importing attendance.", noBatches: "No attendance files imported yet.", row: "Row", employee: "Employee", timestamp: "Punch time", punchType: "Type", issue: "Reconciliation issue", close: d.close, cancel: d.cancel, saving: d.saving, actionFailed: d.actionFailed,
  };
  const statusLabels: Record<string, string> = { active: copy.active, inactive: copy.inactive, error: copy.error, processing: locale === "ar" ? "قيد المعالجة" : "Processing", completed: locale === "ar" ? "مكتمل" : "Completed", completed_with_errors: locale === "ar" ? "مكتمل مع أخطاء" : "Completed with errors", failed: copy.failed };

  return <>
    <div className="page-head">
      <div><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div>
      <div className="page-actions">
        <Link className="button ghost" href={`/${locale}/attendance`}>{copy.attendance}</Link>
        {canManage ? <CreateDialog closeLabel={copy.close} description={copy.addHelp} eyebrow={copy.devices} title={copy.addTitle} triggerLabel={copy.addDevice}>
          <ActionForm action={createAttendanceDevice.bind(null, locale, tenantId)} className="stack" errorMessage={copy.actionFailed} pendingMessage={copy.saving} resetOnSuccess successMessage={copy.saved}>
            <div className="form-grid"><div className="field"><label>{copy.code}</label><input className="input" name="code" pattern="[A-Za-z0-9_-]{2,30}" placeholder="FP-MAIN" required /></div><div className="field"><label>{copy.name}</label><input className="input" name="name" placeholder="Main entrance terminal" required /></div><div className="field"><label>{copy.provider}</label><input className="input" defaultValue="generic" name="provider" required /></div><div className="field"><label>{copy.model}</label><input className="input" name="model" /></div><div className="field"><label>{copy.serial}</label><input className="input" name="serialNumber" /></div><div className="field"><label>{copy.branch}</label><select className="select" name="branchId"><option value="">{copy.allBranches}</option>{branches?.map((branch) => <option key={branch.id} value={branch.id}>{locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en} · {branch.code}</option>)}</select></div><div className="field"><label>{copy.mode}</label><select className="select" defaultValue="file" name="connectionMode"><option value="file">CSV / XLSX</option><option value="api">API</option><option value="database">Database</option><option value="sdk">SDK / local agent</option></select></div><div className="field"><label>{copy.timezone}</label><input className="input" defaultValue={timezone} name="timezone" required /></div></div>
            <button className="button" type="submit">{copy.save}</button>
          </ActionForm>
        </CreateDialog> : null}
        {canManage && activeDevices ? <CreateDialog closeLabel={copy.close} description={copy.importHelp} eyebrow={copy.import} title={copy.importTitle} triggerLabel={copy.import}>
          <ActionForm action={importFingerprintAttendance.bind(null, locale, tenantId)} className="stack" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.imported}>
            <div className="form-grid"><div className="field"><label>{copy.device}</label><select className="select" name="deviceId" required><option value="">—</option>{devices?.filter((device) => device.status === "active").map((device) => <option key={device.id} value={device.id}>{device.name} · {device.code}</option>)}</select></div><div className="field"><label>{copy.file}</label><input accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="input file-input" name="attendanceFile" required type="file" /></div></div>
            <details className="mapping-details"><summary>{copy.columns}</summary><p className="muted">{copy.columnsHelp}</p><div className="form-grid"><div className="field"><label>{copy.employeeColumn}</label><input className="input" name="employeeColumn" placeholder="PIN" /></div><div className="field"><label>{copy.timeColumn}</label><input className="input" name="occurredAtColumn" placeholder="Punch Time" /></div><div className="field"><label>{copy.typeColumn}</label><input className="input" name="punchTypeColumn" placeholder="State" /></div><div className="field"><label>{copy.referenceColumn}</label><input className="input" name="referenceColumn" placeholder="Log ID" /></div><div className="field"><label>{copy.branchColumn}</label><input className="input" name="branchColumn" placeholder="Branch" /></div><div className="field"><label>{copy.inValues}</label><input className="input" defaultValue="check_in,in,0,1,entry" name="checkInValues" /></div><div className="field"><label>{copy.outValues}</label><input className="input" defaultValue="check_out,out,2,exit" name="checkOutValues" /></div></div><small className="muted">{copy.valuesHelp}</small></details>
            <button className="button" type="submit">{copy.runImport}</button>
          </ActionForm>
        </CreateDialog> : null}
      </div>
    </div>

    <section className="stats-grid device-stats">
      <article className="stat-card"><span>{copy.devices}</span><strong>{devices?.length ?? 0}</strong><small>{activeDevices} {copy.active.toLowerCase()}</small></article>
      <article className="stat-card"><span>{copy.latestSync}</span><strong className="stat-date-value">{latestSync ? dateTime(latestSync, locale, timezone) : copy.noSync}</strong><small>{timezone}</small></article>
      <article className="stat-card"><span>{copy.successRate}</span><strong>{successRate}%</strong><small>{importedRows + duplicateRows} / {totalRows} {copy.rows.toLowerCase()}</small></article>
      <a className="stat-card" href="#import-errors"><span>{copy.attention}</span><strong>{failedRows}</strong><small>{copy.issue}</small></a>
    </section>

    <section className="card section-gap"><div className="card-heading"><div><h2>{copy.devices}</h2><p className="muted">{devices?.length ?? 0} · {activeDevices} {copy.active.toLowerCase()}</p></div></div>
      <div className="device-grid">{devices?.map((device) => {
        const branch = relationOne(device.branches);
        return <article className={`device-card device-${device.status}`} key={device.id}><div className="device-card-head"><span className="device-symbol" aria-hidden="true">◉</span><div><h3>{device.name}</h3><p className="code">{device.code}</p></div><span className={`badge status-${device.status}`}>{statusLabels[device.status] ?? device.status}</span></div><dl><div><dt>{copy.branch}</dt><dd>{locale === "ar" && branch?.name_ar ? branch.name_ar : branch?.name_en ?? copy.allBranches}</dd></div><div><dt>{copy.provider}</dt><dd>{device.provider}{device.model ? ` · ${device.model}` : ""}</dd></div><div><dt>{copy.serial}</dt><dd title={device.serial_number ?? "—"}>{device.serial_number ?? "—"}</dd></div><div><dt>{copy.latestSync}</dt><dd>{dateTime(device.last_synced_at, locale, device.timezone)}</dd></div></dl>{device.last_error ? <p className="device-error">{device.last_error}</p> : null}{canManage ? <ActionForm action={setAttendanceDeviceStatus.bind(null, locale, device.id, device.status === "active" ? "inactive" : "active")} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.statusChanged}><button className="button ghost small-button" type="submit">{device.status === "active" ? copy.pause : copy.activate}</button></ActionForm> : null}</article>;
      })}{!devices?.length ? <div className="empty full-grid">{copy.noDevices}</div> : null}</div>
    </section>

    <section className="card stack section-gap"><div><h2>{copy.batches}</h2><p className="muted">{copy.importHelp}</p></div><div className="table-wrap"><table className="import-batch-table"><thead><tr><th>{copy.file}</th><th>{copy.device}</th><th>{copy.started}</th><th>{copy.rows}</th><th>{copy.accepted}</th><th>{copy.duplicates}</th><th>{copy.failed}</th><th>Status</th></tr></thead><tbody>{batches?.map((batch) => { const device = devices?.find((item) => item.id === batch.device_id); return <tr key={batch.id}><td><strong title={batch.file_name}>{batch.file_name}</strong><small className="table-subline code">{batch.file_sha256.slice(0, 12)}…</small></td><td>{device?.name ?? "—"}</td><td>{dateTime(batch.started_at, locale, timezone)}</td><td>{batch.row_count}</td><td><span className="import-count success">{batch.imported_count}</span></td><td>{batch.duplicate_count}</td><td><a className={batch.error_count ? "import-count danger" : ""} href={batch.error_count ? `#batch-${batch.id}` : undefined}>{batch.error_count}</a></td><td><span className={`badge import-${batch.status}`}>{statusLabels[batch.status] ?? batch.status}</span></td></tr>; })}</tbody></table>{!batches?.length ? <div className="empty">{copy.noBatches}</div> : null}</div></section>

    <section className="card stack section-gap" id="import-errors"><div><h2>{copy.attention}</h2><p className="muted">{copy.columnsHelp}</p></div><div className="import-error-list">{errorRows?.map((row) => { const batch = batchById.get(row.batch_id); return <article className="import-error-row" id={`batch-${row.batch_id}`} key={row.id}><span className="error-row-number">{copy.row} {row.row_number}</span><div><strong>{row.employee_number ?? "—"}</strong><small>{row.occurred_at_text ?? "—"} · {row.punch_type_text ?? "—"}</small></div><p>{row.error_message}</p><small title={batch?.file_name}>{batch?.file_name ?? "—"}</small></article>; })}{!errorRows?.length ? <div className="empty">{failedRows ? copy.issue : d.empty}</div> : null}</div></section>
  </>;
}
