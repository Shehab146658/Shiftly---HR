# Detailed Setup

## Windows prerequisites

- Install Node.js 24 LTS.
- Install Flutter stable 3.44 or later and Android Studio.
- Install Docker Desktop.
- Install Git.

## Clone and install

```powershell
git clone https://github.com/Shehab146658/Shiftly---HR.git
cd Shiftly---HR
npm install
```

## Local Supabase

```powershell
npx supabase start
npx supabase db reset
```

Copy the printed API URL and publishable key into `apps/admin-web/.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Create demo records using the local secret key printed by Supabase:

```powershell
$env:SUPABASE_URL="http://127.0.0.1:54321"
$env:SUPABASE_SECRET_KEY="<local-secret-key>"
npm run seed:demo
```

For realistic attendance examples, run
[`supabase/demo/seed_attendance_preview.sql`](../supabase/demo/seed_attendance_preview.sql)
in Supabase Studio after creating the demo tenant. The repeatable dataset includes
on-time, late, overtime, early departure, incomplete, absent, OFF, and
pending-review cases without replacing non-demo schedules or punches.

For payroll demonstrations, run
[`supabase/demo/seed_payroll_preview.sql`](../supabase/demo/seed_payroll_preview.sql)
after the demo tenant exists. It adds anonymized sample compensation only for employees who do not already have compensation and never overwrites real payroll data.

The demo seed also registers `FP-DEMO-01`, a non-physical fingerprint import terminal for Gate Way. Open **Attendance → Fingerprint devices & imports** and upload [`supabase/demo/fingerprint-attendance-sample.csv`](../supabase/demo/fingerprint-attendance-sample.csv). Automatic mapping recognizes `PIN`, `Punch Time`, `State`, `Log ID`, and `Branch`; one deliberately unknown employee remains in the reconciliation queue to demonstrate safe partial imports.

For employee-finance and sales demonstrations, run
[`supabase/demo/seed_business_preview.sql`](../supabase/demo/seed_business_preview.sql)
after the demo tenant and payroll compensation exist. It adds one clearly marked interest-free loan statement, approved and pending sales, a tiered incentive policy, a branch target, and calculated bonus results without changing user-created records.

## Admin portal

```powershell
npm run dev:web
```

## Mobile app

```powershell
cd apps/employee-mobile
flutter pub get
flutter run --dart-define=SUPABASE_URL=http://10.0.2.2:54321 --dart-define=SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Use `127.0.0.1` for iOS Simulator and `10.0.2.2` for the standard Android emulator.

## Managed Supabase

Create a development project in the Supabase dashboard. Then:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Add the managed project URL and publishable key to the selected web hosting platform. Do not add the service-role or secret key to `NEXT_PUBLIC_*` variables.
