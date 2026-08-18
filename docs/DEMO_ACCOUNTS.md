# Shiftly HR demo accounts

These accounts are created by `npm run seed:demo` inside the isolated
`shiftly-demo` tenant. They are intended only for local development, product
demos, and client feedback environments that contain no production HR data.

| Experience | Email | Password | Access demonstrated |
|---|---|---|---|
| Company owner | `owner@shiftly.local` | `Shiftly!2026-Owner` | Complete company configuration and approvals |
| HR administrator | `hr@shiftly.local` | `Shiftly!2026-HR` | Employees, attendance, leave, requests, and policies |
| Payroll officer | `payroll@shiftly.local` | `Shiftly!2026-Payroll` | Payroll calculation, adjustments, loans, and reports |
| Accountant | `accountant@shiftly.local` | `Shiftly!2026-Accountant` | Financial review, payroll visibility, and approvals |
| Branch manager | `branch.manager@shiftly.local` | `Shiftly!2026-Branch` | Gate Way branch employees, schedules, attendance, and approvals |
| Team manager | `team.manager@shiftly.local` | `Shiftly!2026-Team` | Team 001 employees, tasks, schedules, and approvals |
| Employee | `employee@shiftly.local` | `Shiftly!2026-Employee` | Personal clock, schedule, requests, payslips, tasks, and announcements |

The seed is repeatable. Running it again restores these demo passwords and
repairs the matching membership, role, employee, branch, and Team 001 links.
Every password and email can be overridden with the corresponding
`SHIFTLY_DEMO_*` environment variable in `scripts/seed-demo.mjs`.

## Role authorization

Each account receives only the permissions attached to its assigned role, so
the sidebar and management controls automatically hide ineligible areas. The
`roles.manage` capability controls who may assign employee roles or edit role
permissions. It belongs only to the company owner by default; an owner can
explicitly delegate it from **Roles & permissions** when another trusted role
administrator is required. The protected `owner` role is never offered as an
employee role.

Do not run the demo seed against a tenant containing real employee data. Do
not reuse these public credentials for a production deployment.
