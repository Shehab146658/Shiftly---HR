# Shiftly HR Employee Mobile

Flutter employee application for Android and iOS.

## Milestone 2

- English and Arabic interface.
- Supabase authentication.
- Employee dashboard foundation.
- Current-week published schedule view.
- Split and overnight shift display.
- OFF, leave, training, and assignment labels.
- Row-Level Security determines which schedule entries the signed-in employee may read.

Generate the platform folders and run:

```bash
flutter create --platforms=android,ios --org com.shiftly.hr --project-name shiftly_employee .
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=<managed-or-local-url> \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The authenticated Supabase user must be linked through `employees.user_id` to display a personal schedule.
