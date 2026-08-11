create type public.salary_basis as enum ('monthly', 'daily', 'hourly', 'mixed', 'commission');
create type public.payroll_period_status as enum ('draft', 'calculated', 'reviewed', 'approved', 'locked', 'published', 'cancelled');
create type public.payroll_component_kind as enum ('earning', 'deduction', 'employer');
create type public.payroll_component_source as enum ('base', 'attendance', 'leave', 'adjustment', 'tax', 'insurance', 'bonus', 'loan', 'commission');

insert into public.permissions(key, description, module) values
  ('payroll.adjust', 'Create reasoned payroll additions and deductions', 'payroll'),
  ('payroll.approve', 'Review and approve payroll periods', 'payroll'),
  ('payroll.publish', 'Publish locked payroll and employee payslips', 'payroll'),
  ('payroll.settings', 'Configure payroll policies and employee compensation', 'payroll')
on conflict (key) do nothing;

create table public.payroll_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  standard_monthly_days numeric(6,2) not null default 30 check (standard_monthly_days > 0 and standard_monthly_days <= 31),
  standard_daily_hours numeric(5,2) not null default 8 check (standard_daily_hours > 0 and standard_daily_hours <= 24),
  overtime_multiplier numeric(5,2) not null default 1.50 check (overtime_multiplier between 0 and 10),
  late_deduction_multiplier numeric(5,2) not null default 1 check (late_deduction_multiplier between 0 and 10),
  absence_deduction_multiplier numeric(5,2) not null default 1 check (absence_deduction_multiplier between 0 and 10),
  round_to_digits integer not null default 2 check (round_to_digits between 0 and 4),
  tax_enabled boolean not null default false,
  insurance_enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  salary_basis public.salary_basis not null default 'monthly',
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  daily_rate numeric(14,4) check (daily_rate is null or daily_rate >= 0),
  hourly_rate numeric(14,4) check (hourly_rate is null or hourly_rate >= 0),
  fixed_allowances numeric(14,2) not null default 0 check (fixed_allowances >= 0),
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (employee_id, effective_from)
);

create unique index employee_compensation_current_idx on public.employee_compensation(employee_id) where effective_to is null;
create index employee_compensation_tenant_date_idx on public.employee_compensation(tenant_id, effective_from desc);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  period_start date not null,
  period_end date not null,
  pay_date date,
  status public.payroll_period_status not null default 'draft',
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  settings_snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (tenant_id, code),
  unique (tenant_id, period_start, period_end)
);

create index payroll_periods_tenant_status_idx on public.payroll_periods(tenant_id, status, period_end desc);

create table public.payroll_employee_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  compensation_id uuid references public.employee_compensation(id) on delete set null,
  salary_basis public.salary_basis not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  scheduled_days numeric(8,2) not null default 0,
  worked_days numeric(8,2) not null default 0,
  absence_days numeric(8,2) not null default 0,
  unpaid_leave_units numeric(8,2) not null default 0,
  scheduled_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  late_minutes integer not null default 0,
  early_departure_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  missing_minutes integer not null default 0,
  base_amount numeric(14,2) not null default 0,
  earnings_amount numeric(14,2) not null default 0,
  deductions_amount numeric(14,2) not null default 0,
  employer_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (period_id, employee_id)
);

create index payroll_results_employee_idx on public.payroll_employee_results(employee_id, period_id);

