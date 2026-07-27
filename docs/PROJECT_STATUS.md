# Shiftly HR Project Status

**Current milestone:** Milestone 2 — Employees and Weekly Scheduling
**Status:** Completed and automatically validated
**Release:** `0.2.0`
**Last updated:** 27 July 2026

## Completed

- Extended employee records with contact details, preferred language, status, manager, hire date, and notes.
- Automatic effective-dated assignment history for branch, team, manager, and position changes.
- Recoverable employee archival that preserves assignments, schedules, and audit history.
- Configurable branch operational-day start, maximum shift duration, week-start day, and default schedule visibility.
- Company-wide or branch-specific shift templates, including overnight shifts, breaks, and enforced branch-duration limits.
- Weekly schedules with configurable week start, split shifts, OFF days, leave, training, and assignments.
- Draft, publish, lock, reopen-with-reason, archive, and copy-week workflows.
- Immutable audit coverage for employee assignments and scheduling entities.
- Employee, team, branch, and company schedule visibility enforced through Row-Level Security.
- Manager schedule writes limited to the linked employee's current branch unless the role has company-wide access.
- Employee mobile view for published weekly schedules with configurable branch week-start support.
- Real branches, employees, shift templates, and the supplied 17–23 July 2026 schedules included in demo seed data.

## Validation gates

- Static repository checks: passed.
- Next.js lint, TypeScript, 4 unit tests, and production build: passed.
- Supabase migration reset and database lint: passed.
- Supabase pgTAP: 46 tests passed.
- Flutter 3.44 analysis: passed with no issues.
- Flutter tests: 2 passed.
- Production JavaScript dependency audit: passed after verified transitive security overrides.
- Manual acceptance scenarios in `docs/ACCEPTANCE_TESTS.md`.

## Known dependency

Fingerprint device integration remains deferred until the manufacturer, model, and integration method are confirmed.
