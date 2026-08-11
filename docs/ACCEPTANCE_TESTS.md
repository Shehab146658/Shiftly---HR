# Acceptance Tests

## Administration experience hardening

- [ ] Selecting **Add employee** opens the creation dialog; the form is not shown before that action.
- [ ] The employee directory has one responsive list, without duplicate cards beneath it.
- [ ] The Shiftly brand and signed-in account both open their relevant pages.
- [ ] The dashboard owner card opens the owner profile.
- [ ] Long branch, team, and position labels expose their complete value in a tooltip.
- [ ] Team `001` contains every active employee while existing branch assignments remain unchanged.
- [ ] Saving or updating important records displays a pending state followed by a success or failure message.
- [ ] The employee directory and creation dialog remain usable at a 390px mobile viewport.

## Milestone 1 regression

- [ ] Owner can sign in and access one tenant only.
- [ ] A second tenant cannot read the first tenant's branches, employees, or audit records.
- [ ] Arabic navigation renders right-to-left.
- [ ] Owner, HR, payroll, accountant, manager, and employee roles are available.

## Employee lifecycle

- [ ] HR can create an employee with branch, optional team, manager, contact details, hire date, language, and status.
- [ ] HR can leave the team empty without blocking employee creation or scheduling.
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
- [ ] Manager can search the employee roster and select one or more people before choosing dates and working hours.
- [ ] Manager can assign the same shift to multiple selected weekdays in one operation.
- [ ] Temporary staff from another branch can be selected without changing their permanent branch assignment.
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
- [ ] Overlapping same-day or cross-midnight shifts are rejected transactionally.

## Attendance operations

- [ ] Publishing a schedule creates a calculated attendance day for every scheduled employee.
- [ ] Authorized users can add audited manual check-in and check-out corrections.
- [ ] Branch rules configure late grace, early-departure grace, overtime threshold, mobile clock, selfie requirement, and geofence.
- [ ] Complete punch pairs calculate worked time correctly for split shifts and clocked breaks.
- [ ] Pending mobile or geofence evidence is excluded until a manager approves it.
- [ ] Rejected attendance evidence requires a review reason.
- [ ] Attendance reports filter by date, employee, branch, and status and export the visible rows to CSV.
- [ ] Report totals show lateness, overtime, missing time, and final time balance.

## Requests and approval workflows

- [ ] Employee can submit late-arrival, early-departure, hourly-permission, attendance-correction, branch-exception, overtime, schedule-change, and general HR requests.
- [ ] Request forms show the operational fields required by the selected request type.
- [ ] Required reasons and attachments are enforced in the database as well as the interface.
- [ ] A request without a linked manager skips the unresolvable manager step and reaches the next valid approver.
- [ ] Only people resolved by the active workflow step can approve or reject a request.
- [ ] Rejection requires a reason and notifies the linked employee account.
- [ ] Employee can cancel an open personal request with a reason.
- [ ] Request history records submission, every completed step, final decision, and cancellation.
- [ ] Active workflow versions cannot be edited or deleted.
- [ ] HR or owners can clone an active workflow, edit the draft steps, then activate it for new requests.
- [ ] Existing requests remain attached to the workflow version used at submission time.
- [ ] Approval steps support line manager, owner, HR, and a selected custom role.
- [ ] Approval rules support any one approver, every resolved approver, or a configurable approval count.
- [ ] Request and notification records remain invisible across tenant boundaries.
- [ ] Notification bell shows unread approval assignments and request decisions on desktop and mobile.

## Leave operations

- [ ] Every active leave type has a versioned approval workflow and new requests retain the workflow version used at submission.
- [ ] Authorized leave administrators can clone, edit, and activate leave workflows without changing in-flight requests.
- [ ] Leave approval responsibility follows the configured manager, owner, HR, or custom-role step instead of a hardcoded sequence.
- [ ] Sick and other configured leave types enforce supporting documents and expose them only through short-lived signed links.
- [ ] Employees or leave administrators can cancel open leave with a reason; started approved leave requires an authorized reversal.
- [ ] Approval history displays the completed workflow step, decision, note, and timestamp.
- [ ] Leave administrators can configure notice periods, request limits, document requirements, and active policies.
- [ ] Balance adjustments create immutable ledger transactions with employee, year, units, kind, and reason.
- [ ] Default Egypt 2026 public holidays remain available, and administrators can add or remove tenant holidays.
- [ ] Anonymous and cross-tenant callers cannot inspect, submit, approve, or alter leave operations.

## Payroll operations

- [ ] Payroll settings configure currency, standard days and hours, rounding, overtime, time-deduction, and absence multipliers.
- [ ] Employee compensation is effective-dated and supports monthly, daily, hourly, mixed, and commission arrangements.
- [ ] Replacing compensation closes the prior version without changing historical payroll snapshots.
- [ ] Payroll calculation includes attendance days, worked time, lateness, early departure, overtime, missing time, absence, and approved unpaid leave.
- [ ] Recalculation replaces automatic components but preserves reasoned manual additions and deductions.
- [ ] Payroll periods cannot overlap and retain the settings and compensation snapshots used for calculation.
- [ ] Payroll follows draft, calculated, reviewed, approved, locked, and published gates with role-based responsibility.
- [ ] Locked or published payroll cannot be recalculated or adjusted.
- [ ] Publication creates one employee payslip per result and makes it available only to payroll readers or that employee.
- [ ] Payslips itemize earnings and deductions, show the attendance summary, print cleanly to PDF, and support receipt acknowledgement.
- [ ] Cross-tenant payroll relationships and anonymous payroll RPC calls are rejected.

