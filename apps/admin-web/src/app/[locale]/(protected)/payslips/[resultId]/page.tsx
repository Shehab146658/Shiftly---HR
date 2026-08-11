import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PayslipPrintButton } from "@/components/payslip-print-button";
import { getTenantPageContext } from "@/lib/page-context";
import { acknowledgePayslip } from "../../actions";

export const dynamic = "force-dynamic";
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function money(value: number | string | null | undefined, currency: string, locale: string) { return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value ?? 0)); }

export default async function PayslipPage({ params }: { params: Promise<{ locale: string; resultId: string }> }) {
  const { locale: rawLocale, resultId } = await params;
  const { locale, dictionary: d, supabase, membership } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const copy = locale === "ar" ? { back: "العودة إلى الرواتب", title: "قسيمة المرتب", employee: "الموظف", period: "الدورة", payDate: "تاريخ الصرف", earnings: "الاستحقاقات", deductions: "الخصومات", net: "صافي المرتب", attendance: "ملخص الحضور", scheduled: "أيام مجدولة", worked: "ساعات فعلية", absence: "غياب", overtime: "إضافي", late: "تأخير", missing: "وقت ناقص", component: "البند", amount: "القيمة", source: "المصدر", print: "طباعة / حفظ PDF", acknowledge: "تأكيد الاستلام", acknowledged: "تم تأكيد استلام القسيمة.", alreadyAcknowledged: "تم تأكيد الاستلام", confidential: "مستند سري للموظف", actionFailed: d.actionFailed, saving: d.saving } : { back: "Back to payroll", title: "Payslip", employee: "Employee", period: "Period", payDate: "Pay date", earnings: "Earnings", deductions: "Deductions", net: "Net pay", attendance: "Attendance summary", scheduled: "Scheduled days", worked: "Worked hours", absence: "Absence", overtime: "Overtime", late: "Late", missing: "Missing time", component: "Component", amount: "Amount", source: "Source", print: "Print / save PDF", acknowledge: "Acknowledge receipt", acknowledged: "Payslip receipt acknowledged.", alreadyAcknowledged: "Receipt acknowledged", confidential: "Confidential employee document", actionFailed: d.actionFailed, saving: d.saving };
  const [{ data: result, error }, { data: payslip, error: payslipError }] = await Promise.all([
    supabase.from("payroll_employee_results").select("id, salary_basis, currency_code, scheduled_days, worked_days, absence_days, worked_minutes, overtime_minutes, late_minutes, missing_minutes, earnings_amount, deductions_amount, net_amount, employees(employee_code, name_en, name_ar, position), payroll_periods(id, name, code, period_start, period_end, pay_date, status), payroll_components(id, name_en, name_ar, kind, source_type, amount, reason)").eq("tenant_id", membership.tenant_id).eq("id", resultId).maybeSingle(),
    supabase.from("payslips").select("id, payslip_number, published_at, acknowledged_at").eq("tenant_id", membership.tenant_id).eq("result_id", resultId).maybeSingle(),
  ]);
  if (error) throw error; if (payslipError) throw payslipError; if (!result || !payslip) notFound();
  const employee = one(result.employees); const period = one(result.payroll_periods); if (!employee || !period || period.status !== "published") notFound();
  const earnings = result.payroll_components.filter((component) => component.kind === "earning");
  const deductions = result.payroll_components.filter((component) => component.kind === "deduction");
  const numberLocale = locale === "ar" ? "ar-EG" : "en-EG";

  return <div className="payslip-page">
    <div className="page-head no-print"><Link className="back-link" href={`/${locale}/payroll`}>← {copy.back}</Link><div className="page-actions"><PayslipPrintButton label={copy.print} />{payslip.acknowledged_at ? <span className="badge status-approved">{copy.alreadyAcknowledged}</span> : <ActionForm action={acknowledgePayslip.bind(null, locale, result.id, payslip.id)} errorMessage={copy.actionFailed} pendingMessage={copy.saving} successMessage={copy.acknowledged}><button className="button secondary" type="submit">{copy.acknowledge}</button></ActionForm>}</div></div>
    <article className="payslip-document">
      <header className="payslip-header"><div><span className="payslip-brand">SHIFTLY</span><small>PEOPLE OPERATIONS</small></div><div><span>{copy.title}</span><strong>{payslip.payslip_number}</strong><small>{copy.confidential}</small></div></header>
      <section className="payslip-identifiers"><div><span>{copy.employee}</span><strong>{locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}</strong><small>{employee.employee_code} · {employee.position ?? "—"}</small></div><div><span>{copy.period}</span><strong>{period.name}</strong><small>{period.period_start} → {period.period_end}</small></div><div><span>{copy.payDate}</span><strong>{period.pay_date ?? period.period_end}</strong><small>{result.salary_basis}</small></div></section>
      <section className="payslip-money-grid"><div><span>{copy.earnings}</span><strong>{money(result.earnings_amount, result.currency_code, locale)}</strong></div><div><span>{copy.deductions}</span><strong>{money(result.deductions_amount, result.currency_code, locale)}</strong></div><div className="payslip-net"><span>{copy.net}</span><strong>{money(result.net_amount, result.currency_code, locale)}</strong></div></section>
      <section className="payslip-lines"><div><h2>{copy.earnings}</h2>{earnings.map((component) => <div key={component.id}><span>{locale === "ar" ? component.name_ar : component.name_en}<small>{component.source_type}</small></span><strong>{money(component.amount, result.currency_code, locale)}</strong></div>)}</div><div><h2>{copy.deductions}</h2>{deductions.map((component) => <div key={component.id}><span>{locale === "ar" ? component.name_ar : component.name_en}<small>{component.reason ?? component.source_type}</small></span><strong>{money(component.amount, result.currency_code, locale)}</strong></div>)}</div></section>
      <section className="payslip-attendance"><h2>{copy.attendance}</h2><div><span>{copy.scheduled}<strong>{Number(result.scheduled_days).toFixed(1)}</strong></span><span>{copy.worked}<strong>{new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(result.worked_minutes / 60)}</strong></span><span>{copy.absence}<strong>{Number(result.absence_days).toFixed(1)}</strong></span><span>{copy.overtime}<strong>{new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(result.overtime_minutes / 60)}</strong></span><span>{copy.late}<strong>{new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(result.late_minutes / 60)}</strong></span><span>{copy.missing}<strong>{new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(result.missing_minutes / 60)}</strong></span></div></section>
      <footer><span>{payslip.payslip_number}</span><span>{new Intl.DateTimeFormat(numberLocale, { dateStyle: "medium" }).format(new Date(payslip.published_at))}</span></footer>
    </article>
  </div>;
}
