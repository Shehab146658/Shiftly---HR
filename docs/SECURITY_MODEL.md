# Security Model

## Trust boundaries

- Browser and mobile input is untrusted.
- Tenant selection in URLs, forms, and API payloads is untrusted.
- Publishable Supabase keys are safe for clients only because RLS remains enabled.
- Secret/service-role keys are server-only and bypass RLS; they must never reach clients.

## RLS requirements

Every new tenant-owned table must:

1. Contain a non-null `tenant_id` foreign key.
2. Enable Row-Level Security in the same migration that creates the table.
3. Define explicit read and write policies using `is_tenant_member` or `has_permission`.
4. Include tests proving cross-tenant denial.

## Privileged functions

Security-definer functions set an empty search path and use fully qualified object names to reduce search-path manipulation risk.

## Schedule scope

Owners and HR roles with `schedules.read_all` can work across the tenant. Branch
and team managers do not receive that permission. Their user account must be
linked through `employees.user_id`; schedule mutations are then limited to the
linked employee's current branch. Schedule reads continue to honor the
schedule's `self`, `team`, `branch`, or `all` visibility.

## Audit integrity

Application roles receive read access through policy only. Insert, update, and delete privileges are revoked from authenticated and anonymous users. Audit triggers run with a security-definer function.
