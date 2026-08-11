# Shiftly HR Milestones

| Milestone | Scope | Status |
|---|---|---|
| 1. Foundation | Multi-tenancy, authentication, RBAC, branches, teams, baseline employees, audit | Completed |
| 2. Employees & Scheduling | Employee lifecycle, assignment history, shift templates, weekly schedules, mobile schedule | Completed |
| 3. Attendance | GPS, selfie, geofence, clock-in/out, overnight-day calculations, reports | In progress |
| 4. Requests & Leave | Request catalogue, leave balances, attachments, configurable approvals | In progress — reusable request engine delivered |
| 5. Payroll | Salary rules, attendance deductions, overtime, payroll runs, payslips | Planned |
| 6. Business Modules | Sales, targets, bonuses, loans, tasks, announcements | Planned |
| 7. Production Hardening | Security, performance, deployment, UAT, operational documentation | Planned |

## Milestone 2 release gate

Milestone 2 is accepted when:

1. All automated checks pass.
2. A manager can create shift templates and a branch weekly schedule.
3. Split and overnight shifts are represented correctly.
4. Publishing prevents normal edits.
5. Reopening requires permission and an audit reason.
6. Employees can only see schedules allowed by the configured visibility.
7. The employee mobile app displays the linked employee's published current-week schedule for any configured branch week start.
8. The web portal uses a mobile navigation drawer and touch-friendly employee views.
9. Authorized users can assign employee access roles before or after a login account is linked; changes are audited and synchronized to membership permissions.
10. Employee archival is recoverable and retains schedule and assignment history.
11. Branch and team managers cannot bypass configured schedule visibility with company-wide read access.
12. Team membership is optional and does not prevent employee scheduling.
13. Managers can select employees and days, then assign exact, overnight, split, or template-based working hours.
