# Shiftly HR

Shiftly HR is a bilingual, multi-tenant HR SaaS platform for companies with multiple branches. The repository contains:

- `apps/admin-web`: Next.js owner, HR, payroll, accountant, and manager portal.
- `apps/employee-mobile`: Flutter employee application.
- `supabase`: PostgreSQL schema, Row-Level Security, migrations, seed data, and database tests.
- `packages/shared-contracts`: shared TypeScript domain contracts.
- `docs`: architecture, security, delivery status, and acceptance criteria.

## Milestone 2 — Employees and Weekly Scheduling

The current release adds:

- Full employee lifecycle fields, recoverable archival, and effective-dated assignment history.
- Configurable branch operational day, maximum shift duration, week-start day, and schedule visibility.
- Company-wide and branch-specific shift templates.
- Weekly schedules with split shifts, overnight shifts, OFF, leave, training, and assignments.
- Publish, lock, reasoned reopen, archive, and copy-week workflows.
- Employee mobile access to published current-week schedules for any configured branch week start.
- Database-enforced schedule visibility and branch-scoped manager writes.
- Real seed schedules for Gate Way, The One, Berry Rose, and Onovi for 17–23 July 2026.

## Milestone 3 — Attendance operations

The administration foundation now includes:

- Configurable branch grace periods, overtime threshold, mobile clock, selfie, and geofence policies.
- Audited manual check-in and check-out corrections.
- Automatic attendance-day calculations from published schedules.
- Split-shift and clocked-break punch pairing, lateness, early leave, overtime, missing time, and final balance.
- Pending location-evidence approval with mandatory rejection reasons.
- Date, employee, branch, and status report filters plus CSV export.
- A tenant-scoped fingerprint terminal registry with branch/timezone settings, active/paused/error states, and audited configuration.
- CSV, TXT, and XLSX device imports with automatic column detection, configurable check-in/out mappings, SHA-256 replay protection, punch de-duplication, and per-row reconciliation.

The employee web and native Flutter clients both provide GPS/selfie attendance capture against the same guarded ingestion function. The native app also exposes schedules, requests, published payslips, tasks, announcements, and personal notifications in Arabic and English. HR can test fingerprint ingestion with `supabase/demo/fingerprint-attendance-sample.csv`; automatic live synchronization remains dependent on the selected manufacturer, model, and API/database/SDK transport.

## Milestone 1 — Foundation

The foundation established:

- Multi-tenant company isolation.
- Supabase authentication and profile provisioning.
- Configurable role-based access control.
- Multiple company owners.
- Branch, team, and employee foundations.
- English and Arabic user interfaces with RTL support.
- Immutable audit logging.
- Next.js administration portal foundation.
- Flutter employee application foundation.
- GitHub Actions validation.

## Prerequisites

- Node.js 24 LTS.
- npm 10 or later.
- Flutter 3.44 or later.
- Docker Desktop or a Docker-compatible container runtime.
- A managed Supabase project for remote deployment.

## Local setup

### 1. Install JavaScript dependencies

```bash
npm install
```

### 2. Start Supabase locally

```bash
npm run supabase:start
npm run db:reset
```

Supabase prints the local API URL, publishable key, secret key, and Studio URL.

### 3. Configure the admin portal

```bash
cp apps/admin-web/.env.example apps/admin-web/.env.local
```

Set the local values printed by `supabase start`, then run:

```bash
npm run dev:web
```

Open `http://localhost:3000/en` or `http://localhost:3000/ar`.

### 4. Create local demo data

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in your shell. Use the local secret key printed by the CLI.

```bash
npm run seed:demo
```

Default local owner account:

- Email: `owner@shiftly.local`
- Password: `Shiftly!2026-Owner`

Change or delete this account outside local development.

### 5. Prepare and run the Flutter app

Android and iOS project folders are source-controlled with their required camera and foreground-location permission descriptions:

```bash
cd apps/employee-mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=http://127.0.0.1:54321 \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
```

For an Android emulator, use `http://10.0.2.2:54321` instead of `127.0.0.1`.

## Managed Supabase deployment

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Never commit database passwords, service-role keys, secret keys, signing secrets, or production environment files.

## Git workflow

Milestone 2 is maintained directly on `main`. Tag an accepted release as
`v0.2.0-employees-scheduling`.

See `docs/SETUP.md` for detailed instructions and `docs/ACCEPTANCE_TESTS.md` for the review checklist.
