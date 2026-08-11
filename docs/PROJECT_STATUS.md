# Shiftly HR Project Status

**Current milestone:** Milestone 6 — Business modules
**Status:** Payroll, loans, sales, targets, and bonuses complete; tasks and announcements are next
**Release:** `0.3.0-preview`
**Last updated:** 11 August 2026

## Completed

- Extended employee records with contact details, preferred language, status, manager, hire date, and notes.
- Automatic effective-dated assignment history for branch, team, manager, and position changes.
- Recoverable employee archival that preserves assignments, schedules, and audit history.
- Configurable branch operational-day start, maximum shift duration, week-start day, and default schedule visibility.
- Company-wide or branch-specific shift templates, including overnight shifts, breaks, and enforced branch-duration limits.
- Weekly schedules with configurable week start, split shifts, OFF days, leave, training, and assignments.
- Employee-first schedule planner for assigning one or more people to selected days and exact hours.
- Automatic overnight detection, split-shift segment ordering, and overlap prevention.
- Draft, publish, lock, reopen-with-reason, archive, and copy-week workflows.
- Immutable audit coverage for employee assignments and scheduling entities.
- Employee, team, branch, and company schedule visibility enforced through Row-Level Security.
- Manager schedule writes limited to the linked employee's current branch unless the role has company-wide access.
- Employee mobile view for published weekly schedules with configurable branch week-start support.
- Real branches, employees, shift templates, and the supplied 17–23 July 2026 schedules included in demo seed data.
- Attendance evidence, calculated workdays, configurable grace periods, overtime thresholds, and missing-time balances.
- Audited manual punches, pending evidence approval/rejection, date and workforce filters, summary totals, and CSV export.
- Worked-time pairing for split shifts and clocked breaks instead of treating the day as one continuous span.
- Repeatable attendance preview data with realistic present, late, overtime, early-departure, incomplete, absent, OFF, and pending-geofence cases.
- Reusable request catalogue covering attendance permissions, corrections, branch exceptions, overtime, schedule changes, and general HR cases.
- Versioned approval workflows with manager, owner, HR, and custom-role routing plus any, all, and count-based approval rules.
- Bilingual request inbox, employee self-service submission, attachments, cancellations, detailed workflow history, and guarded review actions.
- In-app notifications for approval assignments, approvals, and rejections.
- Immutable active workflows so new policy versions never rewrite an in-flight request's approval path.
- Statutory and company leave types now use the same versioned workflow engine, with guarded manager, owner, HR, and custom-role approval steps.
- Leave administration includes policy configuration, holiday maintenance, secure documents, balance adjustments, and an auditable balance ledger.
- Leave requests expose their current workflow step, approval history, cancellation, and signed document access.
- Effective-dated monthly, daily, hourly, mixed, and commission compensation structures.
- Payroll policy snapshots with configurable day/hour standards, overtime, time, absence, currency, rounding, tax, and insurance switches.
- Payroll calculations from attendance and approved unpaid-leave inputs, including itemized automatic and manual components.
- Controlled calculation, review, approval, lock, and publication workflow with employee payslips and receipt acknowledgement.
- Employee self-service loan and advance requests with guarded approval, exact interest-free installment schedules, pause/resume, reasoned rescheduling, partial payments, early settlement, and complete statements.
- Loan installments automatically enter eligible payroll periods and become paid only when payroll is published.
- Daily branch and employee sales submission with manager review, rejection reasons, and tenant-secure reporting.
- Branch, team, and employee targets with fixed, salary-percentage, or employee-sales-percentage tiered bonus policies.
- Calculated incentive results retain their inputs and policy snapshot, require approval, enter payroll automatically, and link back to the publishing payroll period.

## Experience hardening

- Team membership is optional across employee creation, updates, and assignment history.
- Team choices respond to the selected branch and clear incompatible assignments automatically.
- Schedule managers can search the visible roster, include temporary staff from another branch, and assign several people or days at once.
- All active seed employees are assigned to team `001`, with their original branch assignments retained.
- Linked user and employee profiles include a clickable owner profile from the dashboard and navigation.
- Employee creation opens on demand, and the directory uses one responsive table.
- Long branch, team, and position labels expose their full value in contextual tooltips.
- Important administration actions show pending, success, and failure feedback.

## Validation gates

- Static repository checks: passed.
- Next.js lint, TypeScript, 33 unit tests, and production build: passed.
- Supabase migration reset and database lint: passed.
- Supabase pgTAP: 314 tests passed.
- Flutter sources were unchanged in this increment; the Flutter SDK is not installed in the current workstation environment, so analyzer and device tests remain an environment-dependent release check.
- Production JavaScript dependency audit: passed after verified transitive security overrides.
- Manual acceptance scenarios in `docs/ACCEPTANCE_TESTS.md`.

## Known dependency

Native mobile GPS/selfie capture and fingerprint device integration remain the next attendance delivery slices. Fingerprint synchronization also depends on the manufacturer, model, and integration method.
