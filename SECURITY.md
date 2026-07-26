# Security Policy

Report security issues privately to the repository owner. Do not create a public issue for suspected vulnerabilities.

## Sensitive values that must never be committed

- Supabase secret or service-role keys.
- Database passwords.
- JWT signing secrets.
- Email, WhatsApp, maps, or push-notification credentials.
- Real employee identity documents, medical records, selfies, salaries, or attendance exports.

## Baseline controls

- PostgreSQL Row-Level Security is mandatory for every tenant-owned table.
- Browser and mobile clients use publishable keys only.
- Privileged operations use narrowly scoped server functions.
- Audit records are append-only to application users.
- Tenant membership and permission checks are enforced in the database, not only in the UI.
