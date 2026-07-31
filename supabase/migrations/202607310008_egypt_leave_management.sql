-- Egyptian leave management under Labour Law No. 14 of 2025.

create type public.leave_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.leave_day_part as enum ('full', 'first_half', 'second_half', 'hours');
create type public.leave_transaction_kind as enum ('adjustment', 'carryover', 'settlement', 'holiday_credit', 'leave_usage', 'reversal');
create type public.leave_approval_stage as enum ('manager_review', 'owner_review', 'completed');
create type public.leave_approval_decision as enum ('approved', 'rejected');

alter table public.employees
  add column birth_date date,
  add column gender text not null default 'unspecified' check (gender in ('female', 'male', 'unspecified')),
  add column prior_service_years numeric(6,2) not null default 0 check (prior_service_years >= 0),
  add column is_person_with_disability boolean not null default false,
  add column is_dwarf boolean not null default false,
  add column works_hazardous boolean not null default false,
  add column works_unhealthy boolean not null default false,
  add column works_remote_location boolean not null default false;

alter table public.branches
  add column weekly_rest_isodows smallint[] not null default array[5]::smallint[],
  add column is_industrial_establishment boolean not null default false,
  add constraint branches_weekly_rest_isodows_valid check (
    cardinality(weekly_rest_isodows) between 1 and 6
    and weekly_rest_isodows <@ array[1,2,3,4,5,6,7]::smallint[]
  );

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  name_en text not null,
  name_ar text not null,
  legal_article text,
  legal_summary_en text,
  legal_summary_ar text,
  balance_code text,
  paid boolean not null default true,
  default_pay_percentage numeric(5,2) check (default_pay_percentage is null or default_pay_percentage between 0 and 100),
  counts_calendar_days boolean not null default false,
  requires_document boolean not null default false,
  requires_reason boolean not null default true,
  min_notice_days integer not null default 0 check (min_notice_days between 0 and 365),
  max_days_per_request numeric(8,2) check (max_days_per_request is null or max_days_per_request > 0),
  max_occurrences_lifetime integer check (max_occurrences_lifetime is null or max_occurrences_lifetime > 0),
  rules jsonb not null default '{}'::jsonb,
  is_statutory boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  holiday_date date not null,
  name_en text not null,
  name_ar text not null,
  religious_scope text not null default 'all' check (religious_scope in ('all', 'muslim', 'non_muslim')),
  source_reference text,
  is_paid boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, holiday_date, religious_scope)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  day_part public.leave_day_part not null default 'full',
  requested_minutes integer check (requested_minutes is null or requested_minutes between 1 and 720),
  requested_units numeric(8,2) not null check (requested_units > 0),
  reason text,
  supporting_document_path text,
  expected_delivery_date date,
  actual_delivery_date date,
  status public.leave_request_status not null default 'pending',
  approval_stage public.leave_approval_stage not null default 'manager_review',
  compliance_flags jsonb not null default '[]'::jsonb,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((day_part = 'hours' and requested_minutes is not null and start_date = end_date) or (day_part <> 'hours' and requested_minutes is null)),
  check (day_part = 'full' or start_date = end_date)
);

create table public.leave_request_days (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.leave_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_date date not null,
  units numeric(5,2) not null check (units > 0 and units <= 1.5),
  pay_percentage numeric(5,2) check (pay_percentage is null or pay_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  unique (request_id, leave_date)
);

create table public.leave_approval_actions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.leave_requests(id) on delete cascade,
  stage public.leave_approval_stage not null check (stage <> 'completed'),
  decision public.leave_approval_decision not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  acted_at timestamptz not null default now(),
  unique (request_id, stage)
);

create table public.leave_balance_transactions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  balance_code text not null check (balance_code ~ '^[a-z0-9_]{2,60}$'),
  leave_year integer not null check (leave_year between 2000 and 2200),
  kind public.leave_transaction_kind not null,
  units numeric(9,2) not null check (units <> 0),
  request_id uuid references public.leave_requests(id) on delete set null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index leave_types_tenant_active_idx on public.leave_types(tenant_id, is_active, code);
create index public_holidays_tenant_date_idx on public.public_holidays(tenant_id, holiday_date);
create index leave_requests_tenant_status_idx on public.leave_requests(tenant_id, status, start_date desc);
create index leave_requests_employee_date_idx on public.leave_requests(employee_id, start_date desc, end_date desc);
create index leave_request_days_employee_date_idx on public.leave_request_days(employee_id, leave_date);
create index leave_approval_actions_request_idx on public.leave_approval_actions(request_id, acted_at);
create index leave_balance_transactions_employee_year_idx on public.leave_balance_transactions(employee_id, leave_year, balance_code);

insert into public.permissions(key, description, module) values
  ('leave.read', 'View personal leave requests and balances', 'leave'),
  ('leave.read_all', 'View company leave requests and balances', 'leave'),
  ('leave.request', 'Submit and cancel personal leave requests', 'leave'),
  ('leave.approve', 'Approve or reject leave requests', 'leave'),
  ('leave.manage', 'Manage leave policies, holidays, balances, and overrides', 'leave')
