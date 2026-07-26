begin;
select plan(20);

select has_table('public', 'employee_assignments', 'employee assignment history exists');
select has_table('public', 'shift_templates', 'shift templates exist');
select has_table('public', 'weekly_schedules', 'weekly schedules exist');
select has_table('public', 'schedule_entries', 'schedule entries exist');
select has_table('public', 'schedule_status_events', 'schedule status events exist');
select has_column('public', 'branches', 'week_start_isodow', 'branch week start is configurable');
select has_column('public', 'branches', 'operational_day_start', 'branch operational day is configurable');
select has_column('public', 'employees', 'preferred_locale', 'employee preferred locale exists');
select has_function('public', 'current_employee_id', array['uuid'], 'current employee helper exists');
select has_function('public', 'can_view_schedule_entry', array['uuid','uuid','uuid','uuid'], 'schedule visibility helper exists');
select has_function('public', 'set_weekly_schedule_status', array['uuid','schedule_status','text'], 'controlled status transition RPC exists');
select has_function('public', 'copy_weekly_schedule', array['uuid','date'], 'schedule copy RPC exists');
select ok(row_security_active('public.employee_assignments'::regclass), 'RLS is active on employee assignments');
select ok(row_security_active('public.shift_templates'::regclass), 'RLS is active on shift templates');
select ok(row_security_active('public.weekly_schedules'::regclass), 'RLS is active on weekly schedules');
select ok(row_security_active('public.schedule_entries'::regclass), 'RLS is active on schedule entries');
select ok(row_security_active('public.schedule_status_events'::regclass), 'RLS is active on schedule status events');
select col_is_pk('public', 'weekly_schedules', 'id', 'weekly schedules have a primary key');
select col_not_null('public', 'schedule_entries', 'employee_id', 'schedule entries require an employee');
select col_not_null('public', 'schedule_entries', 'work_date', 'schedule entries require a work date');

select * from finish();
rollback;
