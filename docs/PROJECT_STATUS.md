# Shiftly HR Project Status

**Current milestone:** Milestone 3 — Attendance
**Status:** In progress after scheduling experience hardening
**Release:** `0.2.0`
**Last updated:** 10 August 2026

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
- Next.js lint, TypeScript, 23 unit tests, and production build: passed.
- Supabase migration reset and database lint: passed.
- Supabase pgTAP: 131 tests passed.
- Flutter sources were unchanged in this increment; the Flutter SDK is not installed in the current workstation environment, so analyzer and device tests remain an environment-dependent release check.
- Production JavaScript dependency audit: passed after verified transitive security overrides.
- Manual acceptance scenarios in `docs/ACCEPTANCE_TESTS.md`.

## Known dependency

Native mobile GPS/selfie capture and fingerprint device integration remain the next attendance delivery slices. Fingerprint synchronization also depends on the manufacturer, model, and integration method.
