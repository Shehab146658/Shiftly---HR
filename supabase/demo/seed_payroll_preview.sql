-- Repeatable anonymized compensation for the Shiftly preview tenant.
-- Existing employee compensation is never overwritten.

do $payroll_seed$
declare
  v_tenant_id uuid;
  v_employee record;
  v_basis public.salary_basis;
begin
  select id into v_tenant_id from public.tenants where slug = 'shiftly-demo';
  if v_tenant_id is null then
    raise notice 'Shiftly demo tenant does not exist; payroll seed skipped.';
    return;
  end if;

  for v_employee in
    select id, employee_code, row_number() over (order by employee_code)::integer as ordinal
    from public.employees
    where tenant_id = v_tenant_id and status <> 'terminated'
    order by employee_code
  loop
    if exists (select 1 from public.employee_compensation where employee_id = v_employee.id) then
      continue;
    end if;
    v_basis := case v_employee.ordinal % 5
      when 1 then 'monthly'::public.salary_basis
      when 2 then 'daily'::public.salary_basis
      when 3 then 'hourly'::public.salary_basis
      when 4 then 'mixed'::public.salary_basis
      else 'commission'::public.salary_basis
    end;
    insert into public.employee_compensation(
      tenant_id, employee_id, salary_basis, base_salary, daily_rate, hourly_rate,
      fixed_allowances, currency_code, effective_from, notes
    ) values (
      v_tenant_id, v_employee.id, v_basis,
      case when v_basis in ('daily','hourly') then 0 else 8000 + v_employee.ordinal * 450 end,
      case when v_basis = 'daily' then 360 + v_employee.ordinal * 10 else null end,
      case when v_basis = 'hourly' then 48 + v_employee.ordinal * 2 else null end,
      case when v_employee.ordinal % 3 = 0 then 500 else 0 end,
      'EGP', date '2026-01-01', 'Anonymized Shiftly preview compensation'
    );
  end loop;
end;
$payroll_seed$;
