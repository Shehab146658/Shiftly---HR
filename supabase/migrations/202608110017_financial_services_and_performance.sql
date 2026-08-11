-- Employee financial services, daily sales, targets, and auditable incentive payouts.

create type public.loan_request_status as enum ('submitted', 'approved', 'rejected', 'cancelled');
create type public.employee_loan_status as enum ('active', 'paused', 'settled', 'written_off');
create type public.loan_installment_status as enum ('scheduled', 'partial', 'deducted', 'paid', 'deferred', 'waived');
create type public.loan_payment_method as enum ('payroll', 'cash', 'bank_transfer', 'settlement', 'adjustment');
create type public.sales_entry_status as enum ('submitted', 'approved', 'rejected');
create type public.performance_scope as enum ('branch', 'team', 'employee');
create type public.bonus_basis as enum ('fixed_amount', 'salary_percentage', 'sales_percentage');
create type public.bonus_result_status as enum ('calculated', 'approved', 'rejected', 'paid');

create sequence public.loan_number_seq;

insert into public.permissions(key, description, module) values
  ('loans.read', 'View personal loan requests, statements, and installments', 'loans'),
  ('loans.read_all', 'View employee financial-service records across permitted operations', 'loans'),
  ('loans.create', 'Submit a personal loan or salary-advance request', 'loans'),
  ('loans.approve', 'Approve or reject employee loan requests', 'loans'),
  ('loans.manage', 'Manage approved loans, installments, and settlements', 'loans'),
  ('sales.read', 'View approved sales and performance results', 'performance'),
  ('sales.create', 'Submit daily branch and employee sales', 'performance'),
  ('sales.approve', 'Approve or reject submitted sales entries', 'performance'),
  ('targets.manage', 'Configure sales targets and incentive policies', 'performance'),
  ('bonuses.approve', 'Approve calculated bonuses for payroll', 'performance')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where
  (r.name = 'owner' and p.module in ('loans', 'performance'))
  or (r.name = 'hr_admin' and p.key in ('loans.read','loans.read_all','loans.create','loans.approve','loans.manage','sales.read'))
  or (r.name in ('payroll_officer','accountant') and p.key in ('loans.read','loans.read_all','loans.approve','loans.manage','sales.read','bonuses.approve'))
  or (r.name in ('branch_manager','team_manager') and p.key in ('loans.read','loans.create','loans.approve','sales.read','sales.create','sales.approve'))
  or (r.name = 'employee' and p.key in ('loans.read','loans.create','sales.read'))
on conflict do nothing;

create or replace function public.grant_business_permissions_for_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name = 'owner' then
    insert into public.role_permissions(role_id,permission_key)
    select new.id,key from public.permissions where module in ('loans','performance') on conflict do nothing;
  elsif new.name = 'hr_admin' then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'loans.read'),(new.id,'loans.read_all'),(new.id,'loans.create'),(new.id,'loans.approve'),(new.id,'loans.manage'),(new.id,'sales.read') on conflict do nothing;
  elsif new.name in ('payroll_officer','accountant') then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'loans.read'),(new.id,'loans.read_all'),(new.id,'loans.approve'),(new.id,'loans.manage'),(new.id,'sales.read'),(new.id,'bonuses.approve') on conflict do nothing;
  elsif new.name in ('branch_manager','team_manager') then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'loans.read'),(new.id,'loans.create'),(new.id,'loans.approve'),(new.id,'sales.read'),(new.id,'sales.create'),(new.id,'sales.approve') on conflict do nothing;
  elsif new.name = 'employee' then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'loans.read'),(new.id,'loans.create'),(new.id,'sales.read') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_business_permissions_after_role
after insert on public.roles for each row execute function public.grant_business_permissions_for_role();

create table public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_amount numeric(14,2) not null check (requested_amount > 0),
  requested_installments integer not null check (requested_installments between 1 and 120),
  requested_start_month date not null check (requested_start_month = date_trunc('month', requested_start_month)::date),
  purpose text not null check (length(trim(purpose)) between 3 and 2000),
  status public.loan_request_status not null default 'submitted',
  approved_amount numeric(14,2) check (approved_amount is null or approved_amount > 0),
  approved_installments integer check (approved_installments is null or approved_installments between 1 and 120),
  approved_start_month date,
  decision_note text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  request_id uuid unique references public.loan_requests(id) on delete set null,
  loan_number text not null,
  approved_amount numeric(14,2) not null check (approved_amount > 0),
  installment_count integer not null check (installment_count between 1 and 120),
  monthly_installment numeric(14,2) not null check (monthly_installment > 0),
  start_month date not null,
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  total_paid numeric(14,2) not null default 0 check (total_paid >= 0),
  remaining_balance numeric(14,2) not null check (remaining_balance >= 0),
  status public.employee_loan_status not null default 'active',
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, loan_number)
);

