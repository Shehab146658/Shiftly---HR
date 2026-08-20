# Shiftly HR Project Status

**Current milestone:** Milestone 7 — Product hardening and employee self-service
**Status:** Feature-complete business operations; client-feedback workflow refinements and UAT are in validation
**Release:** `0.4.0-preview`
**Last updated:** 20 August 2026

## Completed

- Extended employee records with contact details, preferred language, status, manager, hire date, and notes.
- Automatic effective-dated assignment history for branch, team, manager, and position changes.
- Recoverable employee archival that preserves assignments, schedules, and audit history.
- Configurable branch operational-day start, maximum shift duration, week-start day, and default schedule visibility.
- Company-wide or branch-specific shift templates, including overnight shifts, breaks, and enforced branch-duration limits.
- Weekly schedules with configurable week start, split shifts, OFF days, leave, training, and assignments.
- Direct schedule-cell assignment for choosing a person, workday, predefined/custom shift, or split segment in place.
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
- Operational tasks support selected employees, teams, branches, or the entire company, with priority, start/due times, evidence requirements, and mobile-friendly delivery boards.
- Employee task execution includes start, completion notes, up to five protected evidence files, submission history, reviewer approval or requested changes, comments, and notifications.
- Daily, weekly, and monthly recurrence automatically creates the next occurrence only after every assignee's work is approved, preserving the series history.
- Task visibility and approval responsibility follow personal, direct-report, team-manager, branch-manager, HR, and owner scope through Row-Level Security.
- Bilingual announcements support drafts, publish/archive gates, company/branch/team/employee/role targeting, priorities, pinning, expiry, protected attachments, and notification delivery.
- Announcement readership records delivery, reading, and mandatory acknowledgement separately, with audience analytics for authorized managers.
- A permission-gated management reporting center combines workforce, attendance, leave, payroll, sales, targets, loans, tasks, and announcement reach in one drill-down workspace.
- Executive metrics, operating trends, branch scorecards, risk queues, date and branch filters, and bilingual CSV exports provide a decision-ready owner and HR view.
- Global search spans tenant-authorized people, organization records, requests, payroll, schedules, tasks, and communications, with a `/` keyboard shortcut.
- Primary navigation and direct-route entry now follow effective role permissions; the built-in employee role is limited to personal self-service while custom roles remain owner-configurable.
- The main dashboard adds a 30-day people-operations pulse and live action queue that drill into attendance, leave, requests, tasks, and sales.
- Employee self-service attendance now requires an explicit high-accuracy location grant and captures evidence through the front camera directly; database validation rejects location-free mobile punches and keeps private selfie evidence tenant-scoped.
- The installable Flutter client now mirrors the core employee workspace with bilingual/RTL navigation, published schedules, native front-camera and precise-location attendance, recent punch evidence, personal notifications, request history, published payslips with receipt acknowledgement, task start actions, and announcement read/acknowledgement controls.
- Android and iOS projects are source-controlled with production camera/location permission descriptions, and CI now compiles an Android debug artifact in addition to Flutter analysis and widget tests.
- Fingerprint attendance includes an audited device registry, branch and timezone controls, active/paused/error states, CSV/TXT/XLSX parsing, automatic and manual column mapping, configurable device states, SHA-256 replay protection, duplicate reconciliation, and per-row error history.

## Experience hardening

- Company records now generate readable codes automatically; employee creation defaults to Active and can optionally include starting compensation.
- Employees can have several reporting managers, and all active managers participate in manager-routed HR and leave approvals.
- Teams support selective searchable membership rather than an all-employees-only bulk action.
- The weekly schedule board is the editor: click an employee/day cell to choose a predefined shift, custom hours, OFF/leave/training, or append a split segment.
- The desktop sidebar is denser and collapsible with a saved preference; the phone header always reserves a tappable global-search control.
- Clock-in/out requests fresh precise location at submission and opens the camera when required instead of leaving the action silently disabled.
- Payroll includes a visual explanation of calculation, review, approval, and payslip publication.
- Mobile global search now opens as a focused overlay instead of competing with notification, language, and navigation controls in the top bar.
- Every workspace exposes concise bilingual guidance explaining the screen's purpose and the most useful actions available there.
- The demo bootstrap creates and verifies owner, HR, payroll, accountant, branch-manager, team-manager, and employee logins with the correct employee and organization scope.
- Team membership is optional across employee creation, updates, and assignment history.
- Team choices respond to the selected branch and clear incompatible assignments automatically.
- Schedule managers can search the visible roster, include temporary staff from another branch, and assign several people or days at once.
- All active seed employees are assigned to team `001`, with their original branch assignments retained.
- Linked user and employee profiles include a clickable owner profile from the dashboard and navigation.
- Employee creation opens on demand, and the directory uses one responsive table.
- Long branch, team, and position labels expose their full value in contextual tooltips.
- Important administration actions show pending, success, and failure feedback.
- Core creation forms open only after an explicit action and use reusable accessible dialogs with keyboard focus control and mobile bottom-sheet presentation.
- Bonus policies, targets, loan payments, payroll adjustments, workflow cloning, and approval-step creation now follow the same on-demand dialog pattern.
- The enlarged navigation scrolls independently while account and sign-out actions remain reachable at normal zoom.
- Unexpected route failures provide a localized retry and dashboard recovery experience.

## Validation gates

- Static repository checks: passed.
- Next.js lint, TypeScript, unit tests, and production build: passed.
- Supabase migration reset and database lint: passed.
- Supabase pgTAP includes reporting permissions, role boundaries, private mobile-attendance evidence, fingerprint idempotency, device lineage, timezone conversion, and reconciliation coverage.
- Flutter 3.44 analysis and widget tests pass locally. CI additionally compiles the Android debug application; physical-device camera/location acceptance and signed store artifacts remain launch gates.
- Production JavaScript dependency audit: passed after verified transitive security overrides.
- Manual acceptance scenarios in `docs/ACCEPTANCE_TESTS.md`.

## Known dependency

Automatic fingerprint polling/synchronization depends on the manufacturer, model, transport, and API/database/SDK documentation; secured CSV/XLSX import is complete. Native store signing, push-provider credentials, and physical-device camera/location acceptance remain environment-dependent launch gates.
