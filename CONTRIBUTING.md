# Contributing

## Branching

- `main`: accepted production-ready milestones.
- `milestone/*`: milestone integration branches.
- `feature/*`: focused feature branches.
- `fix/*`: defect corrections.

## Commit format

Use Conventional Commits, for example:

- `feat(attendance): add branch geofence policy`
- `fix(auth): prevent inactive membership access`
- `docs(setup): clarify managed Supabase deployment`

## Required checks

Before opening a pull request:

```bash
npm run check:static
npm run check:web
npm run db:lint
npm run db:test
```

For Flutter:

```bash
cd apps/employee-mobile
flutter analyze
flutter test
```

## Security

Do not include credentials, production data, employee salary data, identity documents, selfies, medical certificates, or service-role keys in issues, commits, screenshots, or pull requests.