create table public.payroll_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  result_id uuid not null references public.payroll_employee_results(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  name_en text not null,
  name_ar text not null,
  kind public.payroll_component_kind not null,
  source_type public.payroll_component_source not null,
  amount numeric(14,2) not null check (amount >= 0),
  quantity numeric(14,4),
  rate numeric(14,4),
  source_reference text,
  reason text,
  taxable boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index payroll_components_result_idx on public.payroll_components(result_id, kind, source_type);

create table public.payroll_status_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  from_status public.payroll_period_status,
  to_status public.payroll_period_status not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  result_id uuid not null unique references public.payroll_employee_results(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  payslip_number text not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  unique (tenant_id, payslip_number)
);

create index payslips_employee_period_idx on public.payslips(employee_id, period_id);

create or replace function public.seed_payroll_defaults(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payroll_settings(tenant_id) values (p_tenant_id) on conflict (tenant_id) do nothing;
  insert into public.role_permissions(role_id, permission_key)
  select r.id, p.key from public.roles r cross join public.permissions p
  where r.tenant_id = p_tenant_id and p.module = 'payroll' and (
    r.name = 'owner'
    or (r.name = 'payroll_officer' and p.key in ('payroll.read', 'payroll.manage', 'payroll.adjust', 'payroll.settings'))
    or (r.name = 'accountant' and p.key in ('payroll.read', 'payroll.approve'))
    or (r.name = 'hr_admin' and p.key = 'payroll.read')
  ) on conflict do nothing;
end;
$$;

select public.seed_payroll_defaults(id) from public.tenants;

create or replace function public.after_tenant_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tenant_settings(tenant_id, settings)
  values (new.id, jsonb_build_object('attendance', jsonb_build_object('enabled_methods', jsonb_build_array('mobile'))))
  on conflict (tenant_id) do nothing;
  perform public.seed_default_roles(new.id);
  perform public.seed_egypt_leave_defaults(new.id);
  perform public.seed_egypt_2026_public_holidays(new.id);
  perform public.seed_request_defaults(new.id);
  perform public.seed_leave_approval_workflows(new.id);
  perform public.seed_payroll_defaults(new.id);
  return new;
end;
$$;

create or replace function public.validate_payroll_tenant_links()
returns trigger language plpgsql set search_path = '' as $$
declare v_tenant uuid;
begin
  if tg_table_name = 'employee_compensation' then
    select tenant_id into v_tenant from public.employees where id = new.employee_id;
  elsif tg_table_name = 'payroll_employee_results' then
    select tenant_id into v_tenant from public.payroll_periods where id = new.period_id;
    if v_tenant <> (select tenant_id from public.employees where id = new.employee_id) then raise exception 'Payroll employee belongs to another tenant'; end if;
    if new.compensation_id is not null and v_tenant <> (select tenant_id from public.employee_compensation where id = new.compensation_id) then raise exception 'Compensation belongs to another tenant'; end if;
  elsif tg_table_name = 'payroll_components' then
    select tenant_id into v_tenant from public.payroll_employee_results where id = new.result_id;
  elsif tg_table_name = 'payroll_status_events' then
    select tenant_id into v_tenant from public.payroll_periods where id = new.period_id;
  elsif tg_table_name = 'payslips' then
    select tenant_id into v_tenant from public.payroll_employee_results where id = new.result_id;
    if v_tenant <> (select tenant_id from public.employees where id = new.employee_id) or v_tenant <> (select tenant_id from public.payroll_periods where id = new.period_id) then raise exception 'Payslip links belong to another tenant'; end if;
  end if;
  if v_tenant is null or v_tenant <> new.tenant_id then raise exception 'Cross-tenant payroll relationship rejected'; end if;
  return new;
end;
$$;

create trigger validate_employee_compensation_tenant before insert or update on public.employee_compensation for each row execute function public.validate_payroll_tenant_links();
create trigger validate_payroll_results_tenant before insert or update on public.payroll_employee_results for each row execute function public.validate_payroll_tenant_links();
create trigger validate_payroll_components_tenant before insert or update on public.payroll_components for each row execute function public.validate_payroll_tenant_links();
create trigger validate_payroll_events_tenant before insert or update on public.payroll_status_events for each row execute function public.validate_payroll_tenant_links();
create trigger validate_payslips_tenant before insert or update on public.payslips for each row execute function public.validate_payroll_tenant_links();

create or replace function public.can_view_payroll_employee(p_tenant_id uuid, p_employee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_tenant_id, 'payroll.read') or public.current_employee_id(p_tenant_id) = p_employee_id;
$$;

create or replace function public.upsert_employee_compensation(
  p_employee_id uuid, p_salary_basis public.salary_basis, p_base_salary numeric,
  p_daily_rate numeric, p_hourly_rate numeric, p_fixed_allowances numeric,
  p_currency_code text, p_effective_from date, p_notes text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_employee public.employees%rowtype; v_id uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if not public.has_permission(v_employee.tenant_id, 'payroll.settings') then raise exception 'Not authorized to configure compensation'; end if;
  if p_base_salary < 0 or coalesce(p_daily_rate, 0) < 0 or coalesce(p_hourly_rate, 0) < 0 or coalesce(p_fixed_allowances, 0) < 0 then raise exception 'Compensation values cannot be negative'; end if;
  update public.employee_compensation set effective_to = p_effective_from - 1
  where employee_id = p_employee_id and effective_to is null and effective_from < p_effective_from;
  insert into public.employee_compensation(tenant_id, employee_id, salary_basis, base_salary, daily_rate, hourly_rate, fixed_allowances, currency_code, effective_from, notes, created_by)
  values (v_employee.tenant_id, p_employee_id, p_salary_basis, p_base_salary, p_daily_rate, p_hourly_rate, coalesce(p_fixed_allowances, 0), upper(p_currency_code), p_effective_from, nullif(trim(p_notes), ''), auth.uid())
  on conflict (employee_id, effective_from) do update set salary_basis = excluded.salary_basis, base_salary = excluded.base_salary, daily_rate = excluded.daily_rate, hourly_rate = excluded.hourly_rate, fixed_allowances = excluded.fixed_allowances, currency_code = excluded.currency_code, notes = excluded.notes
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_payroll_period(p_tenant_id uuid, p_code text, p_name text, p_start date, p_end date, p_pay_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_currency text;
begin
  if not public.has_permission(p_tenant_id, 'payroll.manage') then raise exception 'Not authorized to create payroll'; end if;
  if p_end < p_start then raise exception 'Payroll end date must be on or after the start date'; end if;
  if exists (select 1 from public.payroll_periods where tenant_id = p_tenant_id and status <> 'cancelled' and daterange(period_start, period_end, '[]') && daterange(p_start, p_end, '[]')) then raise exception 'Payroll period overlaps an existing period'; end if;
  select currency_code into v_currency from public.payroll_settings where tenant_id = p_tenant_id;
  insert into public.payroll_periods(tenant_id, code, name, period_start, period_end, pay_date, currency_code, created_by)
  values (p_tenant_id, lower(trim(p_code)), trim(p_name), p_start, p_end, p_pay_date, coalesce(v_currency, 'EGP'), auth.uid()) returning id into v_id;
  insert into public.payroll_status_events(tenant_id, period_id, to_status, actor_user_id, note) values (p_tenant_id, v_id, 'draft', auth.uid(), 'Payroll period created');
  return v_id;
end;
$$;

create or replace function public.recalculate_payroll_result_totals(p_result_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_result public.payroll_employee_results%rowtype; v_earn numeric; v_deduct numeric; v_employer numeric;
begin
  select * into v_result from public.payroll_employee_results where id = p_result_id;
  if v_result.id is null then raise exception 'Payroll result not found'; end if;
  select coalesce(sum(amount) filter (where kind = 'earning'), 0), coalesce(sum(amount) filter (where kind = 'deduction'), 0), coalesce(sum(amount) filter (where kind = 'employer'), 0)
  into v_earn, v_deduct, v_employer from public.payroll_components where result_id = p_result_id;
  update public.payroll_employee_results set earnings_amount = v_earn, deductions_amount = v_deduct, employer_amount = v_employer, gross_amount = v_earn, net_amount = v_earn - v_deduct where id = p_result_id;
end;
$$;

create or replace function public.calculate_payroll_period(p_period_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_period public.payroll_periods%rowtype; v_settings public.payroll_settings%rowtype; v_employee public.employees%rowtype; v_comp public.employee_compensation%rowtype;
  v_result_id uuid; v_count integer := 0; v_scheduled_days numeric; v_worked_days numeric; v_absence_days numeric; v_unpaid_leave numeric;
  v_scheduled_minutes integer; v_worked_minutes integer; v_late integer; v_early integer; v_overtime integer; v_missing integer;
  v_hourly numeric; v_daily numeric; v_base numeric; v_overtime_amount numeric; v_time_deduction numeric; v_absence_deduction numeric; v_leave_deduction numeric; v_digits integer;
begin
  select * into v_period from public.payroll_periods where id = p_period_id for update;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if not public.has_permission(v_period.tenant_id, 'payroll.manage') then raise exception 'Not authorized to calculate payroll'; end if;
  if v_period.status in ('approved', 'locked', 'published', 'cancelled') then raise exception 'This payroll period can no longer be recalculated'; end if;
  select * into v_settings from public.payroll_settings where tenant_id = v_period.tenant_id;
  v_digits := coalesce(v_settings.round_to_digits, 2);
  for v_employee in select * from public.employees e where e.tenant_id = v_period.tenant_id and e.status <> 'terminated' and (e.hire_date is null or e.hire_date <= v_period.period_end) order by e.name_en loop
    select * into v_comp from public.employee_compensation c where c.employee_id = v_employee.id and c.effective_from <= v_period.period_end and (c.effective_to is null or c.effective_to >= v_period.period_start) order by c.effective_from desc limit 1;
    if v_comp.id is null then continue; end if;
    select coalesce(count(*),0), coalesce(count(*) filter (where status in ('present','late')),0), coalesce(count(*) filter (where status = 'absent'),0),
      coalesce(sum(scheduled_minutes),0), coalesce(sum(actual_minutes),0), coalesce(sum(late_minutes),0), coalesce(sum(early_departure_minutes),0), coalesce(sum(overtime_minutes),0), coalesce(sum(missing_minutes),0)
    into v_scheduled_days, v_worked_days, v_absence_days, v_scheduled_minutes, v_worked_minutes, v_late, v_early, v_overtime, v_missing
    from public.attendance_days where employee_id = v_employee.id and work_date between v_period.period_start and v_period.period_end and status <> 'off';
    select coalesce(sum(d.units * (100 - coalesce(d.pay_percentage, 100)) / 100),0) into v_unpaid_leave
    from public.leave_request_days d join public.leave_requests r on r.id = d.request_id
    where d.employee_id = v_employee.id and d.leave_date between v_period.period_start and v_period.period_end and r.status = 'approved';
    v_hourly := coalesce(v_comp.hourly_rate, v_comp.daily_rate / nullif(v_settings.standard_daily_hours,0), v_comp.base_salary / nullif(v_settings.standard_monthly_days * v_settings.standard_daily_hours,0), 0);
    v_daily := coalesce(v_comp.daily_rate, v_comp.hourly_rate * v_settings.standard_daily_hours, v_comp.base_salary / nullif(v_settings.standard_monthly_days,0), 0);
    v_base := case v_comp.salary_basis when 'monthly' then v_comp.base_salary when 'daily' then v_daily * greatest(0, v_scheduled_days - v_absence_days - v_unpaid_leave) when 'hourly' then v_hourly * v_worked_minutes / 60 when 'mixed' then v_comp.base_salary when 'commission' then v_comp.base_salary end + v_comp.fixed_allowances;
    v_overtime_amount := v_hourly * v_overtime / 60 * v_settings.overtime_multiplier;
    v_time_deduction := v_hourly * (v_late + v_early + v_missing) / 60 * v_settings.late_deduction_multiplier;
    v_absence_deduction := case when v_comp.salary_basis in ('monthly','mixed','commission') then v_daily * v_absence_days * v_settings.absence_deduction_multiplier else 0 end;
    v_leave_deduction := case when v_comp.salary_basis in ('monthly','mixed','commission') then v_daily * v_unpaid_leave else 0 end;
    v_base := round(v_base, v_digits); v_overtime_amount := round(v_overtime_amount, v_digits); v_time_deduction := round(v_time_deduction, v_digits); v_absence_deduction := round(v_absence_deduction, v_digits); v_leave_deduction := round(v_leave_deduction, v_digits);
    insert into public.payroll_employee_results(tenant_id, period_id, employee_id, compensation_id, salary_basis, currency_code, scheduled_days, worked_days, absence_days, unpaid_leave_units, scheduled_minutes, worked_minutes, late_minutes, early_departure_minutes, overtime_minutes, missing_minutes, base_amount, calculation_snapshot, calculated_at)
    values (v_period.tenant_id, v_period.id, v_employee.id, v_comp.id, v_comp.salary_basis, v_comp.currency_code, v_scheduled_days, v_worked_days, v_absence_days, v_unpaid_leave, v_scheduled_minutes, v_worked_minutes, v_late, v_early, v_overtime, v_missing, v_base, jsonb_build_object('compensation', to_jsonb(v_comp), 'settings', to_jsonb(v_settings)), now())
    on conflict (period_id, employee_id) do update set compensation_id = excluded.compensation_id, salary_basis = excluded.salary_basis, currency_code = excluded.currency_code, scheduled_days = excluded.scheduled_days, worked_days = excluded.worked_days, absence_days = excluded.absence_days, unpaid_leave_units = excluded.unpaid_leave_units, scheduled_minutes = excluded.scheduled_minutes, worked_minutes = excluded.worked_minutes, late_minutes = excluded.late_minutes, early_departure_minutes = excluded.early_departure_minutes, overtime_minutes = excluded.overtime_minutes, missing_minutes = excluded.missing_minutes, base_amount = excluded.base_amount, calculation_snapshot = excluded.calculation_snapshot, calculated_at = now()
    returning id into v_result_id;
    delete from public.payroll_components where result_id = v_result_id and source_type <> 'adjustment';
    if v_base > 0 then insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,source_reference) values (v_period.tenant_id,v_result_id,'base_pay','Base pay and fixed allowances','الأجر الأساسي والبدلات الثابتة','earning','base',v_base,v_comp.id::text); end if;
    if v_overtime_amount > 0 then insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate) values (v_period.tenant_id,v_result_id,'overtime','Approved overtime','الوقت الإضافي المعتمد','earning','attendance',v_overtime_amount,v_overtime/60.0,v_hourly*v_settings.overtime_multiplier); end if;
    if v_time_deduction > 0 then insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate) values (v_period.tenant_id,v_result_id,'attendance_time','Late, early departure, and missing time','التأخير والانصراف المبكر والوقت الناقص','deduction','attendance',v_time_deduction,(v_late+v_early+v_missing)/60.0,v_hourly*v_settings.late_deduction_multiplier); end if;
    if v_absence_deduction > 0 then insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate) values (v_period.tenant_id,v_result_id,'absence','Absence deduction','خصم الغياب','deduction','attendance',v_absence_deduction,v_absence_days,v_daily*v_settings.absence_deduction_multiplier); end if;
    if v_leave_deduction > 0 then insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate) values (v_period.tenant_id,v_result_id,'unpaid_leave','Unpaid leave deduction','خصم الإجازة غير المدفوعة','deduction','leave',v_leave_deduction,v_unpaid_leave,v_daily); end if;
    perform public.recalculate_payroll_result_totals(v_result_id); v_count := v_count + 1;
  end loop;
  update public.payroll_periods set status = 'calculated', settings_snapshot = to_jsonb(v_settings), calculated_at = now(), updated_at = now() where id = v_period.id;
  insert into public.payroll_status_events(tenant_id,period_id,from_status,to_status,actor_user_id,note) values (v_period.tenant_id,v_period.id,v_period.status,'calculated',auth.uid(),format('Calculated %s employees',v_count));
  return v_count;
end;
$$;

create or replace function public.add_payroll_adjustment(p_result_id uuid, p_kind public.payroll_component_kind, p_code text, p_name_en text, p_name_ar text, p_amount numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_result public.payroll_employee_results%rowtype; v_period public.payroll_periods%rowtype; v_id uuid;
begin
  select * into v_result from public.payroll_employee_results where id = p_result_id; select * into v_period from public.payroll_periods where id = v_result.period_id;
  if v_result.id is null then raise exception 'Payroll result not found'; end if;
  if not public.has_permission(v_result.tenant_id, 'payroll.adjust') then raise exception 'Not authorized to adjust payroll'; end if;
  if v_period.status not in ('calculated','reviewed') then raise exception 'Adjustments are allowed only during calculation or review'; end if;
  if p_kind = 'employer' then raise exception 'Manual employee adjustments must be an earning or deduction'; end if;
  if p_amount <= 0 or length(trim(p_reason)) < 2 then raise exception 'A positive amount and reason are required'; end if;
  insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,reason,created_by)
  values (v_result.tenant_id,v_result.id,lower(trim(p_code)),trim(p_name_en),trim(p_name_ar),p_kind,'adjustment',p_amount,trim(p_reason),auth.uid()) returning id into v_id;
  perform public.recalculate_payroll_result_totals(v_result.id); return v_id;
end;
$$;

create or replace function public.delete_payroll_adjustment(p_component_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_component public.payroll_components%rowtype; v_period_status public.payroll_period_status;
begin
  select * into v_component from public.payroll_components where id = p_component_id;
  if v_component.id is null or v_component.source_type <> 'adjustment' then raise exception 'Manual adjustment not found'; end if;
  if not public.has_permission(v_component.tenant_id, 'payroll.adjust') then raise exception 'Not authorized to adjust payroll'; end if;
  select p.status into v_period_status from public.payroll_employee_results r join public.payroll_periods p on p.id=r.period_id where r.id=v_component.result_id;
  if v_period_status not in ('calculated','reviewed') then raise exception 'This adjustment is locked'; end if;
  delete from public.payroll_components where id = v_component.id; perform public.recalculate_payroll_result_totals(v_component.result_id);
end;
$$;

create or replace function public.transition_payroll_period(p_period_id uuid, p_target public.payroll_period_status, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_period public.payroll_periods%rowtype;
begin
  select * into v_period from public.payroll_periods where id = p_period_id for update;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if p_target = 'reviewed' and v_period.status = 'calculated' then
    if not public.has_permission(v_period.tenant_id,'payroll.manage') then raise exception 'Not authorized to submit payroll review'; end if;
    update public.payroll_periods set status='reviewed',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() where id=v_period.id;
  elsif p_target = 'approved' and v_period.status = 'reviewed' then
    if not public.has_permission(v_period.tenant_id,'payroll.approve') and not public.is_tenant_owner(v_period.tenant_id) then raise exception 'Not authorized to approve payroll'; end if;
    update public.payroll_periods set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now() where id=v_period.id;
  elsif p_target = 'locked' and v_period.status = 'approved' then
    if not public.has_permission(v_period.tenant_id,'payroll.manage') and not public.is_tenant_owner(v_period.tenant_id) then raise exception 'Not authorized to lock payroll'; end if;
    update public.payroll_periods set status='locked',locked_at=now(),locked_by=auth.uid(),updated_at=now() where id=v_period.id;
  elsif p_target = 'published' and v_period.status = 'locked' then
    if not public.has_permission(v_period.tenant_id,'payroll.publish') and not public.is_tenant_owner(v_period.tenant_id) then raise exception 'Not authorized to publish payroll'; end if;
    update public.payroll_periods set status='published',published_at=now(),published_by=auth.uid(),updated_at=now() where id=v_period.id;
    insert into public.payslips(tenant_id,result_id,employee_id,period_id,payslip_number,published_by)
    select r.tenant_id,r.id,r.employee_id,r.period_id,upper(v_period.code)||'-'||e.employee_code,auth.uid() from public.payroll_employee_results r join public.employees e on e.id=r.employee_id where r.period_id=v_period.id on conflict (result_id) do nothing;
  elsif p_target = 'cancelled' and v_period.status in ('draft','calculated') then
    if not public.has_permission(v_period.tenant_id,'payroll.manage') then raise exception 'Not authorized to cancel payroll'; end if;
    if length(trim(p_note)) < 2 then raise exception 'A cancellation reason is required'; end if;
    update public.payroll_periods set status='cancelled',updated_at=now() where id=v_period.id;
  else raise exception 'Invalid payroll transition from % to %',v_period.status,p_target;
  end if;
  insert into public.payroll_status_events(tenant_id,period_id,from_status,to_status,actor_user_id,note) values (v_period.tenant_id,v_period.id,v_period.status,p_target,auth.uid(),nullif(trim(p_note),''));
end;
$$;

create or replace function public.acknowledge_payslip(p_payslip_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.payslips set acknowledged_at=coalesce(acknowledged_at,now()) where id=p_payslip_id and employee_id=public.current_employee_id(tenant_id);
$$;

create trigger payroll_settings_updated_at before update on public.payroll_settings for each row execute function public.set_updated_at();
create trigger payroll_periods_updated_at before update on public.payroll_periods for each row execute function public.set_updated_at();
create trigger audit_payroll_settings after insert or update or delete on public.payroll_settings for each row execute function public.capture_audit_log();
create trigger audit_employee_compensation after insert or update or delete on public.employee_compensation for each row execute function public.capture_audit_log();
create trigger audit_payroll_periods after insert or update or delete on public.payroll_periods for each row execute function public.capture_audit_log();
create trigger audit_payroll_components after insert or update or delete on public.payroll_components for each row execute function public.capture_audit_log();

alter table public.payroll_settings enable row level security;
alter table public.employee_compensation enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_employee_results enable row level security;
alter table public.payroll_components enable row level security;
alter table public.payroll_status_events enable row level security;
alter table public.payslips enable row level security;

create policy payroll_settings_read on public.payroll_settings for select to authenticated using (public.has_permission(tenant_id,'payroll.read'));
create policy payroll_settings_manage on public.payroll_settings for update to authenticated using (public.has_permission(tenant_id,'payroll.settings')) with check (public.has_permission(tenant_id,'payroll.settings'));
create policy compensation_read on public.employee_compensation for select to authenticated using (public.can_view_payroll_employee(tenant_id,employee_id));
create policy compensation_manage on public.employee_compensation for all to authenticated using (public.has_permission(tenant_id,'payroll.settings')) with check (public.has_permission(tenant_id,'payroll.settings'));
create policy payroll_periods_read on public.payroll_periods for select to authenticated using (public.has_permission(tenant_id,'payroll.read') or (status='published' and public.is_tenant_member(tenant_id)));
create policy payroll_periods_manage on public.payroll_periods for all to authenticated using (public.has_permission(tenant_id,'payroll.manage')) with check (public.has_permission(tenant_id,'payroll.manage'));
create policy payroll_results_read on public.payroll_employee_results for select to authenticated using (public.has_permission(tenant_id,'payroll.read') or (employee_id=public.current_employee_id(tenant_id) and exists(select 1 from public.payroll_periods p where p.id=period_id and p.status='published')));
create policy payroll_components_read on public.payroll_components for select to authenticated using (exists(select 1 from public.payroll_employee_results r where r.id=result_id and (public.has_permission(r.tenant_id,'payroll.read') or (r.employee_id=public.current_employee_id(r.tenant_id) and exists(select 1 from public.payroll_periods p where p.id=r.period_id and p.status='published')))));
create policy payroll_events_read on public.payroll_status_events for select to authenticated using (public.has_permission(tenant_id,'payroll.read'));
create policy payslips_read on public.payslips for select to authenticated using (public.has_permission(tenant_id,'payroll.read') or employee_id=public.current_employee_id(tenant_id));

grant select on public.payroll_settings, public.employee_compensation, public.payroll_periods, public.payroll_employee_results, public.payroll_components, public.payroll_status_events, public.payslips to authenticated;
grant update on public.payroll_settings to authenticated;
grant all on public.payroll_settings, public.employee_compensation, public.payroll_periods, public.payroll_employee_results, public.payroll_components, public.payroll_status_events, public.payslips to service_role;

grant execute on function public.upsert_employee_compensation(uuid,public.salary_basis,numeric,numeric,numeric,numeric,text,date,text) to authenticated;
grant execute on function public.create_payroll_period(uuid,text,text,date,date,date) to authenticated;
grant execute on function public.calculate_payroll_period(uuid) to authenticated;
grant execute on function public.add_payroll_adjustment(uuid,public.payroll_component_kind,text,text,text,numeric,text) to authenticated;
grant execute on function public.delete_payroll_adjustment(uuid) to authenticated;
grant execute on function public.transition_payroll_period(uuid,public.payroll_period_status,text) to authenticated;
grant execute on function public.acknowledge_payslip(uuid) to authenticated;

revoke execute on function public.seed_payroll_defaults(uuid) from public,anon,authenticated;
revoke execute on function public.validate_payroll_tenant_links() from public,anon,authenticated;
revoke execute on function public.can_view_payroll_employee(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.recalculate_payroll_result_totals(uuid) from public,anon,authenticated;
revoke execute on function public.upsert_employee_compensation(uuid,public.salary_basis,numeric,numeric,numeric,numeric,text,date,text) from public,anon;
revoke execute on function public.create_payroll_period(uuid,text,text,date,date,date) from public,anon;
revoke execute on function public.calculate_payroll_period(uuid) from public,anon;
revoke execute on function public.add_payroll_adjustment(uuid,public.payroll_component_kind,text,text,text,numeric,text) from public,anon;
revoke execute on function public.delete_payroll_adjustment(uuid) from public,anon;
revoke execute on function public.transition_payroll_period(uuid,public.payroll_period_status,text) from public,anon;
revoke execute on function public.acknowledge_payslip(uuid) from public,anon;
