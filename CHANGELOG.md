# Changelog

## Unreleased

### Added

- Persistent employee access-role assignment with pending-account support, membership synchronization, RLS, audit logging, and tests.

### Changed

- Replaced the stacked mobile sidebar with an accessible burger-menu drawer.
- Added mobile-first employee and role views.

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
