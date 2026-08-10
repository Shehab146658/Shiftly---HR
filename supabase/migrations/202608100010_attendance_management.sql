-- Milestone 3 attendance foundation: punch ingestion, geofence evidence, calculations, and reports.

create type public.attendance_punch_type as enum ('check_in', 'check_out');
create type public.attendance_source as enum ('mobile', 'fingerprint', 'manual', 'import');
create type public.attendance_validation_status as enum ('valid', 'pending', 'rejected');
create type public.attendance_day_status as enum ('present', 'late', 'incomplete', 'absent', 'off', 'leave', 'unscheduled');

alter table public.branches
  add column late_grace_minutes integer not null default 0 check (late_grace_minutes between 0 and 240),
  add column early_departure_grace_minutes integer not null default 0 check (early_departure_grace_minutes between 0 and 240),
  add column overtime_threshold_minutes integer not null default 30 check (overtime_threshold_minutes between 0 and 480),
  add column geofence_latitude numeric(9,6) check (geofence_latitude is null or geofence_latitude between -90 and 90),
  add column geofence_longitude numeric(9,6) check (geofence_longitude is null or geofence_longitude between -180 and 180),
  add column geofence_radius_metres integer not null default 150 check (geofence_radius_metres between 20 and 5000),
  add column mobile_clock_enabled boolean not null default true,
  add column attendance_selfie_required boolean not null default true;

create table public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  work_date date not null,
  punch_type public.attendance_punch_type not null,
  occurred_at timestamptz not null,
  source public.attendance_source not null,
  validation_status public.attendance_validation_status not null default 'valid',
  latitude numeric(9,6),
  longitude numeric(9,6),
  distance_metres integer,
  within_geofence boolean,
  selfie_path text,
  external_reference text,
  device_identifier text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, punch_type, occurred_at),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null)),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (distance_metres is null or distance_metres >= 0)
);

create unique index attendance_punches_external_unique
  on public.attendance_punches(tenant_id, source, external_reference)
  where external_reference is not null;
create index attendance_punches_employee_date_idx on public.attendance_punches(employee_id, work_date, occurred_at);
create index attendance_punches_tenant_date_idx on public.attendance_punches(tenant_id, work_date desc, validation_status);

create table public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  work_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  scheduled_minutes integer not null default 0 check (scheduled_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  late_minutes integer not null default 0 check (late_minutes >= 0),
  early_departure_minutes integer not null default 0 check (early_departure_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  missing_minutes integer not null default 0 check (missing_minutes >= 0),
  time_balance_minutes integer not null default 0,
  status public.attendance_day_status not null,
  valid_punch_count integer not null default 0 check (valid_punch_count >= 0),
  pending_punch_count integer not null default 0 check (pending_punch_count >= 0),
  calculation_notes text,
  calculated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index attendance_days_tenant_date_idx on public.attendance_days(tenant_id, work_date desc, status);
create index attendance_days_branch_date_idx on public.attendance_days(branch_id, work_date desc);

insert into public.permissions(key, description, module) values
  ('attendance.read', 'View personal attendance', 'attendance'),
  ('attendance.read_all', 'View company attendance', 'attendance'),
  ('attendance.clock', 'Record personal mobile attendance', 'attendance'),
  ('attendance.manage', 'Record corrections and maintain attendance evidence', 'attendance'),
  ('attendance.reports', 'Refresh and export attendance calculations', 'attendance')
on conflict (key) do nothing;

create or replace function public.grant_attendance_permissions_for_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name in ('owner', 'hr_admin') then
    insert into public.role_permissions(role_id, permission_key)
    select new.id, p.key from public.permissions p where p.module = 'attendance' on conflict do nothing;
  elsif new.name in ('payroll_officer', 'accountant') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'attendance.read'), (new.id, 'attendance.read_all'), (new.id, 'attendance.reports')
    on conflict do nothing;
  elsif new.name in ('branch_manager', 'team_manager') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'attendance.read'), (new.id, 'attendance.clock'), (new.id, 'attendance.manage'), (new.id, 'attendance.reports')
    on conflict do nothing;
  elsif new.name = 'employee' then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'attendance.read'), (new.id, 'attendance.clock')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_attendance_permissions_after_role
