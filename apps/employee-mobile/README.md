# Shiftly HR Employee Mobile

Installable Flutter employee application for Android and iOS, with a responsive preview-compatible Flutter surface.

## Current employee workspace

- Arabic and English with native RTL layout.
- Supabase authentication and database-enforced tenant access.
- Published weekly schedules, including split and overnight shifts, OFF days, leave, training, and assignments.
- Mobile attendance with front-camera selfie evidence, precise location permission handling, branch geofence validation, pending-review feedback, and recent punch history.
- Personal approval-request history.
- Published payslips with employee receipt acknowledgement.
- Assigned tasks with guarded start actions and status tracking.
- Targeted announcements with read and mandatory acknowledgement actions.
- Personal in-app notification inbox with unread state and bulk acknowledgement.
- Polished employee dashboard with touch-friendly cards, loading/error/empty states, pull-to-refresh, and action feedback.

Android and iOS project folders are source-controlled so permissions, application identifiers, and release settings remain reviewable. Android declares internet, front-camera, and foreground location access. iOS includes clear camera, location, and photo-library usage descriptions.

## Run locally

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=<managed-or-local-url> \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Use `http://10.0.2.2:54321` for an Android emulator connected to local Supabase and `http://127.0.0.1:54321` for the iOS Simulator.

The signed-in Supabase user must be linked through `employees.user_id`. Row-Level Security remains authoritative for every schedule, punch, request, payslip, task, announcement, and notification query.

## Release validation

```bash
flutter analyze
flutter test
flutter build apk --debug \
  --dart-define=SUPABASE_URL=https://example.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_example_for_build_only_1234567890
```

CI performs all three checks. Store signing keys, production publishable configuration, Firebase files, and store credentials in the selected CI secret manager; never commit them.
