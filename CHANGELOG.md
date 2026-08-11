# Changelog

## Unreleased

### Added

- Accessible reusable creation dialogs with keyboard focus management, Escape/backdrop closing, and phone-sized bottom sheets across core administration workflows.
- A 30-day people-operations pulse and management action queue on the home dashboard, with direct drill-down links to source workflows.
- A localized protected-route recovery experience with safe retry, dashboard fallback, and support references.
- A bilingual, permission-gated management reporting center spanning workforce, attendance, leave, requests, payroll, loans, sales targets, tasks, and announcement reach.
- Date and branch filtering, executive KPI drill-downs, attendance and sales trends, branch scorecards, an operational health index, a prioritized action center, and CSV exports.
- Reporting-specific read and export permissions for owners, HR, payroll, accounting, and scoped managers.
- A keyboard-accessible global search across authorized people, organization records, requests, payroll periods, schedules, tasks, and announcements.
- Permission-aware primary navigation that removes dead-end administration links while preserving employee payroll and payslip self-service.

- A tenant-scoped employee request catalogue for late arrival, early departure, hourly permission, attendance correction, branch exceptions, overtime, schedule changes, and general HR requests.
- Versioned, immutable approval workflows with manager, owner, HR, or custom-role steps and any-one, all, or count-based approval rules.
- A bilingual request inbox with filters, workflow history, review actions, cancellations, attachment support, and mobile-first request cards.
- A workflow administration screen that safely clones, edits, and activates new workflow versions without changing in-flight requests.
- An in-app notification center for approval assignments and employee decisions.
- Database Row-Level Security, guarded RPCs, storage policies, audit triggers, and pgTAP coverage for request operations.
- Versioned approval workflows for every statutory and company leave type, using the same manager, owner, HR, custom-role, any/all/count approval engine.
- A leave administration workspace for policy controls, secure supporting documents, public holidays, employee balance adjustments, and an immutable transaction ledger.
- Leave request cancellation, signed document access, descriptive approval history, step-aware review responsibility, and employee notifications.
- Effective-dated employee compensation for monthly, daily, hourly, mixed, and commission salary arrangements.
- Auditable payroll periods that snapshot policy, attendance, leave, overtime, absence, additions, deductions, and net pay.
- Controlled payroll calculation, review, approval, lock, and payslip-publication stages with descriptive status history.
- Manual reasoned earnings and deductions, printable bilingual payslips, and employee receipt acknowledgement.
- Employee loan and salary-advance requests with approval, interest-free installment generation, pause/resume, rescheduling, partial payments, early settlement, and payroll deductions.
- A mobile-responsive loan statement with progress, installment status, original and revised due dates, and an immutable payment ledger.
- Daily branch and employee sales submission with review gates and rejection reasons.
- Branch, team, and individual targets backed by reusable tiered bonus policies using fixed, salary-percentage, or employee-sales-percentage payouts.
- Auditable bonus calculation and approval results that flow into payroll and become paid only at payroll publication.
- Repeatable preview data for an active loan, installment history, approved/pending sales, a branch target, and calculated incentive results.
- Persistent employee access-role assignment with pending-account support, membership synchronization, RLS, audit logging, and tests.
- Tenant-member profile pages with clickable owner and employee identities.
- Reusable save, update, archive, publish, and assignment feedback with pending, success, and failure states.
- A guarded bulk action that assigns every active employee to a selected company-wide team while preserving branch history.
- Contextual overflow tooltips for long names and assignment labels.

### Changed

- Kept profile and sign-out controls reachable while the expanded sidebar navigation scrolls independently on desktop and mobile.
- Upgraded Next.js to 16.3.0, aligned ESLint with the supported v9 release, and refreshed patched PostCSS, Nano ID, and Sharp dependency overrides.
- Moved core add/create forms out of always-visible page content and into explicit action-driven dialogs.
- Replaced the stacked mobile sidebar with an accessible burger-menu drawer.
- Added mobile-first employee and role views with a single responsive employee table.
- Reworked employee creation into an on-demand modal and mobile bottom sheet.
- Replaced the text-only product label and navigation markers with a linked Shiftly brand lockup and purpose-built icons.
- Made the signed-in account, dashboard owner count, employee names, and role assignments open their relevant profiles.
- Improved roles and audit presentation so permissions and people are easier to understand.
- Refined dashboard, cards, tables, forms, mobile spacing, and action states across the administration portal.

## [0.2.0-employees-scheduling] - 2026-07-26

### Added

- Effective-dated employee branch, team, manager, and position history.
- Recoverable employee archival with assignment-history closure and reactivation support.
- Extended employee contact, language, lifecycle, and management fields.
- Configurable branch operational day, maximum shift duration, week start, and schedule visibility.
- Company-wide and branch-scoped shift templates with overnight support.
- Weekly schedule planner with split shifts and non-working entry types.
- Publish, lock, reasoned reopen, archive, and copy-week controls.
- Schedule Row-Level Security for employee, team, branch, and company visibility.
- Branch-scoped schedule writes for linked manager accounts.
- Employee mobile current-week schedule view for configurable week-start days.
- Database enforcement of maximum shift duration and break-length rules.
- Patched PostCSS and Sharp transitive versions verified against the production web build.
- Explicit authenticated and service-role API grants layered under Row-Level Security.
- Real 17–23 July 2026 schedule seed data.

## [0.1.0-foundation] - 2026-07-26

### Added

- Next.js 16 bilingual administration portal foundation.
- Flutter 3.44 bilingual employee application foundation.
- Managed Supabase-compatible local development configuration.
- Multi-tenant schema with memberships and multiple owners.
- Configurable roles and permission keys.
- Branch, team, and employee data structures.
- Tenant-scoped Row-Level Security policies.
- Append-only audit logging.
- Real branch and employee seed data from the supplied schedules.
- GitHub Actions and milestone documentation.
