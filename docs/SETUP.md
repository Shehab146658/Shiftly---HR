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

## Admin portal

```powershell
npm run dev:web
```

## Mobile app

```powershell
cd apps/employee-mobile
flutter create --platforms=android,ios --org com.shiftly.hr --project-name shiftly_employee .
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
