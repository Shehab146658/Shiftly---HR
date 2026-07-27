# Acceptance Tests

## Milestone 1 regression

- [ ] Owner can sign in and access one tenant only.
- [ ] A second tenant cannot read the first tenant's branches, employees, or audit records.
- [ ] Arabic navigation renders right-to-left.
- [ ] Owner, HR, payroll, accountant, manager, and employee roles are available.

## Employee lifecycle

- [ ] HR can create an employee with branch, team, manager, contact details, hire date, language, and status.
- [ ] Employee search filters by text, branch, team, and status.
- [ ] HR can edit an employee.
- [ ] HR can archive an employee without deleting historical schedule or audit data.
- [ ] HR can reactivate an archived employee.
- [ ] Changing branch, team, manager, or position closes the previous assignment and creates a current assignment record.
- [ ] Multiple assignment changes on the same day remain separate history records.
- [ ] Assignment history is ordered newest first and remains auditable.
- [ ] A team, branch, or manager from another tenant is rejected by the database.

## Branch scheduling configuration

- [ ] Each branch can configure its operational-day start.
- [ ] Each branch can configure maximum shift hours.
- [ ] Each branch can configure any weekday as the schedule week start.
- [ ] Each branch can configure default employee, team, branch, or company visibility.

## Shift templates

- [ ] HR can create a company-wide shift.
- [ ] HR can create a branch-specific shift.
- [ ] Overnight shifts require the next-day flag.
- [ ] A same-day shift with end time before start time is rejected.
- [ ] A shift longer than the branch maximum is rejected.
- [ ] Break duration cannot equal or exceed shift duration.
- [ ] Shift templates can be activated and deactivated.

## Weekly schedules

- [ ] Manager can create a schedule only on the configured branch week-start day.
- [ ] Manager can add a shift using a template.
- [ ] Manager can add a custom shift using start and end times.
- [ ] Manager can add OFF, leave, training, and assignment entries.
- [ ] Multiple segments can be created for the same employee and day.
- [ ] Entries outside the seven-day schedule range are rejected.
- [ ] A schedule can be copied to another valid week.
- [ ] An empty schedule cannot be published.
- [ ] Published schedules cannot be edited.
- [ ] Published schedules can be locked.
- [ ] Reopening a published or locked schedule requires `schedules.unlock` and a reason of at least five characters.
- [ ] Status transitions are recorded.

## Employee visibility and mobile

- [ ] `self` visibility exposes only the linked employee's entries.
- [ ] `team` visibility exposes colleagues in the same team.
- [ ] `branch` visibility exposes employees scheduled in the same branch.
- [ ] `all` visibility exposes all tenant schedule entries.
- [ ] HR/owners with `schedules.read_all` can see all schedules.
- [ ] Branch and team managers do not receive `schedules.read_all`.
- [ ] A manager account linked to an employee can manage schedules only in that employee's current branch.
- [ ] Mobile app shows only published or locked entries for the current week.
- [ ] Mobile schedule lookup follows each branch's configurable week-start day instead of assuming Monday.
- [ ] Mobile app handles an unlinked employee account without crashing.

## Seed-data confirmation

- [ ] Gate Way, The One, Berry Rose, and Onovi exist.
- [ ] Real employee names from the supplied images exist.
- [ ] The 17–23 July 2026 weekly schedules match the supplied images.
