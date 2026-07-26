# Milestone 1 Acceptance Tests

## Automated checks

```bash
npm install
npm run check:static
npm run supabase:start
npm run db:reset
npm run db:lint
npm run db:test
npm run seed:demo
npm run check:web
bash scripts/bootstrap-mobile.sh
```

## Manual acceptance

1. Open `/en/login`, sign in with the local demo owner, and reach the dashboard.
2. Switch to Arabic and confirm the application interface becomes right-to-left.
3. Confirm the dashboard shows four branches and twelve seeded employees.
4. Create a new branch and verify it appears immediately.
5. Create a team linked to a branch.
6. Create an employee linked to a branch and team.
7. Confirm the default tenant roles and permission badges appear.
8. Confirm branch, team, and employee creation events appear in the audit log.
9. Create a second tenant and user, then verify the user cannot read the first tenant's records.
10. Run the Flutter app in demo mode, then with Supabase credentials; confirm login and sign-out work.

## Acceptance response

Use one of:

- `Milestone 1 accepted`
- `Milestone 1 accepted with notes: ...`
- `Milestone 1 changes required: ...`
