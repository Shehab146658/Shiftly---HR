# Architecture

## Runtime components

1. **Next.js admin portal** for owners, HR, payroll, accounting, branch managers, and team managers.
2. **Flutter employee application** for employee self-service and future mobile attendance.
3. **Managed Supabase** for PostgreSQL, Auth, Storage, Realtime, Edge Functions, and scheduled jobs.

## Tenancy model

Every company-owned business table contains `tenant_id`. Access is authorized through:

- `memberships`: links an authenticated user to a tenant.
- `roles`: tenant-specific and configurable roles.
- `membership_roles`: supports multiple roles per user.
- `role_permissions`: maps roles to stable permission keys.
- Row-Level Security: evaluates membership and permissions inside PostgreSQL.

No tenant identifier received from the browser or mobile client is trusted by itself; database policies verify it against the authenticated user.

## Identity lifecycle

- Supabase Auth owns credentials and sessions.
- An `auth.users` trigger creates the matching application profile.
- Tenant creation uses a security-definer RPC that creates the company, active owner membership, and owner-role assignment atomically.
- Two or three owners are represented as separate active memberships with `is_owner = true` and the owner role.

## Audit model

Core entities use database triggers to capture insert, update, and delete operations. Authenticated users can read audit entries only when they have `audit.read`; they cannot mutate the log.

## Operational collaboration

- Tasks use one parent record per occurrence and employee-level assignments so multi-person progress, submissions, decisions, and retries remain independently auditable.
- Recurring work retains a stable `series_id`; the next daily, weekly, or monthly occurrence is cloned only after the current occurrence is fully approved.
- Evidence and announcement files remain in private Storage buckets. Database metadata retains the tenant, submission or announcement, original filename, content type, and size.
- Announcement targeting is expanded into an immutable recipient ledger at publication time. Reading and acknowledgement are separate timestamps, which supports defensible compliance reporting.
- Notifications link task assignment/review and announcement publication back to their dedicated pages.