create table public.loan_installments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loan_id uuid not null references public.employee_loans(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  status public.loan_installment_status not null default 'scheduled',
  original_due_date date not null,
  defer_reason text,
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (loan_id, installment_number)
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  loan_id uuid not null references public.employee_loans(id) on delete cascade,
  installment_id uuid references public.loan_installments(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  method public.loan_payment_method not null,
  reference text,
  notes text,
  payroll_component_id uuid unique references public.payroll_components(id) on delete set null,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index loan_requests_tenant_status_idx on public.loan_requests(tenant_id,status,submitted_at desc);
create index employee_loans_employee_idx on public.employee_loans(employee_id,status,created_at desc);
create index loan_installments_due_idx on public.loan_installments(tenant_id,status,due_date);
create index loan_payments_loan_idx on public.loan_payments(loan_id,payment_date desc);

create table public.sales_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_date date not null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  reference text,
  notes text,
  status public.sales_entry_status not null default 'submitted',
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);

create table public.bonus_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  bonus_basis public.bonus_basis not null,
  tiers jsonb not null check (jsonb_typeof(tiers) = 'array' and jsonb_array_length(tiers) > 0),
  is_active boolean not null default true,
  effective_from date not null,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,code),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name text not null check (length(trim(name)) between 2 and 150),
  period_start date not null,
  period_end date not null,
  scope_type public.performance_scope not null,
  branch_id uuid references public.branches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  bonus_policy_id uuid not null references public.bonus_policies(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,code),
  check (period_end >= period_start),
  check (
    (scope_type='branch' and branch_id is not null and team_id is null and employee_id is null) or
    (scope_type='team' and branch_id is null and team_id is not null and employee_id is null) or
    (scope_type='employee' and branch_id is null and team_id is null and employee_id is not null)
  )
);

create table public.bonus_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_id uuid not null references public.sales_targets(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  actual_sales numeric(14,2) not null default 0,
  achievement_percentage numeric(10,4) not null default 0,
  tier_value numeric(14,4) not null default 0,
  bonus_amount numeric(14,2) not null default 0 check (bonus_amount >= 0),
  status public.bonus_result_status not null default 'calculated',
  calculation_snapshot jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  payroll_period_id uuid references public.payroll_periods(id) on delete set null,
  unique (target_id,employee_id)
);

create index sales_entries_tenant_date_idx on public.sales_entries(tenant_id,business_date desc,status);
create index sales_entries_employee_idx on public.sales_entries(employee_id,business_date desc) where employee_id is not null;
create index sales_targets_tenant_period_idx on public.sales_targets(tenant_id,period_start,period_end);
create index bonus_results_employee_idx on public.bonus_results(employee_id,status,calculated_at desc);

create or replace function public.validate_financial_service_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_valid boolean;
begin
  if tg_table_name = 'loan_requests' then
    select exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name = 'employee_loans' then
    select exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id)
      and (new.request_id is null or exists(select 1 from public.loan_requests r where r.id=new.request_id and r.tenant_id=new.tenant_id and r.employee_id=new.employee_id)) into v_valid;
  elsif tg_table_name = 'loan_installments' then
    select exists(select 1 from public.employee_loans l where l.id=new.loan_id and l.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name = 'loan_payments' then
    select exists(select 1 from public.employee_loans l where l.id=new.loan_id and l.tenant_id=new.tenant_id)
      and (new.installment_id is null or exists(select 1 from public.loan_installments i where i.id=new.installment_id and i.loan_id=new.loan_id and i.tenant_id=new.tenant_id)) into v_valid;
  else v_valid := false;
  end if;
  if not v_valid then raise exception 'Cross-tenant financial-service relationship rejected'; end if;
  return new;
end;
$$;

create or replace function public.validate_performance_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_valid boolean;
begin
  if tg_table_name = 'sales_entries' then
    select exists(select 1 from public.branches b where b.id=new.branch_id and b.tenant_id=new.tenant_id)
      and (new.employee_id is null or exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id)) into v_valid;
  elsif tg_table_name = 'sales_targets' then
    select exists(select 1 from public.bonus_policies p where p.id=new.bonus_policy_id and p.tenant_id=new.tenant_id)
      and (new.branch_id is null or exists(select 1 from public.branches b where b.id=new.branch_id and b.tenant_id=new.tenant_id))
      and (new.team_id is null or exists(select 1 from public.teams t where t.id=new.team_id and t.tenant_id=new.tenant_id))
      and (new.employee_id is null or exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id)) into v_valid;
  elsif tg_table_name = 'bonus_results' then
    select exists(select 1 from public.sales_targets t where t.id=new.target_id and t.tenant_id=new.tenant_id)
      and exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id) into v_valid;
  else v_valid := false;
  end if;
  if not v_valid then raise exception 'Cross-tenant performance relationship rejected'; end if;
  return new;
end;
$$;

create trigger validate_loan_requests before insert or update on public.loan_requests for each row execute function public.validate_financial_service_links();
create trigger validate_employee_loans before insert or update on public.employee_loans for each row execute function public.validate_financial_service_links();
create trigger validate_loan_installments before insert or update on public.loan_installments for each row execute function public.validate_financial_service_links();
create trigger validate_loan_payments before insert or update on public.loan_payments for each row execute function public.validate_financial_service_links();
create trigger validate_sales_entries before insert or update on public.sales_entries for each row execute function public.validate_performance_links();
create trigger validate_sales_targets before insert or update on public.sales_targets for each row execute function public.validate_performance_links();
create trigger validate_bonus_results before insert or update on public.bonus_results for each row execute function public.validate_performance_links();

