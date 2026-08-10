begin;
select plan(36);

select has_table('public', 'attendance_punches', 'attendance punches exist');
select has_table('public', 'attendance_days', 'calculated attendance days exist');
select has_column('public', 'branches', 'late_grace_minutes', 'late grace is branch configurable');
select has_column('public', 'branches', 'early_departure_grace_minutes', 'early departure grace is branch configurable');
select has_column('public', 'branches', 'overtime_threshold_minutes', 'overtime threshold is branch configurable');
select has_column('public', 'branches', 'geofence_latitude', 'branch geofence latitude exists');
select has_column('public', 'branches', 'geofence_longitude', 'branch geofence longitude exists');
select has_column('public', 'branches', 'geofence_radius_metres', 'branch geofence radius exists');
select has_column('public', 'branches', 'mobile_clock_enabled', 'mobile clock can be enabled by branch');
select has_column('public', 'branches', 'attendance_selfie_required', 'selfie policy is branch configurable');
select has_function('public', 'can_view_attendance_employee', array['uuid','uuid'], 'attendance view scope helper exists');
select has_function('public', 'can_manage_attendance_employee', array['uuid','uuid'], 'attendance management scope helper exists');
select has_function('public', 'attendance_distance_metres', array['numeric','numeric','numeric','numeric'], 'geofence distance helper exists');
select has_function('public', 'recalculate_attendance_day', array['uuid','date'], 'attendance calculation function exists');
select has_function(
  'public', 'record_attendance_punch',
  array['uuid','attendance_punch_type','timestamp with time zone','attendance_source','date','uuid','numeric','numeric','text','text','text','text'],
  'attendance punch ingestion function exists'
);
select has_function('public', 'refresh_attendance_period', array['uuid','date','date'], 'attendance report refresh exists');
select has_function('public', 'review_attendance_punch', array['uuid','attendance_validation_status','text'], 'pending punch review workflow exists');
select ok((select relrowsecurity from pg_class where oid = 'public.attendance_punches'::regclass), 'attendance punches use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.attendance_days'::regclass), 'attendance calculations use RLS');
select is((select count(*)::integer from public.permissions where module = 'attendance'), 5, 'five attendance permissions are registered');

insert into public.tenants(id, slug, name_en, timezone, status)
values ('11000000-0000-0000-0000-000000000001', 'attendance-test', 'Attendance Test', 'UTC', 'active');

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '11000000-0000-0000-0000-000000000001' and r.name = 'owner' and rp.permission_key like 'attendance.%'),
  5,
  'new company owners receive complete attendance permissions'
);
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'attendance_punches'), 1, 'attendance punch read policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'attendance_days'), 1, 'attendance day read policy exists');

insert into public.branches(
  id, tenant_id, code, name_en, week_start_isodow, maximum_shift_hours,
  late_grace_minutes, early_departure_grace_minutes, overtime_threshold_minutes
) values (
  '21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001',
  'MAIN', 'Main', 1, 16, 5, 5, 30
);

insert into public.employees(id, tenant_id, employee_code, name_en, branch_id, status)
values (
  '31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001',
  'EMP-ATT', 'Attendance Tester', '21000000-0000-0000-0000-000000000001', 'active'
);

insert into public.shift_templates(id, tenant_id, branch_id, code, name_en, start_time, end_time)
values (
  '41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001', 'DAY', 'Day shift', '09:00', '17:00'
);

insert into public.weekly_schedules(id, tenant_id, branch_id, week_start)
values (
  '51000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001', '2026-08-03'
);
insert into public.schedule_entries(
  tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date, shift_template_id
) values (
  '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001',
  '2026-08-03', '41000000-0000-0000-0000-000000000001'
);
select set_config('shiftly.schedule_transition', 'allowed', true);
update public.weekly_schedules set status = 'published' where id = '51000000-0000-0000-0000-000000000001';

select is((select count(*)::integer from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 1, 'publishing creates a calculated attendance day');
select is((select status::text from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 'absent', 'a scheduled day without punches is absent');
select is((select scheduled_minutes from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 480, 'scheduled minutes come from the shift');
select ok((select team_id is null from public.employees where id = '31000000-0000-0000-0000-000000000001'), 'attendance works without a team assignment');

select lives_ok(
  $$insert into public.attendance_punches(
      tenant_id, employee_id, branch_id, work_date, punch_type, occurred_at, source
    ) values
    ('11000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '2026-08-03', 'check_in', '2026-08-03 09:10+00', 'manual'),
    ('11000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '2026-08-03', 'check_out', '2026-08-03 17:45+00', 'manual')$$,
  'valid manual punches recalculate attendance'
);
select is((select status::text from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 'late', 'late status is calculated');
select is((select late_minutes from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 5, 'late grace is deducted');
select is((select overtime_minutes from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 15, 'overtime starts after the configured threshold');
select is((select actual_minutes from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 515, 'actual minutes are calculated from complete punch pairs');
select is((select time_balance_minutes from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 10, 'daily time balance combines lateness and overtime');
select is((select valid_punch_count from public.attendance_days where employee_id = '31000000-0000-0000-0000-000000000001' and work_date = '2026-08-03'), 2, 'valid punch evidence count is retained');
select is(public.attendance_distance_metres(30, 31, 30, 31), 0, 'same geofence coordinates have zero distance');

select throws_ok(
  $$insert into public.attendance_punches(
      tenant_id, employee_id, branch_id, work_date, punch_type, occurred_at, source
    ) values (
      '11000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', '2026-08-03', 'check_in', '2026-08-03 08:50+00', 'manual'
    )$$,
  'P0001',
  'Attendance branch must belong to the same company',
  'cross-company branch evidence is rejected'
);

select * from finish();
rollback;
