import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { getTenantPageContext } from "@/lib/page-context";
import { adjustLeaveBalance, createPublicHoliday, deletePublicHoliday, updateLeaveType } from "../../actions";

export const dynamic = "force-dynamic";

export default async function LeaveSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const now = new Date();
  const from = `${now.getUTCFullYear() - 1}-01-01`;
  const to = `${now.getUTCFullYear() + 1}-12-31`;
  const copy = locale === "ar" ? {
    back: "العودة إلى الإجازات", title: "إعدادات الإجازات", subtitle: "إدارة سياسات الإجازات والأرصدة والعطلات ومسارات الموافقة من مكان واحد.", denied: "ليس لديك صلاحية إدارة سياسات الإجازات.",
    workflows: "مسارات الموافقة", workflowsHelp: "حدد المدير أو المالك أو الموارد البشرية أو دورًا مخصصًا لكل نوع إجازة.", configure: "تخصيص المسارات",
    policies: "سياسات أنواع الإجازات", policiesHelp: "يمكن زيادة مزايا الشركة مع الحفاظ على الحدود القانونية الدنيا.", active: "نشط", document: "يتطلب مستندًا", reason: "يتطلب سببًا", notice: "مهلة الطلب بالأيام", maxDays: "الحد الأقصى للطلب", save: "حفظ السياسة", saved: "تم حفظ سياسة الإجازة.",
    balances: "تعديل رصيد موظف", balancesHelp: "كل تعديل ينشئ حركة دفتر أستاذ قابلة للمراجعة ولا يستبدل السجل السابق.", employee: "الموظف", balanceCode: "رمز الرصيد", year: "السنة", units: "الوحدات (+ إضافة / - خصم)", kind: "نوع الحركة", adjustment: "تعديل", carryover: "مرحّل", settlement: "تسوية", holidayCredit: "رصيد عطلة", reversal: "عكس حركة", adjustmentReason: "سبب التعديل", apply: "تطبيق التعديل", adjusted: "تم تسجيل تعديل الرصيد.",
    ledger: "آخر حركات الأرصدة", noLedger: "لا توجد حركات أرصدة حتى الآن.", date: "التاريخ",
    holidays: "العطلات الرسمية والمخصصة", holidaysHelp: "عطلات مصر الافتراضية موجودة مسبقًا. أضف أيام الشركة أو التحديثات الرسمية هنا.", holidayDate: "تاريخ العطلة", nameEn: "الاسم بالإنجليزية", nameAr: "الاسم بالعربية", scope: "النطاق", everyone: "الجميع", muslim: "المسلمون", nonMuslim: "غير المسلمين", source: "المصدر أو القرار", paid: "مدفوعة", addHoliday: "إضافة عطلة", holidayAdded: "تمت إضافة العطلة.", delete: "حذف", deleteConfirm: "حذف هذه العطلة؟", holidayDeleted: "تم حذف العطلة.", noHolidays: "لا توجد عطلات في الفترة المعروضة.",
    actionFailed: d.actionFailed, saving: d.saving,
  } : {
    back: "Back to leave", title: "Leave settings", subtitle: "Manage leave policies, balances, holidays, and approval routes in one place.", denied: "You do not have permission to manage leave policies.",
    workflows: "Approval workflows", workflowsHelp: "Choose a manager, owner, HR, or custom role route for every leave type.", configure: "Configure workflows",
    policies: "Leave type policies", policiesHelp: "Company benefits can be made more generous while statutory minimums remain protected.", active: "Active", document: "Document required", reason: "Reason required", notice: "Notice days", maxDays: "Maximum days per request", save: "Save policy", saved: "Leave policy saved.",
    balances: "Adjust employee balance", balancesHelp: "Every adjustment creates an auditable ledger transaction and never overwrites history.", employee: "Employee", balanceCode: "Balance code", year: "Year", units: "Units (+ credit / - debit)", kind: "Transaction type", adjustment: "Adjustment", carryover: "Carryover", settlement: "Settlement", holidayCredit: "Holiday credit", reversal: "Reversal", adjustmentReason: "Adjustment reason", apply: "Apply adjustment", adjusted: "Balance adjustment recorded.",
    ledger: "Recent balance ledger", noLedger: "No balance transactions yet.", date: "Date",
    holidays: "Official & custom holidays", holidaysHelp: "Egypt defaults are preloaded. Add company days or official updates here.", holidayDate: "Holiday date", nameEn: "English name", nameAr: "Arabic name", scope: "Applies to", everyone: "Everyone", muslim: "Muslim employees", nonMuslim: "Non-Muslim employees", source: "Source or decree", paid: "Paid holiday", addHoliday: "Add holiday", holidayAdded: "Holiday added.", delete: "Delete", deleteConfirm: "Delete this holiday?", holidayDeleted: "Holiday deleted.", noHolidays: "No holidays in the displayed period.",
    actionFailed: d.actionFailed, saving: d.saving,
  };

  const [{ data: canManage }, { data: leaveTypes, error: leaveTypesError }, { data: employees, error: employeesError }, { data: holidays, error: holidaysError }, { data: ledger, error: ledgerError }] = await Promise.all([
    supabase.rpc("has_permission", { p_tenant_id: tenantId, p_permission: "leave.manage" }),
    supabase.from("leave_types").select("id, code, name_en, name_ar, is_statutory, is_active, requires_document, requires_reason, min_notice_days, max_days_per_request").eq("tenant_id", tenantId).order("name_en"),
    supabase.from("employees").select("id, employee_code, name_en, name_ar").eq("tenant_id", tenantId).neq("status", "terminated").order("name_en"),
    supabase.from("public_holidays").select("id, holiday_date, name_en, name_ar, religious_scope, source_reference, is_paid").eq("tenant_id", tenantId).gte("holiday_date", from).lte("holiday_date", to).order("holiday_date"),
    supabase.from("leave_balance_transactions").select("id, employee_id, balance_code, leave_year, kind, units, reason, created_at, employees(name_en, name_ar, employee_code)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (leaveTypesError) throw leaveTypesError;
  if (employeesError) throw employeesError;
  if (holidaysError) throw holidaysError;
  if (ledgerError) throw ledgerError;
  if (!canManage) return <><Link className="back-link" href={`/${locale}/leaves`}>← {copy.back}</Link><div className="card empty">{copy.denied}</div></>;

  return <>
    <div className="page-head"><div><Link className="back-link" href={`/${locale}/leaves`}>← {copy.back}</Link><h1 className="page-title">{copy.title}</h1><p className="muted">{copy.subtitle}</p></div><Link className="button" href={`/${locale}/requests/workflows`}>{copy.configure}</Link></div>

    <section className="settings-callout section-gap"><div><strong>{copy.workflows}</strong><p>{copy.workflowsHelp}</p></div><Link className="button secondary" href={`/${locale}/requests/workflows`}>{copy.configure}</Link></section>

    <section className="card stack section-gap"><div><h2>{copy.policies}</h2><p className="muted">{copy.policiesHelp}</p></div><div className="leave-policy-editor-grid">{leaveTypes?.map((type) => <ActionForm action={updateLeaveType.bind(null, locale, tenantId, type.id)} className="leave-policy-editor" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.saved} key={type.id}>
      <div className="leave-policy-title"><div><strong>{locale === "ar" ? type.name_ar : type.name_en}</strong><small>{type.code}{type.is_statutory ? " · statutory" : ""}</small></div></div>
      <div className="toggle-row"><label><input defaultChecked={type.is_active} name="isActive" type="checkbox" /> {copy.active}</label><label><input defaultChecked={type.requires_document} name="requiresDocument" type="checkbox" /> {copy.document}</label><label><input defaultChecked={type.requires_reason} name="requiresReason" type="checkbox" /> {copy.reason}</label></div>
      <div className="form-grid two"><div className="field"><label>{copy.notice}</label><input className="input" defaultValue={type.min_notice_days} min="0" max="365" name="minNoticeDays" type="number" /></div><div className="field"><label>{copy.maxDays}</label><input className="input" defaultValue={type.max_days_per_request ?? ""} min="0.5" name="maxDaysPerRequest" step="0.5" type="number" /></div></div>
      <button className="button secondary full" type="submit">{copy.save}</button>
    </ActionForm>)}</div></section>

    <div className="settings-two-column section-gap">
      <section className="card stack settings-action-card"><div><h2>{copy.balances}</h2><p className="muted">{copy.balancesHelp}</p></div><CreateDialog closeLabel={d.close} description={copy.balancesHelp} eyebrow={copy.ledger} title={copy.balances} triggerLabel={copy.balances} width="medium"><ActionForm action={adjustLeaveBalance.bind(null, locale)} className="form-grid" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.adjusted} resetOnSuccess>
        <div className="field full"><label>{copy.employee}</label><select className="select" name="employeeId" required>{employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} · {locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</option>)}</select></div>
        <div className="field"><label>{copy.balanceCode}</label><select className="select" defaultValue="annual" name="balanceCode">{leaveTypes?.filter((type) => type.code === "annual" || type.code === "sick").map((type) => <option key={type.code} value={type.code}>{locale === "ar" ? type.name_ar : type.name_en}</option>)}</select></div>
        <div className="field"><label>{copy.year}</label><input className="input" defaultValue={now.getUTCFullYear()} min="2000" max="2200" name="leaveYear" type="number" required /></div>
        <div className="field"><label>{copy.units}</label><input className="input" name="units" step="0.25" type="number" required /></div>
        <div className="field"><label>{copy.kind}</label><select className="select" defaultValue="adjustment" name="kind"><option value="adjustment">{copy.adjustment}</option><option value="carryover">{copy.carryover}</option><option value="settlement">{copy.settlement}</option><option value="holiday_credit">{copy.holidayCredit}</option><option value="reversal">{copy.reversal}</option></select></div>
        <div className="field full"><label>{copy.adjustmentReason}</label><textarea className="textarea" name="reason" required /></div><button className="button full" type="submit">{copy.apply}</button>
      </ActionForm></CreateDialog></section>

      <section className="card stack settings-action-card"><div><h2>{copy.holidays}</h2><p className="muted">{copy.holidaysHelp}</p></div><CreateDialog closeLabel={d.close} description={copy.holidaysHelp} eyebrow={copy.holidays} title={copy.addHoliday} triggerLabel={copy.addHoliday} width="medium"><ActionForm action={createPublicHoliday.bind(null, locale, tenantId)} className="form-grid" errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.holidayAdded} resetOnSuccess>
        <div className="field"><label>{copy.holidayDate}</label><input className="input" name="holidayDate" type="date" required /></div><div className="field"><label>{copy.scope}</label><select className="select" defaultValue="all" name="religiousScope"><option value="all">{copy.everyone}</option><option value="muslim">{copy.muslim}</option><option value="non_muslim">{copy.nonMuslim}</option></select></div>
        <div className="field"><label>{copy.nameEn}</label><input className="input" name="nameEn" required /></div><div className="field"><label>{copy.nameAr}</label><input className="input" dir="rtl" name="nameAr" required /></div>
        <div className="field full"><label>{copy.source}</label><input className="input" name="sourceReference" /></div><label className="checkbox-line full"><input defaultChecked name="isPaid" type="checkbox" /> {copy.paid}</label><button className="button full" type="submit">{copy.addHoliday}</button>
      </ActionForm></CreateDialog></section>
    </div>

    <section className="card stack section-gap"><h2>{copy.ledger}</h2><div className="table-wrap"><table><thead><tr><th>{copy.employee}</th><th>{copy.balanceCode}</th><th>{copy.year}</th><th>{copy.kind}</th><th>{copy.units}</th><th>{copy.adjustmentReason}</th><th>{copy.date}</th></tr></thead><tbody>{ledger?.map((entry) => { const person = Array.isArray(entry.employees) ? entry.employees[0] : entry.employees; return <tr key={entry.id}><td>{person ? `${person.employee_code} · ${locale === "ar" && person.name_ar ? person.name_ar : person.name_en}` : "—"}</td><td>{entry.balance_code}</td><td>{entry.leave_year}</td><td>{entry.kind}</td><td><strong className={Number(entry.units) > 0 ? "positive-number" : "negative-number"}>{Number(entry.units) > 0 ? "+" : ""}{Number(entry.units).toFixed(2)}</strong></td><td>{entry.reason}</td><td>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium" }).format(new Date(entry.created_at))}</td></tr>; })}</tbody></table>{!ledger?.length ? <div className="empty">{copy.noLedger}</div> : null}</div></section>

    <section className="card stack section-gap"><h2>{copy.holidays}</h2><div className="holiday-admin-list">{holidays?.map((holiday) => <div className="holiday-admin-row" key={holiday.id}><time dateTime={holiday.holiday_date}>{holiday.holiday_date}</time><div><strong>{locale === "ar" ? holiday.name_ar : holiday.name_en}</strong><small>{holiday.religious_scope} · {holiday.is_paid ? copy.paid : "unpaid"}{holiday.source_reference ? ` · ${holiday.source_reference}` : ""}</small></div><ActionForm action={deletePublicHoliday.bind(null, locale, tenantId, holiday.id)} confirmMessage={copy.deleteConfirm} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.holidayDeleted}><button className="button danger small-button" type="submit">{copy.delete}</button></ActionForm></div>)}{!holidays?.length ? <div className="empty">{copy.noHolidays}</div> : null}</div></section>
  </>;
}