create or replace function public.can_view_employee_finance(p_tenant_id uuid,p_employee_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_current public.employees%rowtype; v_target public.employees%rowtype;
begin
  if public.has_permission(p_tenant_id,'loans.read_all') then return true; end if;
  select * into v_current from public.employees where tenant_id=p_tenant_id and user_id=auth.uid() and status<>'terminated' limit 1;
  if v_current.id=p_employee_id and public.has_permission(p_tenant_id,'loans.read') then return true; end if;
  if v_current.id is null or not public.has_permission(p_tenant_id,'loans.approve') then return false; end if;
  select * into v_target from public.employees where id=p_employee_id and tenant_id=p_tenant_id;
  return v_target.id is not null and ((v_current.team_id is not null and v_current.team_id=v_target.team_id) or (v_current.branch_id is not null and v_current.branch_id=v_target.branch_id));
end;
$$;

create or replace function public.submit_loan_request(p_employee_id uuid,p_amount numeric,p_installments integer,p_start_month date,p_purpose text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_employee public.employees%rowtype; v_id uuid;
begin
  select * into v_employee from public.employees where id=p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if public.current_employee_id(v_employee.tenant_id) is distinct from v_employee.id and not public.has_permission(v_employee.tenant_id,'loans.manage') then raise exception 'Not authorized to request for this employee'; end if;
  if not public.has_permission(v_employee.tenant_id,'loans.create') and not public.has_permission(v_employee.tenant_id,'loans.manage') then raise exception 'Not authorized to submit a loan request'; end if;
  if p_amount <= 0 or p_installments not between 1 and 120 or length(trim(p_purpose)) < 3 then raise exception 'Invalid loan request'; end if;
  insert into public.loan_requests(tenant_id,employee_id,requested_amount,requested_installments,requested_start_month,purpose,submitted_by)
  values(v_employee.tenant_id,v_employee.id,round(p_amount,2),p_installments,date_trunc('month',p_start_month)::date,trim(p_purpose),auth.uid()) returning id into v_id;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select distinct v_employee.tenant_id,m.user_id,'loan.approval','Loan request awaiting review','طلب سلفة ينتظر المراجعة',v_employee.name_en||' submitted a loan request',coalesce(v_employee.name_ar,v_employee.name_en)||' قدم طلب سلفة','/en/loans?request='||v_id::text,'loan_requests',v_id::text
  from public.memberships m join public.membership_roles mr on mr.membership_id=m.id join public.role_permissions rp on rp.role_id=mr.role_id
  where m.tenant_id=v_employee.tenant_id and m.status='active' and rp.permission_key='loans.approve' and m.user_id is distinct from auth.uid();
  return v_id;
end;
$$;

create or replace function public.cancel_loan_request(p_request_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_request public.loan_requests%rowtype;
begin
  select * into v_request from public.loan_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'Loan request not found'; end if;
  if v_request.status <> 'submitted' then raise exception 'Only submitted requests can be cancelled'; end if;
  if public.current_employee_id(v_request.tenant_id) is distinct from v_request.employee_id and not public.has_permission(v_request.tenant_id,'loans.manage') then raise exception 'Not authorized to cancel this request'; end if;
  update public.loan_requests set status='cancelled',decision_note=nullif(trim(p_reason),''),updated_at=now() where id=v_request.id;
end;
$$;

create or replace function public.review_loan_request(p_request_id uuid,p_approve boolean,p_amount numeric,p_installments integer,p_start_month date,p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request public.loan_requests%rowtype; v_loan_id uuid; v_number text; v_monthly numeric; v_part numeric; v_remaining numeric;
begin
  select * into v_request from public.loan_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'Loan request not found'; end if;
  if v_request.status <> 'submitted' then raise exception 'This request was already decided'; end if;
  if not public.has_permission(v_request.tenant_id,'loans.approve') and not public.is_tenant_owner(v_request.tenant_id) then raise exception 'Not authorized to review loan requests'; end if;
  if not p_approve then
    if length(trim(p_note)) < 2 then raise exception 'A rejection reason is required'; end if;
    update public.loan_requests set status='rejected',decision_note=trim(p_note),decided_by=auth.uid(),decided_at=now(),updated_at=now() where id=v_request.id;
    insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
    select v_request.tenant_id,e.user_id,'loan.rejected','Loan request was not approved','لم تتم الموافقة على طلب السلفة','Your loan request was rejected: '||trim(p_note),'تم رفض طلب السلفة: '||trim(p_note),'/en/loans?request='||v_request.id::text,'loan_requests',v_request.id::text from public.employees e where e.id=v_request.employee_id and e.user_id is not null and e.user_id is distinct from auth.uid();
    return null;
  end if;
  if p_amount <= 0 or p_installments not between 1 and 120 then raise exception 'Approved amount and installments are required'; end if;
  v_number := 'LN-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.loan_number_seq')::text,6,'0');
  v_monthly := round(p_amount/p_installments,2);
  insert into public.employee_loans(tenant_id,employee_id,request_id,loan_number,approved_amount,installment_count,monthly_installment,start_month,remaining_balance,approved_by,notes)
  values(v_request.tenant_id,v_request.employee_id,v_request.id,v_number,round(p_amount,2),p_installments,v_monthly,date_trunc('month',p_start_month)::date,round(p_amount,2),auth.uid(),nullif(trim(p_note),'')) returning id into v_loan_id;
  v_remaining := round(p_amount,2);
  for i in 1..p_installments loop
    v_part := case when i=p_installments then v_remaining else least(v_monthly,v_remaining) end;
    insert into public.loan_installments(tenant_id,loan_id,installment_number,due_date,original_due_date,amount)
    values(v_request.tenant_id,v_loan_id,i,(date_trunc('month',p_start_month)::date + ((i-1)||' months')::interval)::date,(date_trunc('month',p_start_month)::date + ((i-1)||' months')::interval)::date,v_part);
    v_remaining := v_remaining-v_part;
  end loop;
  update public.loan_requests set status='approved',approved_amount=round(p_amount,2),approved_installments=p_installments,approved_start_month=date_trunc('month',p_start_month)::date,decision_note=nullif(trim(p_note),''),decided_by=auth.uid(),decided_at=now(),updated_at=now() where id=v_request.id;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select v_request.tenant_id,e.user_id,'loan.approved','Loan request approved','تمت الموافقة على طلب السلفة','Your loan request was approved','تمت الموافقة على طلب السلفة الخاص بك','/en/loans/'||v_loan_id::text,'employee_loans',v_loan_id::text from public.employees e where e.id=v_request.employee_id and e.user_id is not null and e.user_id is distinct from auth.uid();
  return v_loan_id;
end;
$$;

create or replace function public.record_loan_payment(p_loan_id uuid,p_amount numeric,p_payment_date date,p_method public.loan_payment_method,p_reference text,p_notes text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_loan public.employee_loans%rowtype; v_left numeric; v_apply numeric; v_installment public.loan_installments%rowtype;
begin
  select * into v_loan from public.employee_loans where id=p_loan_id for update;
  if v_loan.id is null then raise exception 'Loan not found'; end if;
  if not public.has_permission(v_loan.tenant_id,'loans.manage') then raise exception 'Not authorized to record loan payments'; end if;
  if v_loan.status in ('settled','written_off') then raise exception 'This loan is closed'; end if;
  if p_amount <= 0 or p_amount > v_loan.remaining_balance then raise exception 'Payment exceeds the outstanding balance'; end if;
  v_left := round(p_amount,2);
  for v_installment in select * from public.loan_installments where loan_id=v_loan.id and paid_amount<amount and status<>'waived' order by due_date,installment_number for update loop
    exit when v_left <= 0;
    v_apply := least(v_left,v_installment.amount-v_installment.paid_amount);
    update public.loan_installments set paid_amount=paid_amount+v_apply,status=case when paid_amount+v_apply>=amount then 'paid'::public.loan_installment_status else 'partial'::public.loan_installment_status end,paid_at=case when paid_amount+v_apply>=amount then now() else paid_at end,updated_at=now() where id=v_installment.id;
    insert into public.loan_payments(tenant_id,loan_id,installment_id,amount,payment_date,method,reference,notes,recorded_by)
    values(v_loan.tenant_id,v_loan.id,v_installment.id,v_apply,p_payment_date,p_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),auth.uid());
    v_left := v_left-v_apply;
  end loop;
  update public.employee_loans set total_paid=least(approved_amount,total_paid+round(p_amount,2)),remaining_balance=greatest(0,approved_amount-total_paid-round(p_amount,2)),status=case when approved_amount-total_paid-round(p_amount,2)<=0 then 'settled'::public.employee_loan_status else status end,settled_at=case when approved_amount-total_paid-round(p_amount,2)<=0 then now() else settled_at end,updated_at=now() where id=v_loan.id;
  return greatest(0,v_loan.remaining_balance-round(p_amount,2));
end;
$$;

create or replace function public.reschedule_loan_installment(p_installment_id uuid,p_due_date date,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_installment public.loan_installments%rowtype;
begin
  select * into v_installment from public.loan_installments where id=p_installment_id for update;
  if v_installment.id is null then raise exception 'Installment not found'; end if;
  if not public.has_permission(v_installment.tenant_id,'loans.manage') then raise exception 'Not authorized to reschedule installments'; end if;
  if v_installment.status in ('deducted','paid','waived') then raise exception 'Paid installments cannot be rescheduled'; end if;
  if length(trim(p_reason))<2 then raise exception 'A reschedule reason is required'; end if;
  update public.loan_installments set due_date=p_due_date,status='deferred',defer_reason=trim(p_reason),updated_at=now() where id=v_installment.id;
end;
$$;

create or replace function public.set_employee_loan_status(p_loan_id uuid,p_status public.employee_loan_status,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_loan public.employee_loans%rowtype;
begin
  select * into v_loan from public.employee_loans where id=p_loan_id for update;
  if v_loan.id is null then raise exception 'Loan not found'; end if;
  if not public.has_permission(v_loan.tenant_id,'loans.manage') then raise exception 'Not authorized to manage this loan'; end if;
  if p_status not in ('active','paused','written_off') then raise exception 'Use payment settlement to close a loan'; end if;
  if p_status='written_off' and length(trim(p_note))<2 then raise exception 'A write-off reason is required'; end if;
  update public.employee_loans set status=p_status,notes=concat_ws(E'\n',notes,nullif(trim(p_note),'')),updated_at=now() where id=v_loan.id;
end;
$$;

create or replace function public.record_sales_entry(p_tenant_id uuid,p_business_date date,p_branch_id uuid,p_employee_id uuid,p_amount numeric,p_currency text,p_reference text,p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_permission(p_tenant_id,'sales.create') then raise exception 'Not authorized to submit sales'; end if;
  if p_amount < 0 then raise exception 'Sales amount cannot be negative'; end if;
  insert into public.sales_entries(tenant_id,business_date,branch_id,employee_id,amount,currency_code,reference,notes,submitted_by)
  values(p_tenant_id,p_business_date,p_branch_id,p_employee_id,round(p_amount,2),upper(p_currency),nullif(trim(p_reference),''),nullif(trim(p_notes),''),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_sales_entry(p_entry_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry public.sales_entries%rowtype;
begin
  select * into v_entry from public.sales_entries where id=p_entry_id for update;
  if v_entry.id is null then raise exception 'Sales entry not found'; end if;
  if v_entry.status<>'submitted' then raise exception 'This sales entry was already reviewed'; end if;
  if not public.has_permission(v_entry.tenant_id,'sales.approve') then raise exception 'Not authorized to review sales'; end if;
  if not p_approve and length(trim(p_note))<2 then raise exception 'A rejection reason is required'; end if;
  update public.sales_entries set status=case when p_approve then 'approved'::public.sales_entry_status else 'rejected'::public.sales_entry_status end,reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),''),updated_at=now() where id=v_entry.id;
end;
$$;

create or replace function public.create_bonus_policy(p_tenant_id uuid,p_code text,p_name_en text,p_name_ar text,p_basis public.bonus_basis,p_tiers jsonb,p_effective_from date,p_effective_to date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_invalid boolean;
begin
  if not public.has_permission(p_tenant_id,'targets.manage') then raise exception 'Not authorized to configure bonus policies'; end if;
  if jsonb_typeof(p_tiers)<>'array' or jsonb_array_length(p_tiers)=0 then raise exception 'At least one bonus tier is required'; end if;
  select exists(select 1 from jsonb_array_elements(p_tiers) x where not (x ? 'min_percentage' and x ? 'value') or (x->>'min_percentage')::numeric<0 or (x->>'value')::numeric<0) into v_invalid;
  if v_invalid then raise exception 'Every tier needs non-negative min_percentage and value'; end if;
  insert into public.bonus_policies(tenant_id,code,name_en,name_ar,bonus_basis,tiers,effective_from,effective_to,created_by)
  values(p_tenant_id,upper(trim(p_code)),trim(p_name_en),nullif(trim(p_name_ar),''),p_basis,p_tiers,p_effective_from,p_effective_to,auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_sales_target(p_tenant_id uuid,p_code text,p_name text,p_start date,p_end date,p_scope public.performance_scope,p_scope_id uuid,p_amount numeric,p_currency text,p_policy_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_permission(p_tenant_id,'targets.manage') then raise exception 'Not authorized to configure sales targets'; end if;
  if p_end<p_start or p_amount<=0 then raise exception 'Invalid target period or amount'; end if;
  insert into public.sales_targets(tenant_id,code,name,period_start,period_end,scope_type,branch_id,team_id,employee_id,target_amount,currency_code,bonus_policy_id,created_by)
  values(p_tenant_id,upper(trim(p_code)),trim(p_name),p_start,p_end,p_scope,case when p_scope='branch' then p_scope_id end,case when p_scope='team' then p_scope_id end,case when p_scope='employee' then p_scope_id end,round(p_amount,2),upper(p_currency),p_policy_id,auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.calculate_bonus_target(p_target_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_target public.sales_targets%rowtype; v_policy public.bonus_policies%rowtype; v_actual numeric:=0; v_achievement numeric:=0; v_tier numeric:=0; v_count integer:=0; v_employee public.employees%rowtype; v_employee_sales numeric; v_salary numeric; v_bonus numeric;
begin
  select * into v_target from public.sales_targets where id=p_target_id for update;
  if v_target.id is null then raise exception 'Sales target not found'; end if;
  if not public.has_permission(v_target.tenant_id,'targets.manage') then raise exception 'Not authorized to calculate bonuses'; end if;
  select * into v_policy from public.bonus_policies where id=v_target.bonus_policy_id;
  if exists(select 1 from public.bonus_results where target_id=v_target.id and status in ('approved','paid')) then raise exception 'Approved or paid bonus results are locked'; end if;
  if v_target.scope_type='branch' then
    select coalesce(case when count(*) filter(where employee_id is null)>0 then sum(amount) filter(where employee_id is null) else sum(amount) end,0) into v_actual from public.sales_entries where tenant_id=v_target.tenant_id and branch_id=v_target.branch_id and business_date between v_target.period_start and v_target.period_end and status='approved';
  elsif v_target.scope_type='team' then
    select coalesce(sum(s.amount),0) into v_actual from public.sales_entries s join public.employees e on e.id=s.employee_id where s.tenant_id=v_target.tenant_id and e.team_id=v_target.team_id and s.business_date between v_target.period_start and v_target.period_end and s.status='approved';
  else
    select coalesce(sum(amount),0) into v_actual from public.sales_entries where tenant_id=v_target.tenant_id and employee_id=v_target.employee_id and business_date between v_target.period_start and v_target.period_end and status='approved';
  end if;
  v_achievement:=case when v_target.target_amount=0 then 0 else round(v_actual/v_target.target_amount*100,4) end;
  select coalesce((x->>'value')::numeric,0) into v_tier from jsonb_array_elements(v_policy.tiers) x where (x->>'min_percentage')::numeric<=v_achievement order by (x->>'min_percentage')::numeric desc limit 1;
  v_tier:=coalesce(v_tier,0);
  delete from public.bonus_results where target_id=v_target.id and status in ('calculated','rejected');
  for v_employee in
    select * from public.employees e where e.tenant_id=v_target.tenant_id and e.status<>'terminated' and ((v_target.scope_type='employee' and e.id=v_target.employee_id) or (v_target.scope_type='team' and e.team_id=v_target.team_id) or (v_target.scope_type='branch' and e.branch_id=v_target.branch_id))
  loop
    select coalesce(sum(amount),0) into v_employee_sales from public.sales_entries where tenant_id=v_target.tenant_id and employee_id=v_employee.id and business_date between v_target.period_start and v_target.period_end and status='approved';
    select coalesce(base_salary,0) into v_salary from public.employee_compensation where employee_id=v_employee.id and effective_from<=v_target.period_end and (effective_to is null or effective_to>=v_target.period_start) order by effective_from desc limit 1;
    v_salary:=coalesce(v_salary,0);
    v_bonus:=round(case v_policy.bonus_basis when 'fixed_amount' then v_tier when 'salary_percentage' then v_salary*v_tier/100 when 'sales_percentage' then v_employee_sales*v_tier/100 end,2);
    insert into public.bonus_results(tenant_id,target_id,employee_id,actual_sales,achievement_percentage,tier_value,bonus_amount,calculation_snapshot)
    values(v_target.tenant_id,v_target.id,v_employee.id,case when v_target.scope_type='employee' then v_actual else v_employee_sales end,v_achievement,v_tier,v_bonus,jsonb_build_object('target',to_jsonb(v_target),'policy',to_jsonb(v_policy),'scope_actual_sales',v_actual,'employee_sales',v_employee_sales,'base_salary',v_salary))
    on conflict(target_id,employee_id) do update set actual_sales=excluded.actual_sales,achievement_percentage=excluded.achievement_percentage,tier_value=excluded.tier_value,bonus_amount=excluded.bonus_amount,status='calculated',calculation_snapshot=excluded.calculation_snapshot,calculated_at=now(),approved_by=null,approved_at=null,payroll_period_id=null;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.review_bonus_target(p_target_id uuid,p_approve boolean,p_note text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_target public.sales_targets%rowtype; v_count integer;
begin
  select * into v_target from public.sales_targets where id=p_target_id;
  if v_target.id is null then raise exception 'Sales target not found'; end if;
  if not public.has_permission(v_target.tenant_id,'bonuses.approve') and not public.is_tenant_owner(v_target.tenant_id) then raise exception 'Not authorized to approve bonuses'; end if;
  if not p_approve and length(trim(p_note))<2 then raise exception 'A rejection reason is required'; end if;
  update public.bonus_results set status=case when p_approve then 'approved'::public.bonus_result_status else 'rejected'::public.bonus_result_status end,approved_by=case when p_approve then auth.uid() end,approved_at=case when p_approve then now() end,calculation_snapshot=calculation_snapshot||jsonb_build_object('review_note',nullif(trim(p_note),'')) where target_id=v_target.id and status='calculated';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

-- Extend payroll calculation without changing the audited base-pay engine.
alter function public.calculate_payroll_period(uuid) rename to calculate_payroll_period_without_financial_services;

create or replace function public.calculate_payroll_period(p_period_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_period public.payroll_periods%rowtype; v_result public.payroll_employee_results%rowtype; v_item record;
begin
  v_count:=public.calculate_payroll_period_without_financial_services(p_period_id);
  select * into v_period from public.payroll_periods where id=p_period_id;
  for v_result in select * from public.payroll_employee_results where period_id=p_period_id loop
    for v_item in select i.id,i.amount-i.paid_amount as amount,l.loan_number from public.loan_installments i join public.employee_loans l on l.id=i.loan_id where l.employee_id=v_result.employee_id and l.status='active' and i.status in ('scheduled','partial','deferred') and i.due_date between v_period.period_start and v_period.period_end and i.paid_amount<i.amount loop
      insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate,source_reference)
      values(v_result.tenant_id,v_result.id,'loan_installment','Loan installment '||v_item.loan_number,'قسط سلفة '||v_item.loan_number,'deduction','loan',v_item.amount,1,v_item.amount,v_item.id::text);
    end loop;
    for v_item in select br.id,br.bonus_amount,t.name from public.bonus_results br join public.sales_targets t on t.id=br.target_id where br.employee_id=v_result.employee_id and br.status='approved' and br.bonus_amount>0 and br.payroll_period_id is null and t.period_end between v_period.period_start and v_period.period_end loop
      insert into public.payroll_components(tenant_id,result_id,code,name_en,name_ar,kind,source_type,amount,quantity,rate,source_reference)
      values(v_result.tenant_id,v_result.id,'sales_bonus','Sales bonus · '||v_item.name,'مكافأة مبيعات · '||v_item.name,'earning','bonus',v_item.bonus_amount,1,v_item.bonus_amount,v_item.id::text);
    end loop;
    perform public.recalculate_payroll_result_totals(v_result.id);
  end loop;
  return v_count;
end;
$$;

alter function public.transition_payroll_period(uuid,public.payroll_period_status,text) rename to transition_payroll_period_without_financial_services;

create or replace function public.transition_payroll_period(p_period_id uuid,p_target public.payroll_period_status,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_period public.payroll_periods%rowtype; v_component record; v_loan public.employee_loans%rowtype;
begin
  perform public.transition_payroll_period_without_financial_services(p_period_id,p_target,p_note);
  if p_target<>'published' then return; end if;
  select * into v_period from public.payroll_periods where id=p_period_id;
  for v_component in select c.id,c.amount,c.source_type,c.source_reference,r.employee_id from public.payroll_components c join public.payroll_employee_results r on r.id=c.result_id where r.period_id=p_period_id and c.source_type in ('loan','bonus') loop
    if v_component.source_type='loan' then
      select l.* into v_loan from public.employee_loans l join public.loan_installments i on i.loan_id=l.id where i.id=v_component.source_reference::uuid for update;
      insert into public.loan_payments(tenant_id,loan_id,installment_id,amount,payment_date,method,reference,notes,payroll_component_id,recorded_by)
      select i.tenant_id,i.loan_id,i.id,v_component.amount,coalesce(v_period.pay_date,v_period.period_end),'payroll',v_period.code,'Payroll deduction',v_component.id,auth.uid() from public.loan_installments i where i.id=v_component.source_reference::uuid on conflict(payroll_component_id) do nothing;
      update public.loan_installments set paid_amount=least(amount,paid_amount+v_component.amount),status='deducted',paid_at=now(),updated_at=now() where id=v_component.source_reference::uuid;
      update public.employee_loans set total_paid=least(approved_amount,total_paid+v_component.amount),remaining_balance=greatest(0,remaining_balance-v_component.amount),status=case when remaining_balance-v_component.amount<=0 then 'settled'::public.employee_loan_status else status end,settled_at=case when remaining_balance-v_component.amount<=0 then now() else settled_at end,updated_at=now() where id=v_loan.id;
    else
      update public.bonus_results set status='paid',payroll_period_id=p_period_id where id=v_component.source_reference::uuid and status='approved';
    end if;
  end loop;
end;
$$;

create trigger loan_requests_updated_at before update on public.loan_requests for each row execute function public.set_updated_at();
create trigger employee_loans_updated_at before update on public.employee_loans for each row execute function public.set_updated_at();
create trigger loan_installments_updated_at before update on public.loan_installments for each row execute function public.set_updated_at();
create trigger sales_entries_updated_at before update on public.sales_entries for each row execute function public.set_updated_at();
create trigger bonus_policies_updated_at before update on public.bonus_policies for each row execute function public.set_updated_at();
create trigger sales_targets_updated_at before update on public.sales_targets for each row execute function public.set_updated_at();

create trigger audit_loan_requests after insert or update or delete on public.loan_requests for each row execute function public.capture_audit_log();
create trigger audit_employee_loans after insert or update or delete on public.employee_loans for each row execute function public.capture_audit_log();
create trigger audit_loan_installments after insert or update or delete on public.loan_installments for each row execute function public.capture_audit_log();
create trigger audit_loan_payments after insert or update or delete on public.loan_payments for each row execute function public.capture_audit_log();
create trigger audit_sales_entries after insert or update or delete on public.sales_entries for each row execute function public.capture_audit_log();
create trigger audit_bonus_policies after insert or update or delete on public.bonus_policies for each row execute function public.capture_audit_log();
create trigger audit_sales_targets after insert or update or delete on public.sales_targets for each row execute function public.capture_audit_log();
create trigger audit_bonus_results after insert or update or delete on public.bonus_results for each row execute function public.capture_audit_log();

alter table public.loan_requests enable row level security;
alter table public.employee_loans enable row level security;
alter table public.loan_installments enable row level security;
alter table public.loan_payments enable row level security;
alter table public.sales_entries enable row level security;
alter table public.bonus_policies enable row level security;
alter table public.sales_targets enable row level security;
alter table public.bonus_results enable row level security;

create policy loan_requests_read on public.loan_requests for select to authenticated using(public.can_view_employee_finance(tenant_id,employee_id));
create policy employee_loans_read on public.employee_loans for select to authenticated using(public.can_view_employee_finance(tenant_id,employee_id));
create policy loan_installments_read on public.loan_installments for select to authenticated using(exists(select 1 from public.employee_loans l where l.id=loan_id and public.can_view_employee_finance(l.tenant_id,l.employee_id)));
create policy loan_payments_read on public.loan_payments for select to authenticated using(exists(select 1 from public.employee_loans l where l.id=loan_id and public.can_view_employee_finance(l.tenant_id,l.employee_id)));
create policy sales_entries_read on public.sales_entries for select to authenticated using(
  public.has_permission(tenant_id,'sales.approve') or public.has_permission(tenant_id,'targets.manage')
  or employee_id=public.current_employee_id(tenant_id)
  or (employee_id is null and branch_id=(select e.branch_id from public.employees e where e.id=public.current_employee_id(tenant_id)))
);
create policy bonus_policies_read on public.bonus_policies for select to authenticated using(public.has_permission(tenant_id,'sales.read'));
create policy sales_targets_read on public.sales_targets for select to authenticated using(public.has_permission(tenant_id,'sales.read'));
create policy bonus_results_read on public.bonus_results for select to authenticated using(public.has_permission(tenant_id,'sales.read') or employee_id=public.current_employee_id(tenant_id));

grant select on public.loan_requests,public.employee_loans,public.loan_installments,public.loan_payments,public.sales_entries,public.bonus_policies,public.sales_targets,public.bonus_results to authenticated;
grant all on public.loan_requests,public.employee_loans,public.loan_installments,public.loan_payments,public.sales_entries,public.bonus_policies,public.sales_targets,public.bonus_results to service_role;

grant execute on function public.can_view_employee_finance(uuid,uuid) to authenticated;
grant execute on function public.submit_loan_request(uuid,numeric,integer,date,text) to authenticated;
grant execute on function public.cancel_loan_request(uuid,text) to authenticated;
grant execute on function public.review_loan_request(uuid,boolean,numeric,integer,date,text) to authenticated;
grant execute on function public.record_loan_payment(uuid,numeric,date,public.loan_payment_method,text,text) to authenticated;
grant execute on function public.reschedule_loan_installment(uuid,date,text) to authenticated;
grant execute on function public.set_employee_loan_status(uuid,public.employee_loan_status,text) to authenticated;
grant execute on function public.record_sales_entry(uuid,date,uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.review_sales_entry(uuid,boolean,text) to authenticated;
grant execute on function public.create_bonus_policy(uuid,text,text,text,public.bonus_basis,jsonb,date,date) to authenticated;
grant execute on function public.create_sales_target(uuid,text,text,date,date,public.performance_scope,uuid,numeric,text,uuid) to authenticated;
grant execute on function public.calculate_bonus_target(uuid) to authenticated;
grant execute on function public.review_bonus_target(uuid,boolean,text) to authenticated;
grant execute on function public.calculate_payroll_period(uuid) to authenticated;
grant execute on function public.transition_payroll_period(uuid,public.payroll_period_status,text) to authenticated;

revoke execute on function public.grant_business_permissions_for_role() from public,anon,authenticated;
revoke execute on function public.validate_financial_service_links() from public,anon,authenticated;
revoke execute on function public.validate_performance_links() from public,anon,authenticated;
revoke execute on function public.can_view_employee_finance(uuid,uuid) from public,anon;
revoke execute on function public.submit_loan_request(uuid,numeric,integer,date,text) from public,anon;
revoke execute on function public.cancel_loan_request(uuid,text) from public,anon;
revoke execute on function public.review_loan_request(uuid,boolean,numeric,integer,date,text) from public,anon;
revoke execute on function public.record_loan_payment(uuid,numeric,date,public.loan_payment_method,text,text) from public,anon;
revoke execute on function public.reschedule_loan_installment(uuid,date,text) from public,anon;
revoke execute on function public.set_employee_loan_status(uuid,public.employee_loan_status,text) from public,anon;
revoke execute on function public.record_sales_entry(uuid,date,uuid,uuid,numeric,text,text,text) from public,anon;
revoke execute on function public.review_sales_entry(uuid,boolean,text) from public,anon;
revoke execute on function public.create_bonus_policy(uuid,text,text,text,public.bonus_basis,jsonb,date,date) from public,anon;
revoke execute on function public.create_sales_target(uuid,text,text,date,date,public.performance_scope,uuid,numeric,text,uuid) from public,anon;
revoke execute on function public.calculate_bonus_target(uuid) from public,anon;
revoke execute on function public.review_bonus_target(uuid,boolean,text) from public,anon;
revoke execute on function public.calculate_payroll_period_without_financial_services(uuid) from public,anon,authenticated;
revoke execute on function public.transition_payroll_period_without_financial_services(uuid,public.payroll_period_status,text) from public,anon,authenticated;
revoke execute on function public.calculate_payroll_period(uuid) from public,anon;
revoke execute on function public.transition_payroll_period(uuid,public.payroll_period_status,text) from public,anon;
