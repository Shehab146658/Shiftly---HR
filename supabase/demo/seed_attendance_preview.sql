-- Repeatable, realistic attendance data for the Shiftly preview tenant.
-- Only records marked with this seed's note or external-reference prefix are replaced.

do $attendance_seed$
declare
  v_tenant_id uuid;
  v_schedule_id uuid;
  v_shift_id uuid;
  v_branch record;
  v_employee record;
  v_entry record;
  v_day integer;
  v_scenario integer;
  v_source public.attendance_source;
  v_validation public.attendance_validation_status;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_week_start date := date '2026-07-31';
  v_marker constant text := 'Shiftly demo attendance seed';
begin
  select id into v_tenant_id from public.tenants where slug = 'shiftly-demo';
  if v_tenant_id is null then
    raise notice 'Shiftly demo tenant does not exist; attendance seed skipped.';
    return;
  end if;

  perform set_config('shiftly.schedule_transition', 'allowed', true);

  for v_branch in
    select id, code
    from public.branches
    where tenant_id = v_tenant_id and is_active
    order by code
  loop
    select id into v_shift_id
    from public.shift_templates
    where tenant_id = v_tenant_id and is_active and branch_id is null
      and code = case v_branch.code
        when 'GATEWAY' then '12_10'
        when 'THEONE' then '1_11'
        when 'BERRYROSE' then '11_9'
        when 'ONOVI' then '12_9'
        else '12_10'
      end
    limit 1;

    if v_shift_id is null then
      raise notice 'No demo shift found for branch %, skipping.', v_branch.code;
      continue;
    end if;

    v_schedule_id := null;
    insert into public.weekly_schedules(
      tenant_id, branch_id, week_start, status, visibility, notes,
      published_at, published_by, locked_at, locked_by
    ) values (
      v_tenant_id, v_branch.id, v_week_start, 'draft', 'branch', v_marker,
      null, null, null, null
    )
    on conflict (tenant_id, branch_id, week_start) do update
      set status = 'draft', visibility = 'branch', notes = excluded.notes,
          published_at = null, published_by = null, locked_at = null, locked_by = null
      where public.weekly_schedules.notes = v_marker
    returning id into v_schedule_id;

    if v_schedule_id is null then
      raise notice 'A non-demo schedule exists for branch % and week %, skipping.', v_branch.code, v_week_start;
      continue;
    end if;

    delete from public.schedule_entries where schedule_id = v_schedule_id;

    for v_employee in
      select id, employee_code, row_number() over (order by employee_code)::integer as ordinal
      from public.employees
      where tenant_id = v_tenant_id and branch_id = v_branch.id and status <> 'terminated'
      order by employee_code
    loop
      for v_day in 0..6 loop
        insert into public.schedule_entries(
          tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date,
          segment_no, entry_type, shift_template_id, break_minutes, position_label, notes
        ) values (
          v_tenant_id, v_schedule_id, v_employee.id, v_branch.id, v_week_start + v_day,
          1,
          case when (v_employee.ordinal + v_day) % 7 = 0 then 'off'::public.schedule_entry_type else 'shift'::public.schedule_entry_type end,
          case when (v_employee.ordinal + v_day) % 7 = 0 then null else v_shift_id end,
          0, 'Sales', v_marker
        );
      end loop;
    end loop;

    update public.weekly_schedules
    set status = 'published', published_at = now(), published_by = null
    where id = v_schedule_id;

    delete from public.schedule_status_events where schedule_id = v_schedule_id;
    insert into public.schedule_status_events(
      tenant_id, schedule_id, from_status, to_status, reason
    ) values (v_tenant_id, v_schedule_id, 'draft', 'published', v_marker);
  end loop;

  delete from public.attendance_punches
  where tenant_id = v_tenant_id and external_reference like 'demo-attendance:%';

  for v_entry in
    select
      se.employee_id,
      e.employee_code,
      se.scheduled_branch_id as branch_id,
      se.work_date,
      coalesce(st.start_time, se.custom_start_time) as start_time,
      coalesce(st.end_time, se.custom_end_time) as end_time,
      coalesce(st.end_day_offset, se.end_day_offset) as end_day_offset,
      row_number() over (order by b.code, e.employee_code, se.work_date)::integer as sample_number
    from public.schedule_entries se
    join public.weekly_schedules ws on ws.id = se.schedule_id and ws.notes = v_marker
    join public.employees e on e.id = se.employee_id
    join public.branches b on b.id = se.scheduled_branch_id
    left join public.shift_templates st on st.id = se.shift_template_id
    where se.tenant_id = v_tenant_id
      and se.entry_type = 'shift'
      and se.work_date between date '2026-08-04' and date '2026-08-06'
    order by b.code, e.employee_code, se.work_date
  loop
    v_scenario := v_entry.sample_number % 7;
    if v_scenario = 0 then
      -- No punches: this employee is an intentional absence example.
      continue;
    end if;

    v_source := case v_scenario
      when 1 then 'fingerprint'::public.attendance_source
      when 2 then 'mobile'::public.attendance_source
      when 3 then 'import'::public.attendance_source
      when 4 then 'manual'::public.attendance_source
      when 5 then 'fingerprint'::public.attendance_source
      else 'mobile'::public.attendance_source
    end;
    v_validation := case when v_scenario = 6 then 'pending'::public.attendance_validation_status else 'valid'::public.attendance_validation_status end;

    v_check_in := (v_entry.work_date + v_entry.start_time) at time zone 'Africa/Cairo';
    v_check_out := (v_entry.work_date + v_entry.end_time + (v_entry.end_day_offset * interval '1 day')) at time zone 'Africa/Cairo';

    if v_scenario = 2 then v_check_in := v_check_in + interval '17 minutes'; end if;
    if v_scenario = 3 then v_check_out := v_check_out + interval '60 minutes'; end if;
    if v_scenario = 4 then v_check_out := v_check_out - interval '40 minutes'; end if;

    insert into public.attendance_punches(
      tenant_id, employee_id, branch_id, work_date, punch_type, occurred_at,
      source, validation_status, latitude, longitude, distance_metres,
      within_geofence, selfie_path, external_reference, notes
    ) values (
      v_tenant_id, v_entry.employee_id, v_entry.branch_id, v_entry.work_date,
      'check_in', v_check_in, v_source, v_validation,
      case when v_source = 'mobile' then 30.044420 else null end,
      case when v_source = 'mobile' then 31.235712 else null end,
      case when v_validation = 'pending' then 850 when v_source = 'mobile' then 35 else null end,
      case when v_validation = 'pending' then false when v_source = 'mobile' then true else null end,
      case when v_source = 'mobile' and v_validation = 'valid' then 'demo/selfies/' || lower(v_entry.employee_code) || '-in.jpg' else null end,
      'demo-attendance:' || v_entry.employee_code || ':' || v_entry.work_date || ':in',
      case v_scenario when 2 then 'Late arrival demo' when 6 then 'Outside geofence; manager review required' else 'Attendance demo evidence' end
    );

    if v_scenario <> 5 then
      insert into public.attendance_punches(
        tenant_id, employee_id, branch_id, work_date, punch_type, occurred_at,
        source, validation_status, latitude, longitude, distance_metres,
        within_geofence, selfie_path, external_reference, notes
      ) values (
        v_tenant_id, v_entry.employee_id, v_entry.branch_id, v_entry.work_date,
        'check_out', v_check_out, v_source, v_validation,
        case when v_source = 'mobile' then 30.044420 else null end,
        case when v_source = 'mobile' then 31.235712 else null end,
        case when v_validation = 'pending' then 850 when v_source = 'mobile' then 38 else null end,
        case when v_validation = 'pending' then false when v_source = 'mobile' then true else null end,
        case when v_source = 'mobile' and v_validation = 'valid' then 'demo/selfies/' || lower(v_entry.employee_code) || '-out.jpg' else null end,
        'demo-attendance:' || v_entry.employee_code || ':' || v_entry.work_date || ':out',
        case v_scenario when 3 then 'Overtime demo' when 4 then 'Early departure demo' when 6 then 'Outside geofence; manager review required' else 'Attendance demo evidence' end
      );
    end if;
  end loop;

  perform public.refresh_attendance_period(v_tenant_id, date '2026-08-04', date '2026-08-06');
end;
$attendance_seed$;

select
  ad.work_date,
  ad.status,
  count(*) as employees,
  sum(ad.late_minutes) as late_minutes,
  sum(ad.overtime_minutes) as overtime_minutes,
  sum(ad.missing_minutes) as missing_minutes
from public.attendance_days ad
join public.tenants t on t.id = ad.tenant_id
where t.slug = 'shiftly-demo' and ad.work_date between date '2026-08-04' and date '2026-08-06'
group by ad.work_date, ad.status
order by ad.work_date, ad.status;
