-- Hourly staff are already paid from actual worked minutes, so attendance-time
-- deductions would charge the same missing time twice.
alter function public.calculate_payroll_period(uuid) rename to calculate_payroll_period_legacy;

create or replace function public.calculate_payroll_period(p_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_result_id uuid;
begin
  v_count := public.calculate_payroll_period_legacy(p_period_id);
  for v_result_id in
    delete from public.payroll_components c
    using public.payroll_employee_results r
    where c.result_id = r.id
      and r.period_id = p_period_id
      and r.salary_basis = 'hourly'
      and c.source_type = 'attendance'
      and c.code = 'attendance_time'
    returning c.result_id
  loop
    perform public.recalculate_payroll_result_totals(v_result_id);
  end loop;
  return v_count;
end;
$$;

grant execute on function public.calculate_payroll_period(uuid) to authenticated;
revoke execute on function public.calculate_payroll_period(uuid) from public,anon;
revoke execute on function public.calculate_payroll_period_legacy(uuid) from public,anon,authenticated;
