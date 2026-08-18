# Acceptance Tests

## Administration experience hardening

- [ ] Selecting **Add employee** opens the creation dialog; the form is not shown before that action.
- [ ] Branch, team, shift-template, weekly-schedule, role, payroll-period, loan-request, daily-sales, task, announcement, leave-balance, and holiday creation forms stay hidden until their action button is selected.
- [ ] Creation dialogs close from the close button, backdrop, or Escape key and keep keyboard focus inside while open.
- [ ] Creation dialogs become reachable bottom sheets without horizontal overflow at a 390px viewport.
- [ ] The employee directory has one responsive list, without duplicate cards beneath it.
- [ ] The Shiftly brand and signed-in account both open their relevant pages.
- [ ] The dashboard owner card opens the owner profile.
- [ ] Long branch, team, and position labels expose their complete value in a tooltip.
- [ ] Team `001` contains every active employee while existing branch assignments remain unchanged.
- [ ] Saving or updating important records displays a pending state followed by a success or failure message.
- [ ] The employee directory and creation dialog remain usable at a 390px mobile viewport.
- [ ] The sidebar navigation scrolls independently and the account and sign-out controls remain visible at normal mobile zoom.
- [ ] Unexpected protected-page failures show retry, dashboard recovery, and a support reference instead of a raw framework error.

## Dashboard and discovery

- [ ] The home dashboard shows branch distribution, employee status, schedule state, a 30-day people-operations pulse, and a prioritized action queue.
- [ ] Every chart row links to the relevant operational page and remains keyboard accessible.
- [ ] Management reports combine workforce, attendance, leave, requests, payroll, loans, sales, targets, tasks, and announcement reach.
- [ ] Reporting date and branch filters update KPIs, trends, health, risk queues, and CSV exports consistently.
- [ ] Global search finds authorized employees, branches, teams, requests, payroll periods, schedules, tasks, and announcements.
- [ ] The `/` shortcut focuses global search unless the user is already typing in a field.
- [ ] Navigation hides administration destinations the active role cannot read while preserving employee payroll self-service.

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
- [ ] Native Android/iOS employee dashboard switches completely between English and Arabic, including RTL layout.
- [ ] Linked employee can capture a front-camera selfie and precise location, clock in/out, and immediately see the new punch and validation state.
- [ ] Denied camera, denied location, disabled location services, offline network, unlinked employee, unassigned branch, and disabled mobile clock each show a recoverable localized state.
- [ ] Native employee can review personal requests, acknowledge a published payslip, start an assigned task, acknowledge a mandatory announcement, and mark notifications read without accessing another employee's data.

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
- [ ] The navigation list scrolls independently at phone and short desktop heights while the signed-in profile and sign-out action remain reachable.
- [ ] Employee records display as readable touch-friendly cards on phone-sized screens.
- [ ] The employee directory appears before the creation form on phone-sized screens.

## Employee self-service attendance

- [ ] A linked employee with `attendance.clock` sees the current branch, operational workday shift, and the correct next clock action.
- [ ] The employee explicitly grants precise browser location access before the clock action is enabled; stale coordinates are refreshed before submission.
- [ ] "Take selfie" opens the front camera directly, shows a live preview, and captures a compressed image without exposing a file-upload picker.
- [ ] Branches requiring a selfie prevent submission until the employee captures an image.
- [ ] Selfies upload only to a private tenant/employee path and linked evidence cannot be deleted by the employee after recording.
- [ ] A punch outside the geofence is stored as pending and excluded from calculations; a mobile punch without coordinates is rejected by database validation.
- [ ] A validated check-in changes the next action to check-out and appears immediately in recent history.
- [ ] Offline state disables the clock action and recovers automatically when connectivity returns.
- [ ] Cross-midnight punches use the branch operational-day boundary instead of midnight.
- [ ] An unlinked account, missing branch, disabled mobile-clock policy, or missing permission produces a useful non-destructive explanation.
- [ ] The clock remains touch-friendly at a 390px viewport and in both English and Arabic.

## Fingerprint devices and imports

- [ ] HR can register an active device with a unique code, optional branch, model, serial number, connection mode, and valid timezone.
- [ ] Paused devices cannot accept file imports and can be safely reactivated.
- [ ] CSV, semicolon-delimited TXT, and XLSX files accept common terminal headers or explicit column overrides.
- [ ] Device-specific punch states can be mapped to check-in and check-out without changing source files.
- [ ] Local timestamps are interpreted with the device timezone and assigned through the branch operational-day boundary.
- [ ] A valid file imports matched employees while unknown employees or unsupported punch types remain as descriptive reconciliation rows.
- [ ] Uploading the same file again returns its original batch; repeated external references never create another punch.
- [ ] Every fingerprint punch retains its device, external reference, source file, and audit lineage.
- [ ] Ordinary employees cannot see device configuration, import batches, or reconciliation history.
- [ ] The built-in employee role cannot open branch, team, shift-template, role, or audit administration, including by entering the URL directly.
- [ ] Manual attendance, evidence review, recalculation/export, and fingerprint actions render only for their specific management/report permissions.
- [ ] Device/import pages remain usable from a phone viewport and the attendance report links back to the source evidence.

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
