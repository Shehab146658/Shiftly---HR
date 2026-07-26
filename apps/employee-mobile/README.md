# Shiftly Employee Mobile

Flutter source for the Shiftly HR employee application.

Generate platform folders once after cloning:

```bash
flutter create --platforms=android,ios --org com.shiftly.hr --project-name shiftly_employee .
flutter pub get
```

Run with managed or local Supabase:

```bash
flutter run \
  --dart-define=SUPABASE_URL=<url> \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Without dart-defines, the app starts in a safe demo mode so the bilingual foundation can be reviewed without credentials.