on conflict (key) do nothing;

create or replace function public.seed_egypt_leave_defaults(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.leave_types(
    tenant_id, code, name_en, name_ar, legal_article, legal_summary_en, legal_summary_ar,
    balance_code, paid, default_pay_percentage, counts_calendar_days, requires_document,
    min_notice_days, max_days_per_request, max_occurrences_lifetime, rules
  ) values
    (p_tenant_id, 'annual', 'Annual leave', 'الإجازة السنوية', 'Labour Law 14/2025, Arts. 124-125', '15 days in year one, 21 from year two, 30 after ten service years or age 50, and 45 for persons with disabilities or dwarfs; seven extra days apply to hazardous, unhealthy, or remote work.', '15 يومًا في السنة الأولى، و21 يومًا من السنة الثانية، و30 يومًا بعد عشر سنوات خدمة أو بلوغ سن الخمسين، و45 يومًا للأشخاص ذوي الإعاقة والأقزام، مع إضافة سبعة أيام للأعمال الخطرة أو الضارة أو المناطق النائية.', 'annual', true, 100, false, false, 0, null, null, '{"minimum_annual_use":15,"minimum_consecutive":6,"settlement_years":3}'::jsonb),
    (p_tenant_id, 'emergency', 'Emergency leave', 'الإجازة العارضة', 'Art. 128', 'Up to seven days per year, no more than two days per occurrence, deducted from annual leave.', 'حتى سبعة أيام سنويًا وبحد أقصى يومين في المرة الواحدة وتخصم من رصيد الإجازة السنوية.', 'annual', true, 100, false, false, 0, 2, null, '{"annual_limit":7}'::jsonb),
    (p_tenant_id, 'exam', 'Exam leave', 'إجازة الامتحانات', 'Art. 126', 'Paid actual exam days, outside annual balance, with ten days notice and proof of attendance.', 'أيام الامتحان الفعلية بأجر كامل ولا تخصم من الرصيد السنوي مع إخطار قبل عشرة أيام وإثبات الحضور.', null, true, 100, false, true, 10, null, null, '{}'::jsonb),
    (p_tenant_id, 'child_birth', 'Child birth day', 'إجازة يوم ولادة الطفل', 'Art. 128', 'One paid day on the birth of a child, no more than three times during total service.', 'يوم مدفوع الأجر عند ولادة طفل وبحد أقصى ثلاث مرات طوال مدة الخدمة.', null, true, 100, true, true, 0, 1, 3, '{}'::jsonb),
    (p_tenant_id, 'public_holiday_substitute', 'Substitute public-holiday day', 'يوم بديل عن عطلة رسمية', 'Art. 129 and Ministerial Decision 294/2025', 'A substitute day may be granted on the employee’s written request after working an official holiday.', 'يجوز منح يوم بديل بناءً على طلب كتابي من العامل عند تشغيله في عطلة رسمية.', 'holiday_credit', true, 100, false, false, 0, null, null, '{}'::jsonb),
    (p_tenant_id, 'hajj_jerusalem', 'Hajj or Jerusalem leave', 'إجازة الحج أو زيارة القدس', 'Art. 130', 'One paid month after five consecutive years with the same employer, once during service.', 'شهر بأجر كامل بعد خمس سنوات متصلة لدى صاحب العمل ولمرة واحدة طوال الخدمة.', null, true, 100, true, true, 15, 31, 1, '{"minimum_service_years":5}'::jsonb),
    (p_tenant_id, 'sick', 'Sick leave', 'الإجازة المرضية', 'Arts. 131 and 173', 'Duration is certified by the competent medical authority; compensation follows Social Insurance and Pensions Law 148/2019.', 'تحدد مدتها الجهة الطبية المختصة ويصرف التعويض وفقًا لقانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019.', null, true, null, true, true, 0, null, null, '{"payroll_rule":"social_insurance"}'::jsonb),
    (p_tenant_id, 'industrial_sick', 'Industrial establishment sick leave', 'الإجازة المرضية للمنشآت الصناعية', 'Art. 131', 'Per three service years: 90 days at 100%, 180 days at 85%, then 90 days at 75%, subject to medical certification and likely recovery.', 'خلال كل ثلاث سنوات خدمة: ثلاثة أشهر بأجر كامل ثم ستة أشهر بنسبة 85% ثم ثلاثة أشهر بنسبة 75% وفقًا للشهادة الطبية واحتمال الشفاء.', null, true, 100, true, true, 0, 360, null, '{"tiers":[{"days":90,"pay":100},{"days":180,"pay":85},{"days":90,"pay":75}]}'::jsonb),
    (p_tenant_id, 'contagious_contact', 'Contagious-disease contact leave', 'إجازة مخالطة مريض بمرض معدٍ', 'Art. 132', 'The competent medical authority may prevent work for up to three months.', 'يجوز للجهة الطبية المختصة منع العامل من العمل لمدة لا تتجاوز ثلاثة أشهر.', null, true, null, true, true, 0, 92, null, '{}'::jsonb),
    (p_tenant_id, 'maternity', 'Maternity leave', 'إجازة الوضع', 'Arts. 54-55', 'Four paid months including at least 45 days after delivery, no more than three times during employment.', 'أربعة أشهر بأجر كامل تشمل 45 يومًا على الأقل بعد الوضع وبحد أقصى ثلاث مرات طوال مدة الخدمة.', null, true, 100, true, true, 0, 123, 3, '{"minimum_post_delivery_days":45,"gender":"female"}'::jsonb),
    (p_tenant_id, 'childcare_unpaid', 'Unpaid childcare leave', 'إجازة رعاية الطفل بدون أجر', 'Art. 57', 'Up to two years, no more than three times, for eligible women in establishments with at least 50 workers after one year of service.', 'حتى سنتين وبدون أجر وبحد أقصى ثلاث مرات للعاملات المستحقات في المنشآت التي يعمل بها خمسون عاملًا فأكثر وبعد سنة خدمة.', null, false, 0, true, true, 0, 731, 3, '{"minimum_service_years":1,"minimum_workers":50,"minimum_gap_years":2,"gender":"female"}'::jsonb),
    (p_tenant_id, 'unpaid', 'Unpaid leave', 'إجازة بدون أجر', null, 'Configurable company-approved unpaid leave.', 'إجازة بدون أجر وفق سياسة الشركة وموافقتها.', null, false, 0, false, false, 0, null, null, '{}'::jsonb),
    (p_tenant_id, 'other_paid', 'Other paid leave', 'إجازة أخرى بأجر', null, 'A configurable company benefit that does not reduce statutory annual leave.', 'ميزة إضافية قابلة للضبط من الشركة ولا تخصم من الرصيد السنوي القانوني.', null, true, 100, false, false, 0, null, null, '{}'::jsonb)
  on conflict (tenant_id, code) do nothing;
end;
$$;

create or replace function public.seed_egypt_2026_public_holidays(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.public_holidays(
    tenant_id, holiday_date, name_en, name_ar, religious_scope, source_reference, is_paid
  ) values
    (p_tenant_id, date '2026-01-07', 'Coptic Christmas Day', 'عيد الميلاد المجيد', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-01-29', 'January 25 Revolution and National Police Day', 'ثورة 25 يناير وعيد الشرطة', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-03-19', 'Eid Al-Fitr holiday', 'إجازة عيد الفطر', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-03-20', 'Eid Al-Fitr holiday', 'إجازة عيد الفطر', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-03-21', 'Eid Al-Fitr holiday', 'إجازة عيد الفطر', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-03-22', 'Eid Al-Fitr holiday', 'إجازة عيد الفطر', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-03-23', 'Eid Al-Fitr holiday', 'إجازة عيد الفطر', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-04-13', 'Sham El-Nessim', 'شم النسيم', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-04-25', 'Sinai Liberation Day', 'عيد تحرير سيناء', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-07', 'Labour Day holiday', 'إجازة عيد العمال', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-26', 'Arafat Day', 'وقفة عرفات', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-27', 'Eid Al-Adha holiday', 'إجازة عيد الأضحى', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-28', 'Eid Al-Adha holiday', 'إجازة عيد الأضحى', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-29', 'Eid Al-Adha holiday', 'إجازة عيد الأضحى', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-30', 'Eid Al-Adha holiday', 'إجازة عيد الأضحى', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-05-31', 'Eid Al-Adha holiday', 'إجازة عيد الأضحى', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-06-18', 'Islamic New Year', 'رأس السنة الهجرية', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-07-02', 'June 30 Revolution holiday', 'إجازة ذكرى ثورة 30 يونيو', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-07-23', 'July 23 Revolution Day', 'عيد ثورة 23 يوليو', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-08-26', 'Prophet Muhammad''s Birthday', 'المولد النبوي الشريف', 'all', 'Presidency of Egypt - National Holidays 2026', true),
    (p_tenant_id, date '2026-10-06', 'Armed Forces Day', 'عيد القوات المسلحة', 'all', 'Presidency of Egypt - National Holidays 2026', true)
  on conflict (tenant_id, holiday_date, religious_scope) do update set
    name_en = excluded.name_en,
    name_ar = excluded.name_ar,
    source_reference = excluded.source_reference,
    is_paid = excluded.is_paid;
end;
$$;

create or replace function public.grant_leave_permissions_for_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name = 'owner' then
    insert into public.role_permissions(role_id, permission_key)
    select new.id, p.key from public.permissions p where p.module = 'leave' on conflict do nothing;
  elsif new.name = 'hr_admin' then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'leave.read'), (new.id, 'leave.read_all'), (new.id, 'leave.request'), (new.id, 'leave.approve'), (new.id, 'leave.manage')
    on conflict do nothing;
  elsif new.name in ('branch_manager', 'team_manager') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'leave.read'), (new.id, 'leave.request'), (new.id, 'leave.approve')
    on conflict do nothing;
  elsif new.name in ('payroll_officer', 'accountant') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'leave.read'), (new.id, 'leave.read_all')
    on conflict do nothing;
  elsif new.name = 'employee' then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'leave.read'), (new.id, 'leave.request')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_leave_permissions_after_role
