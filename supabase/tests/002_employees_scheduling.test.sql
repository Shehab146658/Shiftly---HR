begin;
select plan(36);

select has_table('public', 'employee_assignments', 'employee assignment history exists');
select has_table('public', 'shift_templates', 'shift templates exist');
select has_table('public', 'weekly_schedules', 'weekly schedules exist');
select has_table('public', 'schedule_entries', 'schedule entries exist');
select has_table('public', 'schedule_status_events', 'schedule status events exist');
select has_column('public', 'branches', 'week_start_isodow', 'branch week start is configurable');
select has_column('public', 'branches', 'operational_day_start', 'branch operational day is configurable');
select has_column('public', 'employees', 'preferred_locale', 'employee preferred locale exists');
select has_function('public', 'current_employee_id', array['uuid'], 'current employee helper exists');
select has_function('public', 'shift_duration_minutes', array['time without time zone','time without time zone','smallint'], 'shift duration helper exists');
select has_function('public', 'can_manage_schedule_branch', array['uuid','uuid'], 'schedule branch scope helper exists');
select has_function('public', 'can_manage_schedule', array['uuid','uuid'], 'schedule write scope helper exists');
select has_function('public', 'can_view_weekly_schedule', array['uuid','uuid','uuid','schedule_visibility'], 'schedule metadata visibility helper exists');
select has_function('public', 'can_view_schedule_entry', array['uuid','uuid','uuid','uuid'], 'schedule entry visibility helper exists');
select has_function('public', 'set_weekly_schedule_status', array['uuid','schedule_status','text'], 'controlled status transition RPC exists');
select has_function('public', 'copy_weekly_schedule', array['uuid','date'], 'schedule copy RPC exists');
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.employee_assignments'::regclass),
  'RLS is enabled on employee assignments'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.shift_templates'::regclass),
  'RLS is enabled on shift templates'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.weekly_schedules'::regclass),
  'RLS is enabled on weekly schedules'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.schedule_entries'::regclass),
  'RLS is enabled on schedule entries'
);
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.schedule_status_events'::regclass),
  'RLS is enabled on schedule status events'
);
select col_is_pk('public', 'weekly_schedules', 'id', 'weekly schedules have a primary key');
select col_not_null('public', 'schedule_entries', 'employee_id', 'schedule entries require an employee');
select col_not_null('public', 'schedule_entries', 'work_date', 'schedule entries require a work date');

insert into public.tenants(id, slug, name_en, status)
values ('10000000-0000-0000-0000-000000000001', 'm2-test', 'Milestone 2 Test', 'active');

insert into public.branches(id, tenant_id, code, name_en, maximum_shift_hours, week_start_isodow)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'MAIN', 'Main', 8, 5),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'OTHER', 'Other', 16, 5);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    where r.tenant_id = '10000000-0000-0000-0000-000000000001'
      and r.name in ('branch_manager', 'team_manager')
      and rp.permission_key = 'schedules.read_all'
  ),
  0,
  'manager roles do not receive tenant-wide schedule visibility'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    where r.tenant_id = '10000000-0000-0000-0000-000000000001'
      and r.name = 'owner'
      and rp.permission_key = 'schedules.read_all'
  ),
  1,
  'owner retains tenant-wide schedule visibility'
);

insert into public.employees(
  id, tenant_id, employee_code, name_en, branch_id, position, status, hire_date
)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'EMP-001',
  'Schedule Tester',
  '20000000-0000-0000-0000-000000000001',
  'Sales',
  'active',
  '2026-07-01'
);

update public.employees
set position = 'Senior Sales'
where id = '30000000-0000-0000-0000-000000000001';
update public.employees
set position = 'Supervisor'
where id = '30000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::integer from public.employee_assignments where employee_id = '30000000-0000-0000-0000-000000000001'),
  3,
  'same-day assignment changes preserve every history row'
);
select is(
  (select count(*)::integer from public.employee_assignments where employee_id = '30000000-0000-0000-0000-000000000001' and effective_to is null),
  1,
  'only one assignment remains current'
);

update public.employees
set status = 'terminated'
where id = '30000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::integer from public.employee_assignments where employee_id = '30000000-0000-0000-0000-000000000001' and effective_to is null),
  0,
  'archiving an employee closes the current assignment'
);

update public.employees
set status = 'active'
where id = '30000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::integer from public.employee_assignments where employee_id = '30000000-0000-0000-0000-000000000001' and effective_to is null),
  1,
  'reactivating an employee creates a new current assignment'
);

insert into public.shift_templates(
  id, tenant_id, code, name_en, start_time, end_time, end_day_offset
)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SHORT', 'Short shift', '12:00', '20:00', 0),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'LONG', 'Long shift', '12:00', '00:00', 1);

select throws_ok(
  $$insert into public.shift_templates(
      tenant_id, branch_id, code, name_en, start_time, end_time, end_day_offset
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'TOO_LONG',
      'Too long',
      '12:00',
      '00:00',
      1
    )$$,
  'P0001',
  'Shift duration exceeds the branch maximum',
  'branch shift templates respect the configured maximum duration'
);

select throws_ok(
  $$insert into public.weekly_schedules(tenant_id, branch_id, week_start)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-07-18')$$,
  'P0001',
  'Schedule week start does not match the branch week-start setting',
  'schedule must start on the branch-configured weekday'
);

insert into public.weekly_schedules(id, tenant_id, branch_id, week_start)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '2026-07-17'
);

select throws_ok(
  $$insert into public.schedule_entries(
      tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date, shift_template_id
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '2026-07-17',
      '40000000-0000-0000-0000-000000000002'
    )$$,
  'P0001',
  'Shift duration exceeds the branch maximum',
  'schedule entry respects the branch maximum shift duration'
);

select throws_ok(
  $$insert into public.schedule_entries(
      tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date, shift_template_id
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      '2026-07-17',
      '40000000-0000-0000-0000-000000000001'
    )$$,
  'P0001',
  'Scheduled branch must match the weekly schedule branch',
  'entry cannot be attached to a different branch'
);

select lives_ok(
  $$insert into public.schedule_entries(
      tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date, shift_template_id
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '2026-07-17',
      '40000000-0000-0000-0000-000000000001'
    )$$,
  'valid draft schedule entry is accepted'
);

select throws_ok(
  $$update public.weekly_schedules
    set status = 'published'
    where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Use the schedule status action to publish, lock, reopen, or archive a schedule',
  'direct schedule status updates are blocked'
);

select * from finish();
rollback;
