# Shiftly HR Project Status

**Current milestone:** Milestone 2 — Employees and Weekly Scheduling
**Status:** Ready for validation
**Release:** `0.2.0`
**Last updated:** 26 July 2026

## Completed

- Extended employee records with contact details, preferred language, status, manager, hire date, and notes.
- Automatic effective-dated assignment history for branch, team, manager, and position changes.
- Configurable branch operational-day start, maximum shift duration, week-start day, and default schedule visibility.
- Company-wide or branch-specific shift templates, including overnight shifts and breaks.
- Weekly schedules with configurable week start, split shifts, OFF days, leave, training, and assignments.
- Draft, publish, lock, reopen-with-reason, archive, and copy-week workflows.
- Immutable audit coverage for employee assignments and scheduling entities.
- Employee, team, branch, and company schedule visibility enforced through Row-Level Security.
- Employee mobile view for published weekly schedules.
- Real branches, employees, shift templates, and the supplied 17–23 July 2026 schedules included in demo seed data.

## Validation gates

- Static repository checks.
- Next.js lint, TypeScript, tests, and production build.
- Supabase migration reset, database lint, and pgTAP tests.
- Flutter analysis and widget tests.
- Manual acceptance scenarios in `docs/ACCEPTANCE_TESTS.md`.

## Known dependency

Fingerprint device integration remains deferred until the manufacturer, model, and integration method are confirmed.