after insert on public.roles
for each row execute function public.grant_leave_permissions_for_role();

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.module = 'leave'
  and (
    r.name in ('owner', 'hr_admin')
    or (r.name in ('branch_manager', 'team_manager') and p.key in ('leave.read', 'leave.request', 'leave.approve'))
    or (r.name in ('payroll_officer', 'accountant') and p.key in ('leave.read', 'leave.read_all'))
    or (r.name = 'employee' and p.key in ('leave.read', 'leave.request'))
  )
on conflict do nothing;

select public.seed_egypt_leave_defaults(id) from public.tenants;
select public.seed_egypt_2026_public_holidays(id) from public.tenants;

create or replace function public.after_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_settings(tenant_id, settings)
  values (new.id, jsonb_build_object('attendance', jsonb_build_object('enabled_methods', jsonb_build_array('mobile'))))
  on conflict (tenant_id) do nothing;
  perform public.seed_default_roles(new.id);
  perform public.seed_egypt_leave_defaults(new.id);
  perform public.seed_egypt_2026_public_holidays(new.id);
  return new;
end;
$$;

create or replace function public.annual_leave_entitlement(p_employee_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_service_days integer;
  v_total_years numeric;
  v_age integer;
  v_entitlement numeric;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null or v_employee.hire_date is null or p_as_of < v_employee.hire_date then return 0; end if;
  v_service_days := p_as_of - v_employee.hire_date + 1;
  if v_service_days < 183 then return 0; end if;
  v_total_years := v_employee.prior_service_years + (v_service_days::numeric / 365.2425);
  v_age := case when v_employee.birth_date is null then null else extract(year from age(p_as_of, v_employee.birth_date))::integer end;

  if v_employee.is_person_with_disability or v_employee.is_dwarf then
    v_entitlement := 45;
  elsif v_total_years >= 10 or coalesce(v_age, 0) >= 50 then
    v_entitlement := 30;
  elsif v_service_days < 365 then
    v_entitlement := round(15 * v_service_days::numeric / 365.2425, 2);
  else
    v_entitlement := 21;
  end if;

  if v_employee.works_hazardous or v_employee.works_unhealthy or v_employee.works_remote_location then
    v_entitlement := v_entitlement + 7;
  end if;
  return v_entitlement;
end;
$$;

create or replace function public.calculate_leave_units(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_day_part public.leave_day_part,
  p_requested_minutes integer,
  p_counts_calendar_days boolean
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_rest_days smallint[] := array[5]::smallint[];
  v_units numeric;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;
  if p_day_part <> 'full' and p_start_date <> p_end_date then raise exception 'Partial-day leave must use one date'; end if;

  if p_counts_calendar_days then
    v_units := (p_end_date - p_start_date + 1)::numeric;
  elsif p_day_part = 'hours' then
    v_units := round(coalesce(p_requested_minutes, 0)::numeric / 480, 2);
  elsif p_day_part in ('first_half', 'second_half') then
    v_units := 0.5;
  else
    if v_employee.branch_id is not null then
      select b.weekly_rest_isodows into v_rest_days from public.branches b where b.id = v_employee.branch_id;
    end if;
    select count(*)::numeric into v_units
    from generate_series(p_start_date, p_end_date, interval '1 day') day_value
    where not exists (
      select 1 from public.public_holidays h
      where h.tenant_id = v_employee.tenant_id and h.holiday_date = day_value::date
    )
    and (
      exists (
        select 1 from public.schedule_entries se
        join public.weekly_schedules ws on ws.id = se.schedule_id
        where se.employee_id = p_employee_id and se.work_date = day_value::date
          and se.entry_type in ('shift', 'training', 'assignment') and ws.status in ('published', 'locked')
      )
      or (
        not exists (
          select 1 from public.schedule_entries se
          join public.weekly_schedules ws on ws.id = se.schedule_id
          where se.employee_id = p_employee_id and se.work_date = day_value::date and ws.status in ('published', 'locked')
        )
        and not (extract(isodow from day_value)::smallint = any(v_rest_days))
      )
    );
  end if;

  return coalesce(v_units, 0);
end;
$$;

create or replace function public.leave_balance_available(p_employee_id uuid, p_balance_code text, p_leave_year integer)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base numeric := 0;
  v_transactions numeric := 0;
begin
  if p_balance_code = 'annual' then
    v_base := public.annual_leave_entitlement(p_employee_id, make_date(p_leave_year, 12, 31));
  end if;
  select coalesce(sum(t.units), 0) into v_transactions
  from public.leave_balance_transactions t
  where t.employee_id = p_employee_id and t.balance_code = p_balance_code and t.leave_year = p_leave_year;
  return round(v_base + v_transactions, 2);
end;
$$;

create or replace function public.can_view_leave_employee(p_tenant_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.has_permission(p_tenant_id, 'leave.read_all')
    or p_employee_id = public.current_employee_id(p_tenant_id)
    or (
      public.has_permission(p_tenant_id, 'leave.approve')
      and exists (
        select 1
        from public.employees viewer
        join public.employees target on target.id = p_employee_id and target.tenant_id = viewer.tenant_id
        where viewer.id = public.current_employee_id(p_tenant_id)
          and (target.manager_employee_id = viewer.id or target.branch_id = viewer.branch_id or (viewer.team_id is not null and target.team_id = viewer.team_id))
      )
    );
$$;

create or replace function public.submit_leave_request(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_day_part public.leave_day_part,
  p_requested_minutes integer,
  p_reason text,
  p_has_document boolean,
  p_expected_delivery_date date default null,
  p_actual_delivery_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_type public.leave_types%rowtype;
  v_units numeric;
  v_request_id uuid;
  v_used numeric;
  v_occurrences integer;
  v_flags jsonb := '[]'::jsonb;
  v_last_end date;
  v_initial_stage public.leave_approval_stage;
  v_year integer := extract(year from p_start_date)::integer;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  select * into v_type from public.leave_types where id = p_leave_type_id and is_active = true;
  if v_employee.id is null or v_type.id is null or v_employee.tenant_id <> v_type.tenant_id then raise exception 'Invalid employee or leave type'; end if;
  if auth.uid() is not null
     and p_employee_id <> public.current_employee_id(v_employee.tenant_id)
     and not public.has_permission(v_employee.tenant_id, 'leave.manage')
  then raise exception 'Not authorized to submit this request'; end if;
  if v_employee.status = 'terminated' then raise exception 'Terminated employees cannot request leave'; end if;
  if coalesce(length(trim(p_reason)), 0) = 0 and v_type.requires_reason then raise exception 'A reason is required'; end if;
  if v_type.requires_document and not p_has_document then raise exception 'Supporting documentation is required'; end if;
  if p_start_date < current_date and auth.uid() is not null and not public.has_permission(v_employee.tenant_id, 'leave.manage') then raise exception 'Past-dated leave requires HR approval'; end if;

  v_units := public.calculate_leave_units(p_employee_id, p_start_date, p_end_date, p_day_part, p_requested_minutes, v_type.counts_calendar_days);
  if v_units <= 0 then raise exception 'The selected period contains no chargeable leave days'; end if;
  if v_type.max_days_per_request is not null and v_units > v_type.max_days_per_request then raise exception 'The request exceeds the legal or policy maximum'; end if;
  if v_type.min_notice_days > 0 and p_start_date < current_date + v_type.min_notice_days then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object('code', 'short_notice', 'required_days', v_type.min_notice_days));
  end if;
  if (v_employee.is_person_with_disability or v_employee.is_dwarf or (v_employee.birth_date is not null and age(current_date, v_employee.birth_date) < interval '18 years')) and p_day_part <> 'full' then
    raise exception 'This employee’s statutory leave may not be split';
  end if;
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = p_employee_id and r.status in ('pending', 'approved')
      and daterange(r.start_date, r.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then raise exception 'This request overlaps existing leave'; end if;

  if v_type.balance_code is not null then
    select coalesce(sum(r.requested_units), 0) into v_used
    from public.leave_requests r
    join public.leave_types lt on lt.id = r.leave_type_id
    where r.employee_id = p_employee_id and r.status = 'pending'
      and extract(year from r.start_date)::integer = v_year and lt.balance_code = v_type.balance_code;
    if public.leave_balance_available(p_employee_id, v_type.balance_code, v_year) - v_used < v_units then raise exception 'Insufficient leave balance'; end if;
  end if;

  if v_type.code = 'emergency' then
    select coalesce(sum(r.requested_units), 0) into v_used
    from public.leave_requests r join public.leave_types lt on lt.id = r.leave_type_id
    where r.employee_id = p_employee_id and lt.code = 'emergency' and r.status in ('pending', 'approved')
      and extract(year from r.start_date)::integer = v_year;
    if v_used + v_units > 7 then raise exception 'Emergency leave is limited to seven days per year'; end if;
  elsif v_type.code = 'child_birth' then
    select count(*) into v_occurrences from public.leave_requests r join public.leave_types lt on lt.id = r.leave_type_id
    where r.employee_id = p_employee_id and lt.code = 'child_birth' and r.status in ('pending', 'approved');
    if v_occurrences >= 3 then raise exception 'Child-birth leave is limited to three occurrences during service'; end if;
  elsif v_type.code = 'hajj_jerusalem' then
    if v_employee.hire_date is null or p_start_date < v_employee.hire_date + interval '5 years' then raise exception 'Five consecutive service years are required'; end if;
    if exists (select 1 from public.leave_requests r join public.leave_types lt on lt.id = r.leave_type_id where r.employee_id = p_employee_id and lt.code = 'hajj_jerusalem' and r.status in ('pending', 'approved')) then raise exception 'Pilgrimage leave is available once during service'; end if;
  elsif v_type.code = 'maternity' then
    if v_employee.gender <> 'female' then raise exception 'Maternity leave requires a female employee record'; end if;
    select count(*) into v_occurrences from public.leave_requests r join public.leave_types lt on lt.id = r.leave_type_id where r.employee_id = p_employee_id and lt.code = 'maternity' and r.status in ('pending', 'approved');
    if v_occurrences >= 3 then raise exception 'Maternity leave is limited to three occurrences'; end if;
    if p_actual_delivery_date is not null and p_end_date - p_actual_delivery_date + 1 < 45 then raise exception 'Maternity leave must include at least 45 days after delivery'; end if;
  elsif v_type.code = 'childcare_unpaid' then
    if v_employee.gender <> 'female' then raise exception 'Childcare leave requires a female employee record'; end if;
    if v_employee.hire_date is null or p_start_date < v_employee.hire_date + interval '1 year' then raise exception 'One service year is required for childcare leave'; end if;
    if (select count(*) from public.employees e where e.tenant_id = v_employee.tenant_id and e.status <> 'terminated') < 50 then raise exception 'Statutory childcare leave requires an establishment with at least 50 workers'; end if;
    select count(*), max(r.end_date) into v_occurrences, v_last_end from public.leave_requests r join public.leave_types lt on lt.id = r.leave_type_id where r.employee_id = p_employee_id and lt.code = 'childcare_unpaid' and r.status in ('pending', 'approved');
    if v_occurrences >= 3 then raise exception 'Childcare leave is limited to three occurrences'; end if;
    if v_last_end is not null and p_start_date < v_last_end + interval '2 years' then raise exception 'Two years must separate childcare leave periods'; end if;
  elsif v_type.code = 'industrial_sick' then
    if not exists (select 1 from public.branches b where b.id = v_employee.branch_id and b.is_industrial_establishment) then raise exception 'Industrial sick-leave tiers require an industrial establishment'; end if;
  end if;

  v_initial_stage := case
    when v_employee.manager_employee_id is null then 'owner_review'::public.leave_approval_stage
    else 'manager_review'::public.leave_approval_stage
  end;

  insert into public.leave_requests(
    tenant_id, employee_id, leave_type_id, start_date, end_date, day_part, requested_minutes,
    requested_units, reason, expected_delivery_date, actual_delivery_date, approval_stage, compliance_flags, submitted_by
  ) values (
    v_employee.tenant_id, p_employee_id, p_leave_type_id, p_start_date, p_end_date, p_day_part, p_requested_minutes,
    v_units, nullif(trim(p_reason), ''), p_expected_delivery_date, p_actual_delivery_date, v_initial_stage, v_flags, auth.uid()
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.review_leave_request(p_request_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_type public.leave_types%rowtype;
  v_prior_industrial numeric := 0;
  v_actor_employee_id uuid;
  v_is_manager boolean := false;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_request from public.leave_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Leave request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending requests can be reviewed'; end if;
  if p_decision = 'rejected' and coalesce(length(trim(p_note)), 0) = 0 then raise exception 'A rejection reason is required'; end if;

  v_actor_employee_id := public.current_employee_id(v_request.tenant_id);
  select exists (
    select 1
    from public.employees target
    where target.id = v_request.employee_id
      and target.manager_employee_id = v_actor_employee_id
  ) into v_is_manager;

  if v_request.approval_stage = 'manager_review' then
    if not v_is_manager
       and not public.has_permission(v_request.tenant_id, 'leave.manage')
       and not public.is_tenant_owner(v_request.tenant_id)
       and not public.is_platform_admin()
    then raise exception 'The employee manager must review this request first'; end if;
  elsif v_request.approval_stage = 'owner_review' then
    if not public.is_tenant_owner(v_request.tenant_id) and not public.is_platform_admin()
    then raise exception 'A company owner must complete the final review'; end if;
  else
    raise exception 'This approval workflow is already complete';
  end if;

  select * into v_type from public.leave_types where id = v_request.leave_type_id;

  insert into public.leave_approval_actions(tenant_id, request_id, stage, decision, actor_user_id, note)
  values (
    v_request.tenant_id,
    v_request.id,
    v_request.approval_stage,
    p_decision::public.leave_approval_decision,
    auth.uid(),
    nullif(trim(p_note), '')
  );

  if p_decision = 'rejected' then
    update public.leave_requests
    set status = 'rejected', approval_stage = 'completed', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
    where id = p_request_id;
    return;
  end if;

  if v_request.approval_stage = 'manager_review' then
    update public.leave_requests
    set approval_stage = 'owner_review', review_note = nullif(trim(p_note), '')
    where id = p_request_id;
    return;
  end if;

  update public.leave_requests
  set status = 'approved', approval_stage = 'completed', reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
  where id = p_request_id;

  if v_type.code = 'industrial_sick' then
    select coalesce(sum(d.units), 0) into v_prior_industrial
    from public.leave_request_days d join public.leave_requests r on r.id = d.request_id join public.leave_types lt on lt.id = r.leave_type_id
    where d.employee_id = v_request.employee_id and lt.code = 'industrial_sick' and r.status = 'approved'
      and d.leave_date >= v_request.start_date - interval '3 years' and r.id <> v_request.id;
  end if;

  insert into public.leave_request_days(tenant_id, request_id, employee_id, leave_date, units, pay_percentage)
  select v_request.tenant_id, v_request.id, v_request.employee_id, day_value::date,
    case when v_request.day_part in ('first_half', 'second_half') then 0.5 when v_request.day_part = 'hours' then round(v_request.requested_minutes::numeric / 480, 2) else 1 end,
    case
      when v_type.code = 'industrial_sick' then case
        when v_prior_industrial + row_number() over (order by day_value) <= 90 then 100
        when v_prior_industrial + row_number() over (order by day_value) <= 270 then 85
        else 75 end
      else v_type.default_pay_percentage
    end
  from generate_series(v_request.start_date, v_request.end_date, interval '1 day') day_value
  where v_type.counts_calendar_days
     or public.calculate_leave_units(v_request.employee_id, day_value::date, day_value::date, v_request.day_part, v_request.requested_minutes, false) > 0
  on conflict (request_id, leave_date) do nothing;

  if v_type.balance_code is not null then
    insert into public.leave_balance_transactions(tenant_id, employee_id, balance_code, leave_year, kind, units, request_id, reason, created_by)
    values (v_request.tenant_id, v_request.employee_id, v_type.balance_code, extract(year from v_request.start_date)::integer, 'leave_usage', -v_request.requested_units, v_request.id, 'Approved ' || v_type.code || ' leave', auth.uid());
  end if;
end;
$$;

create or replace function public.attach_leave_document(p_request_id uuid, p_document_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
begin
  select * into v_request from public.leave_requests where id = p_request_id;
  if v_request.id is null then raise exception 'Leave request not found'; end if;
  if v_request.employee_id <> public.current_employee_id(v_request.tenant_id)
     and not public.has_permission(v_request.tenant_id, 'leave.manage')
     and not public.is_tenant_owner(v_request.tenant_id)
  then raise exception 'Not authorized to attach this document'; end if;
  if p_document_path not like v_request.tenant_id::text || '/' || v_request.employee_id::text || '/' || v_request.id::text || '/%' then raise exception 'Invalid leave-document path'; end if;
  update public.leave_requests set supporting_document_path = p_document_path where id = p_request_id;
end;
$$;

create or replace function public.cancel_leave_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_type public.leave_types%rowtype;
begin
  select * into v_request from public.leave_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Leave request not found'; end if;
  if v_request.employee_id <> public.current_employee_id(v_request.tenant_id)
     and not public.has_permission(v_request.tenant_id, 'leave.manage')
     and not public.is_tenant_owner(v_request.tenant_id)
  then raise exception 'Not authorized to cancel leave'; end if;
  if v_request.status not in ('pending', 'approved') then raise exception 'This request cannot be cancelled'; end if;
  if v_request.status = 'approved' and v_request.start_date < current_date and not public.has_permission(v_request.tenant_id, 'leave.manage') then raise exception 'HR must reverse started leave'; end if;
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'A cancellation reason is required'; end if;
  select * into v_type from public.leave_types where id = v_request.leave_type_id;
  if v_request.status = 'approved' and v_type.balance_code is not null then
    insert into public.leave_balance_transactions(tenant_id, employee_id, balance_code, leave_year, kind, units, request_id, reason, created_by)
    values (v_request.tenant_id, v_request.employee_id, v_type.balance_code, extract(year from v_request.start_date)::integer, 'reversal', v_request.requested_units, v_request.id, 'Cancelled approved leave: ' || trim(p_reason), auth.uid());
  end if;
  update public.leave_requests set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = trim(p_reason) where id = p_request_id;
end;
$$;

create or replace function public.adjust_leave_balance(p_employee_id uuid, p_balance_code text, p_leave_year integer, p_units numeric, p_reason text, p_kind public.leave_transaction_kind default 'adjustment')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_id bigint;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if not public.has_permission(v_employee.tenant_id, 'leave.manage') and not public.is_tenant_owner(v_employee.tenant_id) then raise exception 'Not authorized to adjust leave balances'; end if;
  if p_units = 0 or coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'A non-zero amount and reason are required'; end if;
  insert into public.leave_balance_transactions(tenant_id, employee_id, balance_code, leave_year, kind, units, reason, created_by)
  values (v_employee.tenant_id, p_employee_id, p_balance_code, p_leave_year, p_kind, p_units, trim(p_reason), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create trigger leave_types_updated_at before update on public.leave_types for each row execute function public.set_updated_at();
create trigger leave_requests_updated_at before update on public.leave_requests for each row execute function public.set_updated_at();
create trigger audit_leave_types after insert or update or delete on public.leave_types for each row execute function public.capture_audit_log();
create trigger audit_public_holidays after insert or update or delete on public.public_holidays for each row execute function public.capture_audit_log();
create trigger audit_leave_requests after insert or update or delete on public.leave_requests for each row execute function public.capture_audit_log();
create trigger audit_leave_approval_actions after insert or update or delete on public.leave_approval_actions for each row execute function public.capture_audit_log();
create trigger audit_leave_balance_transactions after insert or update or delete on public.leave_balance_transactions for each row execute function public.capture_audit_log();

alter table public.leave_types enable row level security;
alter table public.public_holidays enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_days enable row level security;
alter table public.leave_approval_actions enable row level security;
alter table public.leave_balance_transactions enable row level security;

create policy leave_types_read on public.leave_types for select to authenticated using (public.is_tenant_member(tenant_id));
create policy leave_types_manage on public.leave_types for all to authenticated using (public.has_permission(tenant_id, 'leave.manage')) with check (public.has_permission(tenant_id, 'leave.manage'));
create policy public_holidays_read on public.public_holidays for select to authenticated using (public.is_tenant_member(tenant_id));
create policy public_holidays_manage on public.public_holidays for all to authenticated using (public.has_permission(tenant_id, 'leave.manage')) with check (public.has_permission(tenant_id, 'leave.manage'));
create policy leave_requests_read on public.leave_requests for select to authenticated using (public.can_view_leave_employee(tenant_id, employee_id));
create policy leave_request_days_read on public.leave_request_days for select to authenticated using (public.can_view_leave_employee(tenant_id, employee_id));
create policy leave_approval_actions_read on public.leave_approval_actions for select to authenticated using (
  exists (
    select 1 from public.leave_requests r
    where r.id = request_id and public.can_view_leave_employee(r.tenant_id, r.employee_id)
  )
);
create policy leave_transactions_read on public.leave_balance_transactions for select to authenticated using (public.can_view_leave_employee(tenant_id, employee_id));

grant select on public.leave_types, public.public_holidays, public.leave_requests, public.leave_request_days, public.leave_approval_actions, public.leave_balance_transactions to authenticated;
grant insert, update, delete on public.leave_types, public.public_holidays to authenticated;
grant update (supporting_document_path) on public.leave_requests to authenticated;
grant all on public.leave_types, public.public_holidays, public.leave_requests, public.leave_request_days, public.leave_approval_actions, public.leave_balance_transactions to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('leave-documents', 'leave-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy leave_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'leave-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.tenant_id::text = (storage.foldername(name))[1]
      and (public.has_permission(m.tenant_id, 'leave.manage') or public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2])
  )
);
create policy leave_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'leave-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.tenant_id::text = (storage.foldername(name))[1]
      and (
        public.has_permission(m.tenant_id, 'leave.read_all')
        or public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2]
      )
  )
);

grant execute on function public.annual_leave_entitlement(uuid, date) to authenticated;
grant execute on function public.calculate_leave_units(uuid, date, date, public.leave_day_part, integer, boolean) to authenticated;
grant execute on function public.leave_balance_available(uuid, text, integer) to authenticated;
grant execute on function public.can_view_leave_employee(uuid, uuid) to authenticated;
grant execute on function public.submit_leave_request(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date) to authenticated;
grant execute on function public.review_leave_request(uuid, text, text) to authenticated;
grant execute on function public.cancel_leave_request(uuid, text) to authenticated;
grant execute on function public.adjust_leave_balance(uuid, text, integer, numeric, text, public.leave_transaction_kind) to authenticated;
grant execute on function public.attach_leave_document(uuid, text) to authenticated;

revoke execute on function public.annual_leave_entitlement(uuid, date) from public, anon;
revoke execute on function public.calculate_leave_units(uuid, date, date, public.leave_day_part, integer, boolean) from public, anon;
revoke execute on function public.leave_balance_available(uuid, text, integer) from public, anon;
revoke execute on function public.can_view_leave_employee(uuid, uuid) from public, anon;
revoke execute on function public.submit_leave_request(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date) from public, anon;
revoke execute on function public.review_leave_request(uuid, text, text) from public, anon;
revoke execute on function public.cancel_leave_request(uuid, text) from public, anon;
revoke execute on function public.adjust_leave_balance(uuid, text, integer, numeric, text, public.leave_transaction_kind) from public, anon;
revoke execute on function public.attach_leave_document(uuid, text) from public, anon;
revoke execute on function public.seed_egypt_leave_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.seed_egypt_2026_public_holidays(uuid) from public, anon, authenticated;
revoke execute on function public.grant_leave_permissions_for_role() from public, anon, authenticated;