## Loans and employee advances

- [ ] Employee can request an interest-free loan or advance with amount, purpose, installment count, and preferred start month.
- [ ] Managers see only requests belonging to their branch or team unless they have company-wide financial access.
- [ ] An approver can adjust the approved amount, number of installments, and start month before approval.
- [ ] Approval creates an exact installment schedule whose total equals the approved principal, including rounding on the final installment.
- [ ] Rejection requires a reason and notifies the linked employee account.
- [ ] Employee can cancel a submitted personal request without deleting its history.
- [ ] Authorized staff can pause or resume an active loan, reschedule an unpaid installment with a reason, and retain its original due date.
- [ ] Manual payments allocate oldest-first, update installment status, total paid, and remaining balance transactionally.
- [ ] Early settlement closes the loan at zero remaining balance.
- [ ] Eligible unpaid installments appear once in payroll calculation and become deducted only after payroll publication.
- [ ] Employee statement shows approved amount, paid amount, remaining balance, repayment progress, schedule, and payment ledger.
- [ ] Cross-tenant loan relationships and anonymous loan RPC calls are rejected.

## Sales, targets, and bonuses

- [ ] Manager can submit a daily branch total or employee-attributed sale with date, amount, currency, reference, and notes.
- [ ] Submitted sales remain excluded from target results until approved.
- [ ] Sales rejection requires a reason and preserves the original entry.
- [ ] Authorized users can define reusable tier policies using fixed amount, salary percentage, or employee-sales percentage payouts.
- [ ] Targets can apply to one branch, team, or employee and reject invalid cross-tenant scope records.
- [ ] Branch totals prefer explicit branch-total entries and do not double-count employee attribution when both exist.
- [ ] Recalculation snapshots target, policy, approved sales, employee sales, and base salary inputs.
- [ ] Bonus results require a separate approval before they become eligible for payroll.
- [ ] Approved bonuses enter the matching payroll period once and become paid only at payroll publication.
- [ ] Sales, target, and bonus pages remain usable at a 390px mobile viewport.

## Tasks and operational delivery

- [ ] Manager can assign one task to selected employees, one or more teams, one or more branches, or every active employee.
- [ ] Branch and team managers cannot assign or approve work outside their organizational scope.
- [ ] Task priority, start time, due time, bilingual instructions, and evidence requirement remain visible on desktop and mobile.
- [ ] Assignee can start work, add comments, and submit completion notes with up to five protected JPG, PNG, WebP, or PDF files.
- [ ] A task configured to require evidence cannot be submitted without an attachment.
- [ ] Reviewer can approve submitted evidence or request changes with a required reason; the employee can then resubmit without losing prior attempts.
- [ ] A multi-assignee task becomes complete only after every active assignment is approved.
- [ ] Daily, weekly, and monthly tasks create the next occurrence after full approval and preserve a stable series and occurrence number.
- [ ] Overdue work is highlighted from its due timestamp without rewriting completed history.
- [ ] Task assignments, submissions, evidence, comments, and audit events remain tenant-isolated.

## Announcements and acknowledgement

- [ ] Publisher can draft bilingual announcements for the company, selected branches, teams, employees, or roles.
- [ ] Drafts can be reviewed with their resolved audience and attachments before publication.
- [ ] Publication expands a fixed recipient ledger and notifies linked active accounts.
- [ ] Normal, important, and critical announcements are visually distinct and may be pinned or given an expiry.
- [ ] Recipients can mark an announcement read; mandatory announcements require explicit acknowledgement.
- [ ] Authorized viewers see delivered, read-rate, and acknowledgement metrics without exposing them to ordinary recipients.
- [ ] Archived announcements retain their recipient and readership history.
- [ ] Announcement files are private and available only to publishers or addressed recipients through signed links.
- [ ] Task and announcement pages remain usable from the mobile navigation at a 390px viewport.

## Employee visibility and mobile

- [ ] Mobile web navigation opens from a burger button and closes by link, overlay, close button, or Escape.
- [ ] Employee records display as readable touch-friendly cards on phone-sized screens.
- [ ] The employee directory appears before the creation form on phone-sized screens.

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

## Employee access roles

- [ ] Owner or HR can assign one or more non-owner roles from an employee profile.
- [ ] Roles assigned before account creation remain pending and activate when the employee login is linked.
- [ ] Roles assigned to a linked employee synchronize immediately to membership permissions.
- [ ] Removing a role removes the corresponding membership permission assignment.
- [ ] Company ownership cannot be granted through an employee profile.
- [ ] Every employee-role change is tenant-isolated and audited.

## Seed-data confirmation

- [ ] Gate Way, The One, Berry Rose, and Onovi exist.
- [ ] Real employee names from the supplied images exist.
- [ ] The 17–23 July 2026 weekly schedules match the supplied images.
