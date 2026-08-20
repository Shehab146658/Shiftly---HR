import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";
import { InsightBars } from "@/components/insight-bars";
import { PerformanceTargetForm } from "@/components/performance-target-form";
import { getTenantPageContext } from "@/lib/page-context";
import {
  calculateBonusTarget,
  createBonusPolicy,
  createSalesTarget,
  recordSalesEntry,
  reviewBonusTarget,
  reviewSalesEntry,
} from "../actions";

export const dynamic = "force-dynamic";

function money(
  value: number | string | null | undefined,
  currency: string,
  locale: string,
) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

type BonusResult = {
  id: string;
  target_id: string;
  employee_id: string;
  actual_sales: number;
  achievement_percentage: number;
  tier_value: number;
  bonus_amount: number;
  status: string;
  calculation_snapshot: Record<string, unknown>;
};

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const {
    locale,
    dictionary: d,
    supabase,
    membership,
  } = await getTenantPageContext(rawLocale);
  if (!membership) return <div className="card">{d.noCompany}</div>;
  const tenantId = membership.tenant_id;
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  const copy =
    locale === "ar"
      ? {
          title: "المبيعات والأهداف",
          subtitle:
            "سجل مبيعات يومي قابل للمراجعة، أهداف للفروع والفرق والأفراد، ومكافآت متدرجة تنتقل للرواتب بعد الاعتماد.",
          approvedSales: "المبيعات المعتمدة",
          pendingSales: "بانتظار المراجعة",
          activeTargets: "الأهداف النشطة",
          approvedBonuses: "مكافآت معتمدة",
          salesByBranch: "المبيعات المعتمدة حسب الفرع",
          salesByBranchHelp: "يوضح أين يتحقق أكبر حجم مبيعات في السجل الحالي.",
          targetProgress: "تقدم الأهداف",
          targetProgressHelp: "متوسط نسبة التحقيق المحسوبة لكل هدف.",
          capture: "تسجيل مبيعات اليوم",
          date: "تاريخ العمل",
          branch: "الفرع",
          employee: "الموظف (اختياري)",
          branchTotal: "إجمالي الفرع",
          amount: "المبلغ",
          currency: "العملة",
          reference: "مرجع",
          notes: "ملاحظات",
          submit: "إرسال للمراجعة",
          salesSaved: "تم إرسال المبيعات للمراجعة.",
          ledger: "سجل المبيعات",
          status: "الحالة",
          approve: "اعتماد",
          reject: "رفض",
          reviewNote: "ملاحظة المراجعة",
          approved: "تم اعتماد المبيعات.",
          rejected: "تم رفض المبيعات.",
          noSales: "لا توجد مبيعات مسجلة بعد.",
          policies: "سياسات المكافآت",
          newPolicy: "سياسة مكافأة جديدة",
          code: "الرمز",
          name: "الاسم",
          nameAr: "الاسم بالعربية",
          basis: "طريقة المكافأة",
          fixed: "مبلغ ثابت",
          salaryPct: "نسبة من الراتب",
          salesPct: "نسبة من مبيعات الموظف",
          tierOne: "حد المستوى 1 %",
          valueOne: "قيمة المستوى 1",
          tierTwo: "حد المستوى 2 %",
          valueTwo: "قيمة المستوى 2",
          tierThree: "حد المستوى 3 %",
          valueThree: "قيمة المستوى 3",
          effective: "ساري من",
          createPolicy: "إنشاء السياسة",
          policyCreated: "تم إنشاء سياسة المكافآت.",
          targets: "الأهداف والحوافز",
          newTarget: "هدف جديد",
          start: "من",
          end: "إلى",
          scope: "نطاق الهدف",
          team: "الفريق",
          scopeRecord: "اختيار النطاق",
          policy: "سياسة المكافأة",
          createTarget: "إنشاء الهدف",
          targetCreated: "تم إنشاء الهدف.",
          select: "اختر...",
          calculate: "حساب النتائج",
          calculated: "تم حساب أداء الهدف.",
          achievement: "نسبة التحقيق",
          target: "الهدف",
          actual: "الفعلي",
          bonusPool: "إجمالي المكافآت",
          approveBonuses: "اعتماد للرواتب",
          rejectBonuses: "رفض النتائج",
          bonusesApproved: "تم اعتماد المكافآت للرواتب.",
          bonusesRejected: "تم رفض نتائج المكافآت.",
          noTargets: "لا توجد أهداف بعد.",
          saving: d.saving,
          failed: d.actionFailed,
        }
      : {
          title: "Sales & performance",
          subtitle:
            "Reviewable daily sales, branch/team/individual targets, and tiered bonuses that flow into payroll only after approval.",
          approvedSales: "Approved sales",
          pendingSales: "Awaiting review",
          activeTargets: "Active targets",
          approvedBonuses: "Approved bonuses",
          salesByBranch: "Approved sales by branch",
          salesByBranchHelp:
            "Shows where the largest approved sales volume is being generated.",
          targetProgress: "Target progress",
          targetProgressHelp: "Average calculated achievement for each target.",
          capture: "Record daily sales",
          date: "Business date",
          branch: "Branch",
          employee: "Employee (optional)",
          branchTotal: "Branch total",
          amount: "Amount",
          currency: "Currency",
          reference: "Reference",
          notes: "Notes",
          submit: "Submit for review",
          salesSaved: "Sales submitted for review.",
          ledger: "Sales ledger",
          status: "Status",
          approve: "Approve",
          reject: "Reject",
          reviewNote: "Review note",
          approved: "Sales entry approved.",
          rejected: "Sales entry rejected.",
          noSales: "No sales entries yet.",
          policies: "Bonus policies",
          newPolicy: "New bonus policy",
          code: "Code",
          name: "Name",
          nameAr: "Arabic name",
          basis: "Payout basis",
          fixed: "Fixed amount",
          salaryPct: "% of base salary",
          salesPct: "% of employee sales",
          tierOne: "Tier 1 threshold %",
          valueOne: "Tier 1 value",
          tierTwo: "Tier 2 threshold %",
          valueTwo: "Tier 2 value",
          tierThree: "Tier 3 threshold %",
          valueThree: "Tier 3 value",
          effective: "Effective from",
          createPolicy: "Create policy",
          policyCreated: "Bonus policy created.",
          targets: "Targets & incentives",
          newTarget: "New target",
          start: "Start",
          end: "End",
          scope: "Target scope",
          team: "Team",
          scopeRecord: "Scope record",
          policy: "Bonus policy",
          createTarget: "Create target",
          targetCreated: "Target created.",
          select: "Select...",
          calculate: "Calculate results",
          calculated: "Target performance calculated.",
          achievement: "Achievement",
          target: "Target",
          actual: "Actual",
          bonusPool: "Bonus pool",
          approveBonuses: "Approve for payroll",
          rejectBonuses: "Reject results",
          bonusesApproved: "Bonuses approved for payroll.",
          bonusesRejected: "Bonus results rejected.",
          noTargets: "No targets yet.",
          saving: d.saving,
          failed: d.actionFailed,
        };

  const [
    { data: canCreate },
    { data: canApprove },
    { data: canManage },
    { data: canApproveBonuses },
    { data: branches },
    { data: teams },
    { data: employees },
    { data: sales, error: salesError },
    { data: policies, error: policyError },
    { data: targets, error: targetError },
    { data: results, error: resultError },
  ] = await Promise.all([
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "sales.create",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "sales.approve",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "targets.manage",
    }),
    supabase.rpc("has_permission", {
      p_tenant_id: tenantId,
      p_permission: "bonuses.approve",
    }),
    supabase
      .from("branches")
      .select("id,code,name_en,name_ar")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name_en"),
    supabase
      .from("teams")
      .select("id,code,name_en,name_ar")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name_en"),
    supabase
      .from("employees")
      .select("id,employee_code,name_en,name_ar,branch_id,team_id,status")
      .eq("tenant_id", tenantId)
      .neq("status", "terminated")
      .order("name_en"),
    supabase
      .from("sales_entries")
      .select(
        "id,business_date,branch_id,employee_id,amount,currency_code,reference,notes,status,submitted_at,review_note",
      )
      .eq("tenant_id", tenantId)
      .order("business_date", { ascending: false })
      .limit(150),
    supabase
      .from("bonus_policies")
      .select(
        "id,code,name_en,name_ar,bonus_basis,tiers,is_active,effective_from,effective_to",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("sales_targets")
      .select(
        "id,code,name,period_start,period_end,scope_type,branch_id,team_id,employee_id,target_amount,currency_code,bonus_policy_id,is_active",
      )
      .eq("tenant_id", tenantId)
      .order("period_end", { ascending: false }),
    supabase
      .from("bonus_results")
      .select(
        "id,target_id,employee_id,actual_sales,achievement_percentage,tier_value,bonus_amount,status,calculation_snapshot",
      )
      .eq("tenant_id", tenantId),
  ]);
  if (salesError) throw salesError;
  if (policyError) throw policyError;
  if (targetError) throw targetError;
  if (resultError) throw resultError;
  const branchMap = new Map(
    (branches ?? []).map((branch) => [branch.id, branch]),
  );
  const teamMap = new Map((teams ?? []).map((team) => [team.id, team]));
  const employeeMap = new Map(
    (employees ?? []).map((employee) => [employee.id, employee]),
  );
  const resultRows = (results ?? []) as BonusResult[];
  const resultsByTarget = new Map<string, BonusResult[]>();
  for (const result of resultRows)
    resultsByTarget.set(result.target_id, [
      ...(resultsByTarget.get(result.target_id) ?? []),
      result,
    ]);
  const approvedSales = (sales ?? [])
    .filter((entry) => entry.status === "approved")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const pendingSales = (sales ?? []).filter(
    (entry) => entry.status === "submitted",
  ).length;
  const approvedBonus = resultRows
    .filter((result) => result.status === "approved")
    .reduce((sum, result) => sum + Number(result.bonus_amount), 0);
  const currency =
    sales?.[0]?.currency_code ?? targets?.[0]?.currency_code ?? "EGP";
  const approvedSalesByBranch = new Map<string, number>();
  for (const entry of sales ?? []) {
    if (entry.status !== "approved") continue;
    approvedSalesByBranch.set(
      entry.branch_id,
      (approvedSalesByBranch.get(entry.branch_id) ?? 0) + Number(entry.amount),
    );
  }
  const branchInsights = (branches ?? [])
    .map((branch) => ({
      label:
        locale === "ar" && branch.name_ar ? branch.name_ar : branch.name_en,
      value: approvedSalesByBranch.get(branch.id) ?? 0,
      displayValue: money(
        approvedSalesByBranch.get(branch.id) ?? 0,
        currency,
        locale,
      ),
      href: "#sales-ledger",
    }))
    .sort((left, right) => right.value - left.value);
  const targetInsights = (targets ?? [])
    .map((target) => {
      const targetResults = resultsByTarget.get(target.id) ?? [];
      const achievement = targetResults.length
        ? targetResults.reduce(
            (sum, result) => sum + Number(result.achievement_percentage),
            0,
          ) / targetResults.length
        : 0;
      return {
        label: target.name,
        value: achievement,
        displayValue: `${achievement.toFixed(1)}%`,
      };
    })
    .sort((left, right) => right.value - left.value);

  const targetLabels = {
    code: copy.code,
    automaticCode: locale === "ar" ? "كود تلقائي" : "Automatic code",
    automaticCodeHelp:
      locale === "ar"
        ? "سيُنشأ الكود عند الحفظ."
        : "The code is generated when you save.",
    name: copy.name,
    start: copy.start,
    end: copy.end,
    scope: copy.scope,
    branch: copy.branch,
    team: copy.team,
    employee: copy.employee.replace(" (optional)", ""),
    scopeRecord: copy.scopeRecord,
    select: copy.select,
    amount: copy.amount,
    currency: copy.currency,
    policy: copy.policy,
    create: copy.createTarget,
    created: copy.targetCreated,
    saving: copy.saving,
    failed: copy.failed,
  };
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        {canCreate ? (
          <CreateDialog
            closeLabel={d.close}
            description={copy.subtitle}
            eyebrow={copy.ledger}
            title={copy.capture}
            triggerLabel={copy.capture}
          >
            <ActionForm
              action={recordSalesEntry.bind(null, locale, tenantId)}
              className="form-grid business-form"
              errorMessage={copy.failed}
              pendingMessage={copy.saving}
              resetOnSuccess
              successMessage={copy.salesSaved}
            >
              <div className="field">
                <label>{copy.date}</label>
                <input
                  className="input"
                  defaultValue={today}
                  name="businessDate"
                  required
                  type="date"
                />
              </div>
              <div className="field">
                <label>{copy.branch}</label>
                <select className="select" name="branchId" required>
                  <option value="">{copy.select}</option>
                  {branches?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {locale === "ar" && branch.name_ar
                        ? branch.name_ar
                        : branch.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{copy.employee}</label>
                <select className="select" name="employeeId">
                  <option value="">{copy.branchTotal}</option>
                  {employees?.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_code} ·{" "}
                      {locale === "ar" && employee.name_ar
                        ? employee.name_ar
                        : employee.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{copy.amount}</label>
                <input
                  className="input"
                  min="0"
                  name="amount"
                  required
                  step="0.01"
                  type="number"
                />
              </div>
              <div className="field">
                <label>{copy.currency}</label>
                <input
                  className="input"
                  defaultValue="EGP"
                  maxLength={3}
                  name="currencyCode"
                  required
                />
              </div>
              <div className="field">
                <label>{copy.reference}</label>
                <input className="input" name="reference" />
              </div>
              <div className="field full">
                <label>{copy.notes}</label>
                <textarea className="textarea" name="notes" />
              </div>
              <button className="button full" type="submit">
                {copy.submit}
              </button>
            </ActionForm>
          </CreateDialog>
        ) : null}
      </div>
      <section className="stats-grid business-stats">
        <a className="stat-card" href="#sales-ledger">
          <span>{copy.approvedSales}</span>
          <strong>{money(approvedSales, currency, locale)}</strong>
          <small>{currency}</small>
        </a>
        <a className="stat-card" href="#sales-ledger">
          <span>{copy.pendingSales}</span>
          <strong>{pendingSales}</strong>
          <small>{copy.status}</small>
        </a>
        <a className="stat-card" href="#performance-targets">
          <span>{copy.activeTargets}</span>
          <strong>
            {targets?.filter((target) => target.is_active).length ?? 0}
          </strong>
          <small>{copy.targets}</small>
        </a>
        <a className="stat-card" href="#performance-targets">
          <span>{copy.approvedBonuses}</span>
          <strong>{money(approvedBonus, currency, locale)}</strong>
          <small>{copy.approveBonuses}</small>
        </a>
      </section>
      <section className="section-insight-grid" aria-label={copy.salesByBranch}>
        <InsightBars
          emptyLabel={copy.noSales}
          items={branchInsights}
          subtitle={copy.salesByBranchHelp}
          title={copy.salesByBranch}
        />
        <InsightBars
          emptyLabel={copy.noTargets}
          items={targetInsights}
          subtitle={copy.targetProgressHelp}
          title={copy.targetProgress}
        />
      </section>

      <section className="card stack section-gap" id="sales-ledger">
        <div className="section-title-row">
          <div>
            <h2>{copy.ledger}</h2>
            <p className="muted">{copy.subtitle}</p>
          </div>
          <span className="badge">{sales?.length ?? 0}</span>
        </div>
        <div className="sales-ledger">
          {sales?.map((entry) => {
            const branch = branchMap.get(entry.branch_id);
            const employee = entry.employee_id
              ? employeeMap.get(entry.employee_id)
              : null;
            return (
              <article className="sales-entry" key={entry.id}>
                <div className="sales-entry-main">
                  <span className="sales-date">{entry.business_date}</span>
                  <div>
                    <strong>
                      {employee
                        ? locale === "ar" && employee.name_ar
                          ? employee.name_ar
                          : employee.name_en
                        : copy.branchTotal}
                    </strong>
                    <small>
                      {branch
                        ? locale === "ar" && branch.name_ar
                          ? branch.name_ar
                          : branch.name_en
                        : copy.branch}{" "}
                      · {entry.reference ?? "—"}
                    </small>
                  </div>
                  <strong>
                    {money(entry.amount, entry.currency_code, locale)}
                  </strong>
                  <span className={`badge sales-status-${entry.status}`}>
                    {entry.status}
                  </span>
                </div>
                {entry.review_note ? (
                  <p className="business-note">{entry.review_note}</p>
                ) : null}
                {entry.status === "submitted" && canApprove ? (
                  <div className="sales-review-actions">
                    <ActionForm
                      action={reviewSalesEntry.bind(
                        null,
                        locale,
                        entry.id,
                        true,
                      )}
                      errorMessage={copy.failed}
                      pendingMessage={copy.saving}
                      successMessage={copy.approved}
                    >
                      <button className="button small-button" type="submit">
                        {copy.approve}
                      </button>
                    </ActionForm>
                    <ActionForm
                      action={reviewSalesEntry.bind(
                        null,
                        locale,
                        entry.id,
                        false,
                      )}
                      className="inline-form"
                      errorMessage={copy.failed}
                      pendingMessage={copy.saving}
                      successMessage={copy.rejected}
                    >
                      <input
                        className="input"
                        name="reviewNote"
                        placeholder={copy.reviewNote}
                        required
                      />
                      <button
                        className="button danger small-button"
                        type="submit"
                      >
                        {copy.reject}
                      </button>
                    </ActionForm>
                  </div>
                ) : null}
              </article>
            );
          })}
          {!sales?.length ? <div className="empty">{copy.noSales}</div> : null}
        </div>
      </section>

      {canManage ? (
        <section className="card stack section-gap">
          <div className="section-title-row">
            <div>
              <h2>{copy.policies}</h2>
              <p className="muted">{copy.subtitle}</p>
            </div>
            <div className="section-actions">
              <span className="badge">{policies?.length ?? 0}</span>
              <CreateDialog
                closeLabel={d.close}
                description={copy.subtitle}
                eyebrow={copy.policies}
                title={copy.newPolicy}
                triggerLabel={copy.newPolicy}
              >
                <ActionForm
                  action={createBonusPolicy.bind(null, locale, tenantId)}
                  className="form-grid business-form"
                  errorMessage={copy.failed}
                  pendingMessage={copy.saving}
                  resetOnSuccess
                  successMessage={copy.policyCreated}
                >
                  <div className="automatic-record-note full">
                    <span aria-hidden="true">⚡</span>
                    <div>
                      <strong>{targetLabels.automaticCode}</strong>
                      <small>
                        {locale === "ar"
                          ? "سيُنشأ كود سياسة المكافأة عند الحفظ."
                          : "The bonus policy code is generated when you save."}
                      </small>
                    </div>
                  </div>
                  <div className="field">
                    <label>{copy.name}</label>
                    <input className="input" name="nameEn" required />
                  </div>
                  <div className="field">
                    <label>{copy.nameAr}</label>
                    <input className="input" name="nameAr" />
                  </div>
                  <div className="field">
                    <label>{copy.basis}</label>
                    <select className="select" name="basis">
                      <option value="fixed_amount">{copy.fixed}</option>
                      <option value="salary_percentage">
                        {copy.salaryPct}
                      </option>
                      <option value="sales_percentage">{copy.salesPct}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{copy.tierOne}</label>
                    <input
                      className="input"
                      defaultValue="80"
                      min="0"
                      name="thresholdOne"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.valueOne}</label>
                    <input
                      className="input"
                      defaultValue="0"
                      min="0"
                      name="valueOne"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.tierTwo}</label>
                    <input
                      className="input"
                      defaultValue="100"
                      min="0"
                      name="thresholdTwo"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.valueTwo}</label>
                    <input
                      className="input"
                      defaultValue="1000"
                      min="0"
                      name="valueTwo"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.tierThree}</label>
                    <input
                      className="input"
                      defaultValue="120"
                      min="0"
                      name="thresholdThree"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.valueThree}</label>
                    <input
                      className="input"
                      defaultValue="1500"
                      min="0"
                      name="valueThree"
                      step="0.01"
                      type="number"
                    />
                  </div>
                  <div className="field">
                    <label>{copy.effective}</label>
                    <input
                      className="input"
                      defaultValue={monthStart}
                      name="effectiveFrom"
                      required
                      type="date"
                    />
                  </div>
                  <button className="button full" type="submit">
                    {copy.createPolicy}
                  </button>
                </ActionForm>
              </CreateDialog>
            </div>
          </div>
          <div className="policy-chip-list">
            {policies?.map((policy) => (
              <div className="policy-chip" key={policy.id}>
                <span>
                  <strong>
                    {locale === "ar" && policy.name_ar
                      ? policy.name_ar
                      : policy.name_en}
                  </strong>
                  <small>
                    {policy.code} · {policy.bonus_basis.replaceAll("_", " ")}
                  </small>
                </span>
                <div>
                  {(
                    policy.tiers as Array<{
                      min_percentage: number;
                      value: number;
                    }>
                  ).map((tier) => (
                    <span
                      className="badge"
                      key={`${tier.min_percentage}-${tier.value}`}
                    >
                      {tier.min_percentage}% → {tier.value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card stack section-gap" id="performance-targets">
        <div className="section-title-row">
          <div>
            <h2>{copy.targets}</h2>
            <p className="muted">{copy.subtitle}</p>
          </div>
          <div className="section-actions">
            <span className="badge">{targets?.length ?? 0}</span>
            {canManage && policies?.length ? (
              <CreateDialog
                closeLabel={d.close}
                description={copy.subtitle}
                eyebrow={copy.targets}
                title={copy.newTarget}
                triggerLabel={copy.newTarget}
              >
                <PerformanceTargetForm
                  action={createSalesTarget.bind(null, locale, tenantId)}
                  branches={(branches ?? []).map((branch) => ({
                    id: branch.id,
                    label:
                      locale === "ar" && branch.name_ar
                        ? branch.name_ar
                        : branch.name_en,
                  }))}
                  defaults={{
                    start: monthStart,
                    end: monthEnd,
                  }}
                  employees={(employees ?? []).map((employee) => ({
                    id: employee.id,
                    label: `${employee.employee_code} · ${locale === "ar" && employee.name_ar ? employee.name_ar : employee.name_en}`,
                  }))}
                  labels={targetLabels}
                  policies={(policies ?? [])
                    .filter((policy) => policy.is_active)
                    .map((policy) => ({
                      id: policy.id,
                      label: `${policy.code} · ${locale === "ar" && policy.name_ar ? policy.name_ar : policy.name_en}`,
                    }))}
                  teams={(teams ?? []).map((team) => ({
                    id: team.id,
                    label:
                      locale === "ar" && team.name_ar
                        ? team.name_ar
                        : team.name_en,
                  }))}
                />
              </CreateDialog>
            ) : null}
          </div>
        </div>
        <div className="target-grid">
          {targets?.map((target) => {
            const targetResults = resultsByTarget.get(target.id) ?? [];
            const first = targetResults[0];
            const achievement = Number(first?.achievement_percentage ?? 0);
            const bonusPool = targetResults.reduce(
              (sum, result) => sum + Number(result.bonus_amount),
              0,
            );
            const resultStatus = first?.status ?? "not_calculated";
            const scopeName =
              target.scope_type === "branch"
                ? branchMap.get(target.branch_id ?? "")
                : target.scope_type === "team"
                  ? teamMap.get(target.team_id ?? "")
                  : employeeMap.get(target.employee_id ?? "");
            const scopeLabel = scopeName
              ? locale === "ar" && "name_ar" in scopeName && scopeName.name_ar
                ? scopeName.name_ar
                : scopeName.name_en
              : target.scope_type;
            return (
              <article className="target-card" key={target.id}>
                <div className="target-card-head">
                  <span>
                    <strong>{target.name}</strong>
                    <small>
                      {target.code} · {target.period_start} →{" "}
                      {target.period_end}
                    </small>
                  </span>
                  <span className={`badge bonus-status-${resultStatus}`}>
                    {resultStatus.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="target-scope">
                  <span className="badge">{target.scope_type}</span>
                  <strong>{scopeLabel}</strong>
                </div>
                <div className="target-progress-label">
                  <span>{copy.achievement}</span>
                  <strong>{achievement.toFixed(1)}%</strong>
                </div>
                <div className="target-progress">
                  <span style={{ width: `${Math.min(100, achievement)}%` }} />
                </div>
                <div className="target-metrics">
                  <div>
                    <span>{copy.target}</span>
                    <strong>
                      {money(
                        target.target_amount,
                        target.currency_code,
                        locale,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{copy.actual}</span>
                    <strong>
                      {money(
                        (first?.calculation_snapshot
                          ?.scope_actual_sales as number) ??
                          first?.actual_sales ??
                          0,
                        target.currency_code,
                        locale,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{copy.bonusPool}</span>
                    <strong>
                      {money(bonusPool, target.currency_code, locale)}
                    </strong>
                  </div>
                </div>
                <div className="target-actions">
                  {canManage && !["approved", "paid"].includes(resultStatus) ? (
                    <ActionForm
                      action={calculateBonusTarget.bind(
                        null,
                        locale,
                        target.id,
                      )}
                      errorMessage={copy.failed}
                      pendingMessage={copy.saving}
                      successMessage={copy.calculated}
                    >
                      <button className="button secondary" type="submit">
                        {copy.calculate}
                      </button>
                    </ActionForm>
                  ) : null}
                  {canApproveBonuses && resultStatus === "calculated" ? (
                    <>
                      <ActionForm
                        action={reviewBonusTarget.bind(
                          null,
                          locale,
                          target.id,
                          true,
                        )}
                        errorMessage={copy.failed}
                        pendingMessage={copy.saving}
                        successMessage={copy.bonusesApproved}
                      >
                        <button className="button" type="submit">
                          {copy.approveBonuses}
                        </button>
                      </ActionForm>
                      <ActionForm
                        action={reviewBonusTarget.bind(
                          null,
                          locale,
                          target.id,
                          false,
                        )}
                        className="inline-form"
                        errorMessage={copy.failed}
                        pendingMessage={copy.saving}
                        successMessage={copy.bonusesRejected}
                      >
                        <input
                          className="input"
                          name="reviewNote"
                          placeholder={copy.reviewNote}
                          required
                        />
                        <button className="button danger" type="submit">
                          {copy.rejectBonuses}
                        </button>
                      </ActionForm>
                    </>
                  ) : null}
                </div>
                {targetResults.length ? (
                  <details className="bonus-result-list">
                    <summary>
                      {targetResults.length} {copy.employee.toLowerCase()}
                    </summary>
                    {targetResults.map((result) => {
                      const employee = employeeMap.get(result.employee_id);
                      return (
                        <div key={result.id}>
                          <span>
                            {employee
                              ? locale === "ar" && employee.name_ar
                                ? employee.name_ar
                                : employee.name_en
                              : copy.employee}
                          </span>
                          <strong>
                            {money(
                              result.bonus_amount,
                              target.currency_code,
                              locale,
                            )}
                          </strong>
                          <span
                            className={`badge bonus-status-${result.status}`}
                          >
                            {result.status}
                          </span>
                        </div>
                      );
                    })}
                  </details>
                ) : null}
              </article>
            );
          })}
          {!targets?.length ? (
            <div className="empty">{copy.noTargets}</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