after insert on public.roles
for each row execute function public.grant_attendance_permissions_for_role();

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.module = 'attendance'
  and (
    r.name in ('owner', 'hr_admin')
    or (r.name in ('payroll_officer', 'accountant') and p.key in ('attendance.read', 'attendance.read_all', 'attendance.reports'))
    or (r.name in ('branch_manager', 'team_manager') and p.key in ('attendance.read', 'attendance.clock', 'attendance.manage', 'attendance.reports'))
    or (r.name = 'employee' and p.key in ('attendance.read', 'attendance.clock'))
  )
on conflict do nothing;

create or replace function public.can_view_attendance_employee(p_tenant_id uuid, p_employee_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current public.employees%rowtype;
  v_target public.employees%rowtype;
begin
  if public.has_permission(p_tenant_id, 'attendance.read_all') then return true; end if;
  select * into v_current from public.employees e where e.tenant_id = p_tenant_id and e.user_id = auth.uid() and e.status <> 'terminated' limit 1;
  if v_current.id = p_employee_id and public.has_permission(p_tenant_id, 'attendance.read') then return true; end if;
  if not public.has_permission(p_tenant_id, 'attendance.manage') or v_current.id is null then return false; end if;
  select * into v_target from public.employees e where e.id = p_employee_id and e.tenant_id = p_tenant_id;
  return v_target.id is not null and (
    (v_current.team_id is not null and v_current.team_id = v_target.team_id)
    or (v_current.branch_id is not null and v_current.branch_id = v_target.branch_id)
  );
end;
$$;

create or replace function public.can_manage_attendance_employee(p_tenant_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission(p_tenant_id, 'attendance.manage')
    and public.can_view_attendance_employee(p_tenant_id, p_employee_id);
$$;

create or replace function public.attendance_distance_metres(
  p_latitude numeric,
  p_longitude numeric,
  p_branch_latitude numeric,
  p_branch_longitude numeric
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(6371000 * 2 * asin(sqrt(
    power(sin(radians((p_latitude - p_branch_latitude)::double precision) / 2), 2)
    + cos(radians(p_branch_latitude::double precision))
      * cos(radians(p_latitude::double precision))
      * power(sin(radians((p_longitude - p_branch_longitude)::double precision) / 2), 2)
  )))::integer;
$$;

create or replace function public.validate_attendance_punch_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id and e.status <> 'terminated') then
    raise exception 'Attendance employee must be active in the same company';
  end if;
  if new.branch_id is not null and not exists (select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id) then
    raise exception 'Attendance branch must belong to the same company';
  end if;
  return new;
end;
$$;

create trigger attendance_punches_updated_at before update on public.attendance_punches
for each row execute function public.set_updated_at();
create trigger validate_attendance_punch_before_write before insert or update on public.attendance_punches
for each row execute function public.validate_attendance_punch_links();

create or replace function public.recalculate_attendance_day(p_employee_id uuid, p_work_date date)
returns public.attendance_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_result public.attendance_days%rowtype;
  v_timezone text;
  v_branch_id uuid;
  v_scheduled_start timestamptz;
  v_scheduled_end timestamptz;
  v_scheduled_minutes integer := 0;
  v_actual_in timestamptz;
  v_actual_out timestamptz;
  v_actual_minutes integer := 0;
  v_late integer := 0;
  v_early integer := 0;
  v_overtime integer := 0;
  v_missing integer := 0;
  v_valid_count integer := 0;
  v_pending_count integer := 0;
  v_has_off boolean := false;
  v_has_leave boolean := false;
  v_shift_count integer := 0;
  v_late_grace integer := 0;
  v_early_grace integer := 0;
  v_overtime_threshold integer := 30;
  v_status public.attendance_day_status;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  select t.timezone into v_timezone from public.tenants t where t.id = v_employee.tenant_id;

  select
    min(se.scheduled_branch_id::text)::uuid,
    min(case when se.entry_type = 'shift' then ((p_work_date + coalesce(st.start_time, se.custom_start_time)) at time zone v_timezone) end),
    max(case when se.entry_type = 'shift' then ((p_work_date + coalesce(st.end_time, se.custom_end_time) + (coalesce(st.end_day_offset, se.end_day_offset) * interval '1 day')) at time zone v_timezone) end),
    coalesce(sum(case when se.entry_type = 'shift' then public.shift_duration_minutes(
      coalesce(st.start_time, se.custom_start_time), coalesce(st.end_time, se.custom_end_time), coalesce(st.end_day_offset, se.end_day_offset)
    ) - coalesce(st.break_minutes, se.break_minutes) else 0 end), 0)::integer,
    count(*) filter (where se.entry_type = 'shift')::integer,
    coalesce(bool_or(se.entry_type = 'off'), false),
    coalesce(bool_or(se.entry_type = 'leave'), false)
  into v_branch_id, v_scheduled_start, v_scheduled_end, v_scheduled_minutes, v_shift_count, v_has_off, v_has_leave
  from public.schedule_entries se
  join public.weekly_schedules ws on ws.id = se.schedule_id and ws.status in ('published', 'locked')
  left join public.shift_templates st on st.id = se.shift_template_id
  where se.employee_id = p_employee_id and se.work_date = p_work_date;

  v_branch_id := coalesce(v_branch_id, v_employee.branch_id);
  if v_branch_id is not null then
    select b.late_grace_minutes, b.early_departure_grace_minutes, b.overtime_threshold_minutes
      into v_late_grace, v_early_grace, v_overtime_threshold
    from public.branches b where b.id = v_branch_id;
  end if;

  select
    min(occurred_at) filter (where punch_type = 'check_in' and validation_status = 'valid'),
    max(occurred_at) filter (where punch_type = 'check_out' and validation_status = 'valid'),
    count(*) filter (where validation_status = 'valid')::integer,
    count(*) filter (where validation_status = 'pending')::integer
  into v_actual_in, v_actual_out, v_valid_count, v_pending_count
  from public.attendance_punches
  where employee_id = p_employee_id and work_date = p_work_date;

  -- Pair each valid check-in with the immediately following check-out. This keeps
  -- split shifts and clocked breaks from being counted as one continuous span.
  with ordered_punches as (
    select
      punch_type,
      occurred_at,
      lead(punch_type) over (order by occurred_at, created_at, id) as next_type,
      lead(occurred_at) over (order by occurred_at, created_at, id) as next_time
    from public.attendance_punches
    where employee_id = p_employee_id
      and work_date = p_work_date
      and validation_status = 'valid'
  )
  select coalesce(sum(
    floor(extract(epoch from (next_time - occurred_at)) / 60)
  ) filter (where punch_type = 'check_in' and next_type = 'check_out' and next_time >= occurred_at), 0)::integer
  into v_actual_minutes
  from ordered_punches;
  if v_scheduled_start is not null and v_actual_in is not null then
    v_late := greatest(0, floor(extract(epoch from (v_actual_in - v_scheduled_start)) / 60)::integer - v_late_grace);
  end if;
  if v_scheduled_end is not null and v_actual_out is not null then
    v_early := greatest(0, floor(extract(epoch from (v_scheduled_end - v_actual_out)) / 60)::integer - v_early_grace);
    v_overtime := greatest(0, floor(extract(epoch from (v_actual_out - v_scheduled_end)) / 60)::integer - v_overtime_threshold);
  end if;

  if v_has_off then
    v_status := 'off';
  elsif v_has_leave then
    v_status := 'leave';
  elsif v_shift_count = 0 then
    v_status := 'unscheduled';
  elsif v_actual_in is null and v_actual_out is null then
    v_status := 'absent';
    v_missing := v_scheduled_minutes;
  elsif v_actual_in is null or v_actual_out is null or v_actual_out < v_actual_in then
    v_status := 'incomplete';
    v_missing := v_scheduled_minutes;
  elsif v_late > 0 then
    v_status := 'late';
  else
    v_status := 'present';
  end if;

  insert into public.attendance_days(
    tenant_id, employee_id, branch_id, work_date, scheduled_start, scheduled_end,
    actual_check_in, actual_check_out, scheduled_minutes, actual_minutes, late_minutes,
    early_departure_minutes, overtime_minutes, missing_minutes, time_balance_minutes,
    status, valid_punch_count, pending_punch_count, calculation_notes, calculated_at
  ) values (
    v_employee.tenant_id, v_employee.id, v_branch_id, p_work_date, v_scheduled_start, v_scheduled_end,
    v_actual_in, v_actual_out, v_scheduled_minutes, v_actual_minutes, v_late, v_early,
    v_overtime, v_missing, v_overtime - v_late - v_early - v_missing, v_status,
    v_valid_count, v_pending_count,
    case when v_pending_count > 0 then 'Pending attendance evidence is excluded until approved' else null end,
    now()
  )
  on conflict (employee_id, work_date) do update set
    tenant_id = excluded.tenant_id, branch_id = excluded.branch_id,
    scheduled_start = excluded.scheduled_start, scheduled_end = excluded.scheduled_end,
    actual_check_in = excluded.actual_check_in, actual_check_out = excluded.actual_check_out,
    scheduled_minutes = excluded.scheduled_minutes, actual_minutes = excluded.actual_minutes,
    late_minutes = excluded.late_minutes, early_departure_minutes = excluded.early_departure_minutes,
    overtime_minutes = excluded.overtime_minutes, missing_minutes = excluded.missing_minutes,
    time_balance_minutes = excluded.time_balance_minutes, status = excluded.status,
    valid_punch_count = excluded.valid_punch_count, pending_punch_count = excluded.pending_punch_count,
    calculation_notes = excluded.calculation_notes, calculated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.recalculate_attendance_after_punch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_attendance_day(old.employee_id, old.work_date);
    return old;
  end if;
  perform public.recalculate_attendance_day(new.employee_id, new.work_date);
  if tg_op = 'UPDATE' and (new.employee_id is distinct from old.employee_id or new.work_date is distinct from old.work_date) then
    perform public.recalculate_attendance_day(old.employee_id, old.work_date);
  end if;
  return new;
end;
$$;

create trigger recalculate_attendance_after_punch_change
after insert or update or delete on public.attendance_punches
for each row execute function public.recalculate_attendance_after_punch();

create or replace function public.recalculate_attendance_after_schedule_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
begin
  if new.status in ('published', 'locked') and new.status is distinct from old.status then
    for v_entry in select distinct se.employee_id, se.work_date from public.schedule_entries se where se.schedule_id = new.id loop
      perform public.recalculate_attendance_day(v_entry.employee_id, v_entry.work_date);
    end loop;
  end if;
  return new;
end;
$$;

create trigger recalculate_attendance_on_schedule_publish
after update of status on public.weekly_schedules
for each row execute function public.recalculate_attendance_after_schedule_publish();

create or replace function public.record_attendance_punch(
  p_employee_id uuid,
  p_punch_type public.attendance_punch_type,
  p_occurred_at timestamptz,
  p_source public.attendance_source,
  p_work_date date default null,
  p_branch_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_selfie_path text default null,
  p_device_identifier text default null,
  p_external_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_branch public.branches%rowtype;
  v_timezone text;
  v_work_date date;
  v_distance integer;
  v_within boolean;
  v_validation public.attendance_validation_status := 'valid'::public.attendance_validation_status;
  v_id uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id and status <> 'terminated';
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    if p_source = 'mobile' then
      if public.current_employee_id(v_employee.tenant_id) <> v_employee.id or not public.has_permission(v_employee.tenant_id, 'attendance.clock') then raise exception 'Not authorized to clock for this employee'; end if;
    elsif p_source = 'manual' then
      if not public.can_manage_attendance_employee(v_employee.tenant_id, v_employee.id) then raise exception 'Not authorized to record a manual punch'; end if;
    else
      raise exception 'Fingerprint and import sources require an integration service';
    end if;
  end if;

  select * into v_branch from public.branches where id = coalesce(p_branch_id, v_employee.branch_id) and tenant_id = v_employee.tenant_id;
  select t.timezone into v_timezone from public.tenants t where t.id = v_employee.tenant_id;
  v_work_date := p_work_date;
  if v_work_date is null then
    v_work_date := (
      (p_occurred_at at time zone v_timezone)
      - (coalesce(extract(epoch from v_branch.operational_day_start), 21600) * interval '1 second')
    )::date;
  end if;

  if p_source = 'mobile' then
    if not coalesce(v_branch.mobile_clock_enabled, false) then raise exception 'Mobile attendance is disabled for this branch'; end if;
    if coalesce(v_branch.attendance_selfie_required, false) and nullif(trim(coalesce(p_selfie_path, '')), '') is null then raise exception 'A selfie is required for mobile attendance'; end if;
    if v_branch.geofence_latitude is not null and v_branch.geofence_longitude is not null and p_latitude is not null and p_longitude is not null then
      v_distance := public.attendance_distance_metres(p_latitude, p_longitude, v_branch.geofence_latitude, v_branch.geofence_longitude);
      v_within := v_distance <= v_branch.geofence_radius_metres;
    else
      v_within := null;
    end if;
    if v_within is distinct from true then v_validation := 'pending'::public.attendance_validation_status; end if;
  end if;

  insert into public.attendance_punches(
    tenant_id, employee_id, branch_id, work_date, punch_type, occurred_at, source,
    validation_status, latitude, longitude, distance_metres, within_geofence,
    selfie_path, device_identifier, external_reference, notes, created_by
  ) values (
    v_employee.tenant_id, v_employee.id, v_branch.id, v_work_date, p_punch_type, p_occurred_at, p_source,
    v_validation, p_latitude, p_longitude, v_distance, v_within,
    nullif(trim(coalesce(p_selfie_path, '')), ''), nullif(trim(coalesce(p_device_identifier, '')), ''),
    nullif(trim(coalesce(p_external_reference, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.refresh_attendance_period(p_tenant_id uuid, p_date_from date, p_date_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  if p_date_to < p_date_from then raise exception 'End date must be on or after start date'; end if;
  if p_date_to - p_date_from > 92 then raise exception 'Attendance refresh is limited to 93 days'; end if;
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role'
    and not public.has_permission(p_tenant_id, 'attendance.reports')
    and not public.has_permission(p_tenant_id, 'attendance.read_all') then
    raise exception 'Not authorized to refresh attendance reports';
  end if;

  for v_row in
    select distinct source.employee_id, source.work_date
    from (
      select se.employee_id, se.work_date
      from public.schedule_entries se join public.weekly_schedules ws on ws.id = se.schedule_id
      where se.tenant_id = p_tenant_id and ws.status in ('published', 'locked') and se.work_date between p_date_from and p_date_to
      union
      select ap.employee_id, ap.work_date
      from public.attendance_punches ap
      where ap.tenant_id = p_tenant_id and ap.work_date between p_date_from and p_date_to
    ) source
  loop
    perform public.recalculate_attendance_day(v_row.employee_id, v_row.work_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.review_attendance_punch(
  p_punch_id uuid,
  p_decision public.attendance_validation_status,
  p_note text default null
)
returns public.attendance_punches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_punch public.attendance_punches%rowtype;
begin
  select * into v_punch from public.attendance_punches where id = p_punch_id for update;
  if v_punch.id is null then raise exception 'Attendance punch not found'; end if;
  if not public.can_manage_attendance_employee(v_punch.tenant_id, v_punch.employee_id) then raise exception 'Not authorized to review attendance evidence'; end if;
  if v_punch.validation_status <> 'pending' then raise exception 'Only pending attendance evidence can be reviewed'; end if;
  if p_decision not in ('valid', 'rejected') then raise exception 'Review decision must be valid or rejected'; end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) < 3 then raise exception 'A rejection reason is required'; end if;
  update public.attendance_punches
  set validation_status = p_decision,
      notes = concat_ws(E'\n', nullif(notes, ''), nullif(trim(coalesce(p_note, '')), ''))
  where id = p_punch_id
  returning * into v_punch;
  return v_punch;
end;
$$;

create trigger audit_attendance_punches after insert or update or delete on public.attendance_punches
for each row execute function public.capture_audit_log();

alter table public.attendance_punches enable row level security;
alter table public.attendance_days enable row level security;

create policy attendance_punches_read on public.attendance_punches for select to authenticated
using (public.can_view_attendance_employee(tenant_id, employee_id));
create policy attendance_days_read on public.attendance_days for select to authenticated
using (public.can_view_attendance_employee(tenant_id, employee_id));

grant select on public.attendance_punches, public.attendance_days to authenticated;
grant all on public.attendance_punches, public.attendance_days to service_role;
grant execute on function public.can_view_attendance_employee(uuid, uuid) to authenticated;
grant execute on function public.can_manage_attendance_employee(uuid, uuid) to authenticated;
grant execute on function public.record_attendance_punch(uuid, public.attendance_punch_type, timestamptz, public.attendance_source, date, uuid, numeric, numeric, text, text, text, text) to authenticated, service_role;
grant execute on function public.refresh_attendance_period(uuid, date, date) to authenticated, service_role;
grant execute on function public.review_attendance_punch(uuid, public.attendance_validation_status, text) to authenticated, service_role;

revoke execute on function public.grant_attendance_permissions_for_role() from public, anon, authenticated;
revoke execute on function public.validate_attendance_punch_links() from public, anon, authenticated;
revoke execute on function public.recalculate_attendance_after_punch() from public, anon, authenticated;
revoke execute on function public.recalculate_attendance_after_schedule_publish() from public, anon, authenticated;
revoke execute on function public.recalculate_attendance_day(uuid, date) from public, anon, authenticated;
revoke execute on function public.attendance_distance_metres(numeric, numeric, numeric, numeric) from public, anon, authenticated;

-- Backfill already-published schedules so the first report immediately includes absences and OFF/leave days.
select public.refresh_attendance_period(t.id, current_date - 61, current_date + 31)
from public.tenants t;
