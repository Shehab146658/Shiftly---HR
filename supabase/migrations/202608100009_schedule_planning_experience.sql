-- Employee-first schedule planning: optional teams, bulk day assignment, and conflict protection.

comment on column public.employees.team_id is
  'Optional team assignment. Employees may be scheduled and managed without belonging to a team.';

comment on column public.employee_assignments.team_id is
  'Optional historical team assignment.';

create or replace function public.prevent_schedule_entry_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_start integer;
  v_new_end integer;
  v_week_start date;
begin
  if new.entry_type <> 'shift' then
    if exists (
      select 1
      from public.schedule_entries se
      where se.schedule_id = new.schedule_id
        and se.employee_id = new.employee_id
        and se.work_date = new.work_date
        and se.id <> new.id
    ) then
      raise exception 'OFF, leave, training, or assignment must be the only entry for that employee and day';
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.schedule_entries se
    where se.schedule_id = new.schedule_id
      and se.employee_id = new.employee_id
      and se.work_date = new.work_date
      and se.id <> new.id
      and se.entry_type <> 'shift'
  ) then
    raise exception 'Remove the existing non-shift day entry before adding working hours';
  end if;

  select
    ws.week_start,
    ((new.work_date - ws.week_start) * 1440) + extract(epoch from coalesce(st.start_time, new.custom_start_time))::integer / 60,
    ((new.work_date - ws.week_start) * 1440) + extract(epoch from coalesce(st.end_time, new.custom_end_time))::integer / 60
      + (coalesce(st.end_day_offset, new.end_day_offset)::integer * 1440)
  into v_week_start, v_new_start, v_new_end
  from public.weekly_schedules ws
  left join public.shift_templates st on st.id = new.shift_template_id
  where ws.id = new.schedule_id;

  if exists (
    select 1
    from public.schedule_entries se
    left join public.shift_templates existing_template on existing_template.id = se.shift_template_id
    where se.schedule_id = new.schedule_id
      and se.employee_id = new.employee_id
      and se.id <> new.id
      and se.entry_type = 'shift'
      and v_new_start < (
        ((se.work_date - v_week_start) * 1440)
        + extract(epoch from coalesce(existing_template.end_time, se.custom_end_time))::integer / 60
        + (coalesce(existing_template.end_day_offset, se.end_day_offset)::integer * 1440)
      )
      and (
        ((se.work_date - v_week_start) * 1440)
        + extract(epoch from coalesce(existing_template.start_time, se.custom_start_time))::integer / 60
      ) < v_new_end
  ) then
    raise exception 'Schedule shifts cannot overlap for the same employee';
  end if;

  return new;
end;
$$;

create trigger prevent_schedule_entry_conflicts_before_write
before insert or update on public.schedule_entries
for each row execute function public.prevent_schedule_entry_conflicts();

create or replace function public.bulk_assign_schedule_entries(
  p_schedule_id uuid,
  p_employee_ids uuid[],
  p_work_dates date[],
  p_entry_type public.schedule_entry_type,
  p_shift_template_id uuid default null,
  p_custom_start_time time default null,
  p_custom_end_time time default null,
  p_end_day_offset smallint default 0,
  p_break_minutes integer default 0,
  p_position_label text default null,
  p_notes text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_schedule public.weekly_schedules%rowtype;
  v_employee_id uuid;
  v_work_date date;
  v_segment_no smallint;
  v_created integer := 0;
begin
  select * into v_schedule
  from public.weekly_schedules
  where id = p_schedule_id;

  if v_schedule.id is null then raise exception 'Schedule not found'; end if;
  if v_schedule.status <> 'draft' then raise exception 'Only draft schedules can be edited'; end if;
  if coalesce(cardinality(p_employee_ids), 0) = 0 then raise exception 'Select at least one employee'; end if;
  if coalesce(cardinality(p_work_dates), 0) = 0 then raise exception 'Select at least one work day'; end if;
  if cardinality(p_employee_ids) > 100 then raise exception 'Select no more than 100 employees'; end if;

  foreach v_employee_id in array p_employee_ids loop
    if not exists (
      select 1 from public.employees e
      where e.id = v_employee_id
        and e.tenant_id = v_schedule.tenant_id
        and e.status <> 'terminated'
    ) then
      raise exception 'Every selected employee must be active in the schedule company';
    end if;

    foreach v_work_date in array p_work_dates loop
      if v_work_date < v_schedule.week_start or v_work_date > v_schedule.week_start + 6 then
        raise exception 'Every selected day must be within the schedule week';
      end if;

      if p_entry_type <> 'shift' then
        delete from public.schedule_entries
        where schedule_id = p_schedule_id
          and employee_id = v_employee_id
          and work_date = v_work_date;
        v_segment_no := 1;
      else
        if exists (
          select 1 from public.schedule_entries se
          where se.schedule_id = p_schedule_id
            and se.employee_id = v_employee_id
            and se.work_date = v_work_date
            and se.entry_type <> 'shift'
        ) then
          raise exception 'Remove the existing non-shift day entry before adding working hours';
        end if;
        select (coalesce(max(se.segment_no), 0) + 1)::smallint into v_segment_no
        from public.schedule_entries se
        where se.schedule_id = p_schedule_id
          and se.employee_id = v_employee_id
          and se.work_date = v_work_date;
        if v_segment_no > 10 then raise exception 'An employee cannot have more than 10 segments in one day'; end if;
      end if;

      insert into public.schedule_entries(
        tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date,
        segment_no, entry_type, shift_template_id, custom_start_time,
        custom_end_time, end_day_offset, break_minutes, position_label, notes,
        created_by
      ) values (
        v_schedule.tenant_id, v_schedule.id, v_employee_id, v_schedule.branch_id, v_work_date,
        v_segment_no, p_entry_type,
        case when p_entry_type = 'shift' then p_shift_template_id else null end,
        case when p_entry_type = 'shift' then p_custom_start_time else null end,
        case when p_entry_type = 'shift' then p_custom_end_time else null end,
        case when p_entry_type = 'shift' then p_end_day_offset else 0 end,
        case when p_entry_type = 'shift' then p_break_minutes else 0 end,
        nullif(trim(p_position_label), ''), nullif(trim(p_notes), ''), auth.uid()
      );
      v_created := v_created + 1;
    end loop;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.prevent_schedule_entry_conflicts() from public, anon, authenticated;
revoke execute on function public.bulk_assign_schedule_entries(uuid, uuid[], date[], public.schedule_entry_type, uuid, time, time, smallint, integer, text, text) from public, anon;
grant execute on function public.bulk_assign_schedule_entries(uuid, uuid[], date[], public.schedule_entry_type, uuid, time, time, smallint, integer, text, text) to authenticated;
