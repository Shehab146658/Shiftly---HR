begin;
select plan(16);

insert into public.tenants(id, slug, name_en, status)
values ('1a000000-0000-0000-0000-000000000001', 'employee-access-test', 'Employee Access Test', 'active');

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'branches.read'),
  0,
  'the default employee role cannot browse company branches'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'teams.read'),
  0,
  'the default employee role cannot browse company teams'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'shifts.read'),
  0,
  'the default employee role cannot browse shift-template administration'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'attendance.manage'),
  0,
  'employees cannot add manual attendance or review evidence'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'attendance.reports'),
  0,
  'employees cannot refresh or export company attendance reports'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'attendance.read_all'),
  0,
  'employees cannot read company-wide attendance'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'attendance.read'),
  1,
  'employees retain personal attendance history'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'attendance.clock'),
  1,
  'employees retain mobile clock access'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '1a000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'schedules.read'),
  1,
  'employees retain their visible published schedule access'
);

select ok(
  (select qual ilike '%e.user_id = auth.uid()%' from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'branches_read'),
  'branch RLS limits self-service resolution to the signed-in employee branch'
);

select ok(
  (select qual ilike '%e.user_id = auth.uid()%' from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'teams_read'),
  'team RLS limits self-service resolution to the signed-in employee team'
);

select ok(
  (select qual ilike '%can_view_schedule_entry%' from pg_policies where schemaname = 'public' and tablename = 'shift_templates' and policyname = 'shift_templates_read'),
  'shift-template RLS exposes only templates referenced by visible schedules'
);

select ok(
  (select qual ilike '%m.user_id = auth.uid()%' and qual ilike '%mr.role_id = roles.id%' from pg_policies where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_read'),
  'role RLS exposes assigned role metadata without exposing the full role directory'
);

select has_function(
  'public',
  'require_mobile_attendance_location',
  'mobile location evidence has a database validation function'
);

select has_trigger(
  'public',
  'attendance_punches',
  'require_mobile_attendance_location_before_insert',
  'mobile location evidence is enforced before every attendance insert'
);

select has_trigger(
  'public',
  'tenants',
  'zz_enforce_employee_self_service_after_tenant_seed',
  'future tenant role seeding finishes with the employee self-service cleanup'
);

select * from finish();
rollback;
