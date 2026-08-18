import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("employee financial services cover request through payroll settlement", () => {
  const migration = readFileSync("../../supabase/migrations/202608110017_financial_services_and_performance.sql", "utf8");
  const loans = readFileSync("src/app/[locale]/(protected)/loans/page.tsx", "utf8");
  const statement = readFileSync("src/app/[locale]/(protected)/loans/[loanId]/page.tsx", "utf8");
  assert.match(migration, /create table public\.loan_requests/);
  assert.match(migration, /create table public\.loan_installments/);
  assert.match(migration, /review_loan_request/);
  assert.match(migration, /record_loan_payment/);
  assert.match(migration, /reschedule_loan_installment/);
  assert.match(migration, /source_type in \('loan','bonus'\)/);
  assert.match(loans, /submitLoanRequest/);
  assert.match(loans, /reviewLoanRequest/);
  assert.match(statement, /recordLoanPayment/);
  assert.match(statement, /rescheduleLoanInstallment/);
});

test("performance management supports approved sales scoped targets and tiered bonuses", () => {
  const migration = readFileSync("../../supabase/migrations/202608110017_financial_services_and_performance.sql", "utf8");
  const page = readFileSync("src/app/[locale]/(protected)/performance/page.tsx", "utf8");
  const planner = readFileSync("src/components/performance-target-form.tsx", "utf8");
  assert.match(migration, /create table public\.sales_entries/);
  assert.match(migration, /performance_scope as enum \('branch', 'team', 'employee'\)/);
  assert.match(migration, /bonus_basis as enum \('fixed_amount', 'salary_percentage', 'sales_percentage'\)/);
  assert.match(migration, /calculate_bonus_target/);
  assert.match(migration, /review_bonus_target/);
  assert.match(page, /recordSalesEntry/);
  assert.match(page, /reviewSalesEntry/);
  assert.match(page, /PerformanceTargetForm/);
  assert.match(planner, /scope === "branch"/);
});

test("business modules are localized responsive and visible in primary navigation", () => {
  const shell = readFileSync("src/components/app-shell.tsx", "utf8");
  const icons = readFileSync("src/components/brand-mark.tsx", "utf8");
  const styles = readFileSync("src/app/globals.css", "utf8");
  assert.match(shell, /\["loans", d\.loans, "loans", "loans\.read"\]/);
  assert.match(shell, /\["performance", d\.performance, "performance", "sales\.read"\]/);
  assert.match(icons, /performance:/);
  assert.match(styles, /\.target-grid/);
  assert.match(styles, /\.installment-card/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.business-form/);
});

test("sales payroll and loans expose responsive decision-support charts", () => {
  const performance = readFileSync("src/app/[locale]/(protected)/performance/page.tsx", "utf8");
  const payroll = readFileSync("src/app/[locale]/(protected)/payroll/page.tsx", "utf8");
  const loans = readFileSync("src/app/[locale]/(protected)/loans/page.tsx", "utf8");
  const insightBars = readFileSync("src/components/insight-bars.tsx", "utf8");
  const styles = readFileSync("src/app/globals.css", "utf8");

  assert.match(performance, /salesByBranch/);
  assert.match(performance, /targetProgress/);
  assert.match(payroll, /payrollTrend/);
  assert.match(payroll, /costMix/);
  assert.match(loans, /portfolioHelp/);
  assert.match(loans, /exposureHelp/);
  assert.match(insightBars, /insight-bar-track/);
  assert.match(styles, /\.section-insight-grid/);
  assert.match(styles, /@media \(max-width: 1000px\)[\s\S]*\.section-insight-grid \{ grid-template-columns: 1fr; \}/);
});
