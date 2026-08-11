-- Reusable employee request catalogue, versioned approval workflows, and in-app notifications.

create type public.hr_request_status as enum ('submitted', 'in_review', 'approved', 'rejected', 'cancelled');
create type public.request_approver_kind as enum ('manager', 'owner', 'hr', 'role');
create type public.request_approval_mode as enum ('any', 'all', 'count');
create type public.request_decision as enum ('approved', 'rejected');

create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{2,60}$'),
  category text not null check (category in ('attendance', 'scheduling', 'employment', 'general')),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  form_schema jsonb not null default '{}'::jsonb,
  requires_attachment boolean not null default false,
  requires_reason boolean not null default true,
  allow_date_range boolean not null default false,
  allow_time_range boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  version integer not null check (version > 0),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (request_type_id, version)
);

create unique index approval_workflows_one_active_idx
  on public.approval_workflows(request_type_id) where is_active;

create table public.approval_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  step_order integer not null check (step_order between 1 and 50),
  name_en text not null,
  name_ar text not null,
  approver_kind public.request_approver_kind not null,
  role_id uuid references public.roles(id) on delete restrict,
  approval_mode public.request_approval_mode not null default 'any',
  approvals_required integer not null default 1 check (approvals_required between 1 and 50),
  sla_hours integer check (sla_hours is null or sla_hours between 1 and 8760),
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order),
  check ((approver_kind = 'role' and role_id is not null) or (approver_kind <> 'role' and role_id is null))
);

create table public.hr_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  request_type_id uuid not null references public.request_types(id) on delete restrict,
  workflow_id uuid not null references public.approval_workflows(id) on delete restrict,
  current_step_id uuid references public.approval_workflow_steps(id) on delete restrict,
  status public.hr_request_status not null default 'submitted',
  title text,
  reason text,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  requested_minutes integer check (requested_minutes is null or requested_minutes between 1 and 1440),
  payload jsonb not null default '{}'::jsonb,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is not null),
  check (end_date is null or end_date >= start_date)
);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.hr_requests(id) on delete cascade,
  object_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (object_path)
);

create table public.request_approval_actions (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.hr_requests(id) on delete cascade,
  workflow_step_id uuid not null references public.approval_workflow_steps(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  decision public.request_decision not null,
  note text,
  acted_at timestamptz not null default now(),
  unique (request_id, workflow_step_id, actor_user_id)
);

create table public.request_status_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null references public.hr_requests(id) on delete cascade,
  from_status public.hr_request_status,
  to_status public.hr_request_status not null,
  workflow_step_id uuid references public.approval_workflow_steps(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z0-9_.-]{2,80}$'),
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  href text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index request_types_tenant_active_idx on public.request_types(tenant_id, is_active, category);
create index approval_workflows_type_idx on public.approval_workflows(request_type_id, is_active, version desc);
create index approval_workflow_steps_order_idx on public.approval_workflow_steps(workflow_id, step_order);
create index hr_requests_tenant_status_idx on public.hr_requests(tenant_id, status, submitted_at desc);
create index hr_requests_employee_idx on public.hr_requests(employee_id, submitted_at desc);
create index request_approval_actions_request_idx on public.request_approval_actions(request_id, acted_at);
create index request_status_events_request_idx on public.request_status_events(request_id, created_at);
create index notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at desc);

insert into public.permissions(key, description, module) values
  ('requests.read', 'View personal employee requests', 'requests'),
  ('requests.read_all', 'View employee requests across the company', 'requests'),
  ('requests.create', 'Submit personal employee requests', 'requests'),
  ('requests.approve', 'Review employee requests assigned by a workflow', 'requests'),
  ('requests.manage', 'Manage request types and versioned approval workflows', 'requests'),
  ('notifications.read', 'View and acknowledge personal notifications', 'notifications')
on conflict (key) do nothing;

create or replace function public.validate_request_workflow_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type_tenant uuid;
  v_workflow_tenant uuid;
  v_role_tenant uuid;
begin
  if tg_table_name = 'approval_workflows' then
    select tenant_id into v_type_tenant from public.request_types where id = new.request_type_id;
    if v_type_tenant is distinct from new.tenant_id then raise exception 'Workflow and request type must belong to the same company'; end if;
  elsif tg_table_name = 'approval_workflow_steps' then
    select tenant_id into v_workflow_tenant from public.approval_workflows where id = new.workflow_id;
    if v_workflow_tenant is distinct from new.tenant_id then raise exception 'Workflow step must belong to the same company'; end if;
    if new.role_id is not null then
      select tenant_id into v_role_tenant from public.roles where id = new.role_id;
      if v_role_tenant is distinct from new.tenant_id then raise exception 'Approver role must belong to the same company'; end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_approval_workflow_links
before insert or update on public.approval_workflows
for each row execute function public.validate_request_workflow_links();
create trigger validate_approval_workflow_step_links
before insert or update on public.approval_workflow_steps
for each row execute function public.validate_request_workflow_links();

create or replace function public.prevent_active_workflow_step_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow_id uuid := coalesce(new.workflow_id, old.workflow_id);
begin
  if exists (select 1 from public.approval_workflows where id = v_workflow_id and is_active) then
    raise exception 'Active workflows are immutable; create a new version before editing steps';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger prevent_active_workflow_step_mutation
before insert or update or delete on public.approval_workflow_steps
for each row execute function public.prevent_active_workflow_step_changes();

create or replace function public.seed_request_defaults(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type record;
  v_workflow_id uuid;
begin
  insert into public.request_types(
    tenant_id, code, category, name_en, name_ar, description_en, description_ar,
    form_schema, requires_attachment, requires_reason, allow_date_range, allow_time_range
  ) values
    (p_tenant_id, 'late_arrival', 'attendance', 'Late arrival permission', 'إذن تأخير', 'Request approval to arrive after the scheduled start.', 'طلب موافقة للحضور بعد بداية الوردية.', '{"fields":["start_date","start_time"]}', false, true, false, true),
    (p_tenant_id, 'early_departure', 'attendance', 'Early departure permission', 'إذن انصراف مبكر', 'Request approval to leave before the scheduled end.', 'طلب موافقة للانصراف قبل نهاية الوردية.', '{"fields":["start_date","end_time"]}', false, true, false, true),
    (p_tenant_id, 'hourly_permission', 'attendance', 'Hourly permission', 'إذن ساعي', 'Request a specific period away from work during a shift.', 'طلب فترة محددة خارج العمل أثناء الوردية.', '{"fields":["start_date","start_time","end_time","requested_minutes"]}', false, true, false, true),
    (p_tenant_id, 'attendance_correction', 'attendance', 'Attendance correction', 'تصحيح الحضور', 'Correct a missing or inaccurate attendance event.', 'تصحيح بصمة ناقصة أو غير دقيقة.', '{"fields":["start_date","start_time","end_time"],"attachment_optional":true}', false, true, false, true),
    (p_tenant_id, 'branch_exception', 'attendance', 'Branch attendance exception', 'استثناء فرع الحضور', 'Request permission to clock at a branch other than the assigned branch.', 'طلب إذن للتسجيل من فرع غير الفرع المعين.', '{"fields":["start_date","branch_id"],"attachment_optional":true}', false, true, false, false),
    (p_tenant_id, 'overtime', 'attendance', 'Overtime request', 'طلب وقت إضافي', 'Request or confirm approved overtime hours.', 'طلب أو اعتماد ساعات العمل الإضافية.', '{"fields":["start_date","start_time","end_time","requested_minutes"]}', false, true, false, true),
    (p_tenant_id, 'schedule_change', 'scheduling', 'Schedule change', 'تغيير الجدول', 'Request a shift swap or another schedule change.', 'طلب تبديل وردية أو تغيير آخر في الجدول.', '{"fields":["start_date","end_date"],"attachment_optional":true}', false, true, true, false),
    (p_tenant_id, 'general_hr', 'general', 'General HR request', 'طلب موارد بشرية عام', 'Submit a documented request to HR.', 'إرسال طلب موثق إلى الموارد البشرية.', '{"fields":["title"]}', false, true, false, false)
  on conflict (tenant_id, code) do update set
    category = excluded.category,
    name_en = excluded.name_en,
    name_ar = excluded.name_ar,
    description_en = excluded.description_en,
    description_ar = excluded.description_ar,
    form_schema = excluded.form_schema;

  for v_type in select id, name_en, name_ar from public.request_types where tenant_id = p_tenant_id loop
    if not exists (select 1 from public.approval_workflows where request_type_id = v_type.id) then
      insert into public.approval_workflows(tenant_id, request_type_id, name_en, name_ar, version, is_active, activated_at)
      values (p_tenant_id, v_type.id, v_type.name_en || ' approval', 'اعتماد ' || v_type.name_ar, 1, false, now())
      returning id into v_workflow_id;

      insert into public.approval_workflow_steps(
        tenant_id, workflow_id, step_order, name_en, name_ar, approver_kind, approval_mode, approvals_required, sla_hours
      ) values
        (p_tenant_id, v_workflow_id, 1, 'Line manager review', 'مراجعة المدير المباشر', 'manager', 'any', 1, 24),
        (p_tenant_id, v_workflow_id, 2, 'Owner final approval', 'اعتماد المالك النهائي', 'owner', 'any', 1, 24);

      update public.approval_workflows set is_active = true where id = v_workflow_id;
    end if;
  end loop;
end;
$$;

create or replace function public.grant_request_permissions_for_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name = 'owner' then
    insert into public.role_permissions(role_id, permission_key)
    select new.id, p.key from public.permissions p where p.module in ('requests', 'notifications') on conflict do nothing;
  elsif new.name = 'hr_admin' then
    insert into public.role_permissions(role_id, permission_key)
    select new.id, p.key from public.permissions p where p.module in ('requests', 'notifications') on conflict do nothing;
  elsif new.name in ('branch_manager', 'team_manager') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'requests.read'), (new.id, 'requests.create'), (new.id, 'requests.approve'), (new.id, 'notifications.read')
    on conflict do nothing;
  elsif new.name in ('payroll_officer', 'accountant') then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'requests.read'), (new.id, 'requests.read_all'), (new.id, 'notifications.read')
    on conflict do nothing;
  elsif new.name = 'employee' then
    insert into public.role_permissions(role_id, permission_key) values
      (new.id, 'requests.read'), (new.id, 'requests.create'), (new.id, 'notifications.read')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_request_permissions_after_role
after insert on public.roles
for each row execute function public.grant_request_permissions_for_role();

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.module in ('requests', 'notifications')
  and (
    r.name in ('owner', 'hr_admin')
    or (r.name in ('branch_manager', 'team_manager') and p.key in ('requests.read', 'requests.create', 'requests.approve', 'notifications.read'))
    or (r.name in ('payroll_officer', 'accountant') and p.key in ('requests.read', 'requests.read_all', 'notifications.read'))
    or (r.name = 'employee' and p.key in ('requests.read', 'requests.create', 'notifications.read'))
  )
on conflict do nothing;

select public.seed_request_defaults(id) from public.tenants;

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
  perform public.seed_request_defaults(new.id);
  return new;
end;
$$;

create or replace function public.can_view_hr_request(p_tenant_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.has_permission(p_tenant_id, 'requests.read_all')
    or p_employee_id = public.current_employee_id(p_tenant_id)
    or (
      public.has_permission(p_tenant_id, 'requests.approve')
      and exists (
        select 1
        from public.employees viewer
        join public.employees target on target.id = p_employee_id and target.tenant_id = viewer.tenant_id
        where viewer.id = public.current_employee_id(p_tenant_id)
          and (target.manager_employee_id = viewer.id or target.branch_id = viewer.branch_id or (viewer.team_id is not null and target.team_id = viewer.team_id))
      )
    );
$$;

create or replace function public.request_step_actor_users(p_step_id uuid, p_request_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select s.approver_kind, s.role_id, r.tenant_id, r.employee_id
    from public.approval_workflow_steps s
    join public.hr_requests r on r.id = p_request_id and r.workflow_id = s.workflow_id
    where s.id = p_step_id
  )
  select distinct resolved.user_id
  from (
    select manager.user_id
    from context c
    join public.employees employee on employee.id = c.employee_id
    join public.employees manager on manager.id = employee.manager_employee_id
    where c.approver_kind = 'manager' and manager.user_id is not null
    union all
    select m.user_id
    from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    where c.approver_kind = 'owner' and m.is_owner
    union all
    select m.user_id
    from context c
    join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles role on role.id = mr.role_id
    where c.approver_kind = 'hr' and role.name = 'hr_admin'
    union all
    select m.user_id
    from context c
    join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id and mr.role_id = c.role_id
    where c.approver_kind = 'role'
  ) resolved
  where resolved.user_id is not null;
$$;

create or replace function public.next_request_step(p_workflow_id uuid, p_request_id uuid, p_after_order integer default 0)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.approval_workflow_steps s
  where s.workflow_id = p_workflow_id
    and s.step_order > p_after_order
    and exists (select 1 from public.request_step_actor_users(s.id, p_request_id))
  order by s.step_order
  limit 1;
$$;

create or replace function public.queue_request_step_notifications(p_request_id uuid, p_step_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hr_requests%rowtype;
  v_type public.request_types%rowtype;
  v_employee public.employees%rowtype;
begin
  select * into v_request from public.hr_requests where id = p_request_id;
  select * into v_type from public.request_types where id = v_request.request_type_id;
  select * into v_employee from public.employees where id = v_request.employee_id;
  insert into public.notifications(
    tenant_id, recipient_user_id, kind, title_en, title_ar, body_en, body_ar, href, entity_type, entity_id
  )
  select v_request.tenant_id, actors.user_id, 'request.approval', 'Request awaiting your approval', 'طلب ينتظر اعتمادك',
    coalesce(v_employee.name_en, v_employee.employee_code) || ' submitted ' || v_type.name_en,
    coalesce(v_employee.name_ar, v_employee.name_en, v_employee.employee_code) || ' أرسل ' || v_type.name_ar,
    '/en/requests?request=' || v_request.id::text, 'hr_requests', v_request.id::text
  from public.request_step_actor_users(p_step_id, p_request_id) actors
  where actors.user_id is distinct from auth.uid();
end;
$$;

create or replace function public.notify_request_employee(p_request_id uuid, p_kind text, p_title_en text, p_title_ar text, p_body_en text, p_body_ar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hr_requests%rowtype;
  v_user_id uuid;
begin
  select * into v_request from public.hr_requests where id = p_request_id;
  select user_id into v_user_id from public.employees where id = v_request.employee_id;
  if v_user_id is not null and v_user_id is distinct from auth.uid() then
    insert into public.notifications(tenant_id, recipient_user_id, kind, title_en, title_ar, body_en, body_ar, href, entity_type, entity_id)
    values (v_request.tenant_id, v_user_id, p_kind, p_title_en, p_title_ar, p_body_en, p_body_ar, '/en/requests?request=' || p_request_id::text, 'hr_requests', p_request_id::text);
  end if;
end;
$$;

create or replace function public.submit_hr_request(
  p_employee_id uuid,
  p_request_type_id uuid,
  p_title text,
  p_reason text,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_requested_minutes integer,
  p_payload jsonb,
  p_has_attachment boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_type public.request_types%rowtype;
  v_workflow public.approval_workflows%rowtype;
  v_request_id uuid;
  v_first_step uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  select * into v_type from public.request_types where id = p_request_type_id and is_active;
  if v_employee.id is null or v_type.id is null or v_employee.tenant_id <> v_type.tenant_id then raise exception 'Invalid employee or request type'; end if;
  if auth.uid() is not null
     and p_employee_id <> public.current_employee_id(v_employee.tenant_id)
     and not public.has_permission(v_employee.tenant_id, 'requests.manage')
  then raise exception 'Not authorized to submit for this employee'; end if;
  if v_employee.status = 'terminated' then raise exception 'Terminated employees cannot submit requests'; end if;
  if v_type.requires_reason and coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'A reason is required'; end if;
  if v_type.requires_attachment and not p_has_attachment then raise exception 'A supporting attachment is required'; end if;
  if p_end_date is not null and not v_type.allow_date_range and p_end_date <> p_start_date then raise exception 'This request type does not allow a date range'; end if;
  if (p_start_time is not null or p_end_time is not null) and not v_type.allow_time_range then raise exception 'This request type does not allow a time range'; end if;

  select * into v_workflow
  from public.approval_workflows
  where request_type_id = v_type.id and is_active
  order by version desc limit 1;
  if v_workflow.id is null then raise exception 'No active approval workflow is configured for this request type'; end if;

  insert into public.hr_requests(
    tenant_id, employee_id, request_type_id, workflow_id, title, reason, start_date, end_date,
    start_time, end_time, requested_minutes, payload, submitted_by
  ) values (
    v_employee.tenant_id, v_employee.id, v_type.id, v_workflow.id, nullif(trim(p_title), ''), nullif(trim(p_reason), ''),
    p_start_date, p_end_date, p_start_time, p_end_time, p_requested_minutes, coalesce(p_payload, '{}'::jsonb), auth.uid()
  ) returning id into v_request_id;

  v_first_step := public.next_request_step(v_workflow.id, v_request_id, 0);
  if v_first_step is null then
    update public.hr_requests set status = 'approved', resolved_at = now(), resolution_note = 'Automatically approved because no workflow approver was available' where id = v_request_id;
    insert into public.request_status_events(tenant_id, request_id, from_status, to_status, actor_user_id, note)
    values (v_employee.tenant_id, v_request_id, null, 'approved', auth.uid(), 'Automatically approved');
  else
    update public.hr_requests set status = 'in_review', current_step_id = v_first_step where id = v_request_id;
    insert into public.request_status_events(tenant_id, request_id, from_status, to_status, workflow_step_id, actor_user_id, note)
    values (v_employee.tenant_id, v_request_id, null, 'in_review', v_first_step, auth.uid(), 'Request submitted');
    perform public.queue_request_step_notifications(v_request_id, v_first_step);
  end if;
  return v_request_id;
end;
$$;

create or replace function public.attach_request_document(
  p_request_id uuid,
  p_object_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hr_requests%rowtype;
  v_id uuid;
begin
  select * into v_request from public.hr_requests where id = p_request_id;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if v_request.employee_id <> public.current_employee_id(v_request.tenant_id)
     and not public.has_permission(v_request.tenant_id, 'requests.manage')
  then raise exception 'Not authorized to attach a document'; end if;
  if p_object_path not like v_request.tenant_id::text || '/' || v_request.employee_id::text || '/' || v_request.id::text || '/%' then raise exception 'Invalid request-document path'; end if;
  insert into public.request_attachments(tenant_id, request_id, object_path, file_name, mime_type, size_bytes, uploaded_by)
  values (v_request.tenant_id, v_request.id, p_object_path, p_file_name, p_mime_type, p_size_bytes, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.can_approve_hr_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hr_requests r
    join public.request_step_actor_users(r.current_step_id, r.id) actors on actors.user_id = auth.uid()
    where r.id = p_request_id and r.status = 'in_review'
  ) or public.is_platform_admin();
$$;

create or replace function public.review_hr_request(p_request_id uuid, p_decision public.request_decision, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hr_requests%rowtype;
  v_step public.approval_workflow_steps%rowtype;
  v_required integer;
  v_approved integer;
  v_next_step uuid;
begin
  select * into v_request from public.hr_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if v_request.status <> 'in_review' or v_request.current_step_id is null then raise exception 'This request is not awaiting approval'; end if;
  if not public.can_approve_hr_request(v_request.id) then raise exception 'This approval is not assigned to you'; end if;
  if p_decision = 'rejected' and coalesce(length(trim(p_note)), 0) = 0 then raise exception 'A rejection reason is required'; end if;
  select * into v_step from public.approval_workflow_steps where id = v_request.current_step_id;

  insert into public.request_approval_actions(tenant_id, request_id, workflow_step_id, actor_user_id, decision, note)
  values (v_request.tenant_id, v_request.id, v_step.id, auth.uid(), p_decision, nullif(trim(p_note), ''));

  if p_decision = 'rejected' then
    update public.hr_requests set status = 'rejected', current_step_id = null, resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(trim(p_note), '') where id = v_request.id;
    insert into public.request_status_events(tenant_id, request_id, from_status, to_status, workflow_step_id, actor_user_id, note)
    values (v_request.tenant_id, v_request.id, 'in_review', 'rejected', v_step.id, auth.uid(), nullif(trim(p_note), ''));
    perform public.notify_request_employee(v_request.id, 'request.rejected', 'Request rejected', 'تم رفض الطلب', coalesce(trim(p_note), 'Your request was rejected.'), coalesce(trim(p_note), 'تم رفض طلبك.'));
    return;
  end if;

  v_required := case
    when v_step.approval_mode = 'any' then 1
    when v_step.approval_mode = 'count' then v_step.approvals_required
    else greatest(1, (select count(*) from public.request_step_actor_users(v_step.id, v_request.id)))
  end;
  select count(*) into v_approved from public.request_approval_actions
  where request_id = v_request.id and workflow_step_id = v_step.id and decision = 'approved';
  if v_approved < v_required then return; end if;

  v_next_step := public.next_request_step(v_request.workflow_id, v_request.id, v_step.step_order);
  if v_next_step is null then
    update public.hr_requests set status = 'approved', current_step_id = null, resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(trim(p_note), '') where id = v_request.id;
    insert into public.request_status_events(tenant_id, request_id, from_status, to_status, workflow_step_id, actor_user_id, note)
    values (v_request.tenant_id, v_request.id, 'in_review', 'approved', v_step.id, auth.uid(), nullif(trim(p_note), ''));
    perform public.notify_request_employee(v_request.id, 'request.approved', 'Request approved', 'تم اعتماد الطلب', 'Your request completed its approval workflow.', 'اكتمل مسار اعتماد طلبك.');
  else
    update public.hr_requests set current_step_id = v_next_step where id = v_request.id;
    insert into public.request_status_events(tenant_id, request_id, from_status, to_status, workflow_step_id, actor_user_id, note)
    values (v_request.tenant_id, v_request.id, 'in_review', 'in_review', v_next_step, auth.uid(), 'Advanced to the next approval step');
    perform public.queue_request_step_notifications(v_request.id, v_next_step);
  end if;
end;
$$;

create or replace function public.cancel_hr_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.hr_requests%rowtype;
begin
  select * into v_request from public.hr_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if v_request.employee_id <> public.current_employee_id(v_request.tenant_id)
     and not public.has_permission(v_request.tenant_id, 'requests.manage')
  then raise exception 'Not authorized to cancel this request'; end if;
  if v_request.status not in ('submitted', 'in_review') then raise exception 'Only an open request can be cancelled'; end if;
  if coalesce(length(trim(p_reason)), 0) < 2 then raise exception 'A cancellation reason is required'; end if;
  update public.hr_requests set status = 'cancelled', current_step_id = null, cancelled_by = auth.uid(), cancelled_at = now(), cancellation_reason = trim(p_reason) where id = v_request.id;
  insert into public.request_status_events(tenant_id, request_id, from_status, to_status, actor_user_id, note)
  values (v_request.tenant_id, v_request.id, v_request.status, 'cancelled', auth.uid(), trim(p_reason));
end;
$$;

create or replace function public.clone_request_workflow(p_workflow_id uuid, p_name_en text, p_name_ar text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.approval_workflows%rowtype;
  v_new_id uuid;
  v_version integer;
begin
  select * into v_workflow from public.approval_workflows where id = p_workflow_id;
  if v_workflow.id is null then raise exception 'Workflow not found'; end if;
  if not public.has_permission(v_workflow.tenant_id, 'requests.manage') then raise exception 'Not authorized to manage workflows'; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.approval_workflows where request_type_id = v_workflow.request_type_id;
  insert into public.approval_workflows(tenant_id, request_type_id, name_en, name_ar, version, is_active, created_by)
  values (v_workflow.tenant_id, v_workflow.request_type_id, coalesce(nullif(trim(p_name_en), ''), v_workflow.name_en), coalesce(nullif(trim(p_name_ar), ''), v_workflow.name_ar), v_version, false, auth.uid())
  returning id into v_new_id;
  insert into public.approval_workflow_steps(tenant_id, workflow_id, step_order, name_en, name_ar, approver_kind, role_id, approval_mode, approvals_required, sla_hours)
  select tenant_id, v_new_id, step_order, name_en, name_ar, approver_kind, role_id, approval_mode, approvals_required, sla_hours
  from public.approval_workflow_steps where workflow_id = v_workflow.id order by step_order;
  return v_new_id;
end;
$$;

create or replace function public.activate_request_workflow(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.approval_workflows%rowtype;
begin
  select * into v_workflow from public.approval_workflows where id = p_workflow_id for update;
  if v_workflow.id is null then raise exception 'Workflow not found'; end if;
  if not public.has_permission(v_workflow.tenant_id, 'requests.manage') then raise exception 'Not authorized to manage workflows'; end if;
  if not exists (select 1 from public.approval_workflow_steps where workflow_id = v_workflow.id) then raise exception 'A workflow needs at least one approval step'; end if;
  update public.approval_workflows set is_active = false where request_type_id = v_workflow.request_type_id and is_active;
  update public.approval_workflows set is_active = true, activated_at = now() where id = v_workflow.id;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = coalesce(read_at, now()) where id = p_notification_id and recipient_user_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications set read_at = now()
  where tenant_id = p_tenant_id and recipient_user_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create trigger request_types_updated_at before update on public.request_types for each row execute function public.set_updated_at();
create trigger hr_requests_updated_at before update on public.hr_requests for each row execute function public.set_updated_at();
create trigger audit_request_types after insert or update or delete on public.request_types for each row execute function public.capture_audit_log();
create trigger audit_approval_workflows after insert or update or delete on public.approval_workflows for each row execute function public.capture_audit_log();
create trigger audit_approval_workflow_steps after insert or update or delete on public.approval_workflow_steps for each row execute function public.capture_audit_log();
create trigger audit_hr_requests after insert or update or delete on public.hr_requests for each row execute function public.capture_audit_log();
create trigger audit_request_approval_actions after insert or update or delete on public.request_approval_actions for each row execute function public.capture_audit_log();

alter table public.request_types enable row level security;
alter table public.approval_workflows enable row level security;
alter table public.approval_workflow_steps enable row level security;
alter table public.hr_requests enable row level security;
alter table public.request_attachments enable row level security;
alter table public.request_approval_actions enable row level security;
alter table public.request_status_events enable row level security;
alter table public.notifications enable row level security;

create policy request_types_read on public.request_types for select to authenticated using (public.is_tenant_member(tenant_id));
create policy request_types_manage on public.request_types for all to authenticated using (public.has_permission(tenant_id, 'requests.manage')) with check (public.has_permission(tenant_id, 'requests.manage'));
create policy approval_workflows_read on public.approval_workflows for select to authenticated using (public.is_tenant_member(tenant_id));
create policy approval_workflows_manage on public.approval_workflows for all to authenticated using (public.has_permission(tenant_id, 'requests.manage')) with check (public.has_permission(tenant_id, 'requests.manage'));
create policy approval_workflow_steps_read on public.approval_workflow_steps for select to authenticated using (public.is_tenant_member(tenant_id));
create policy approval_workflow_steps_manage on public.approval_workflow_steps for all to authenticated using (public.has_permission(tenant_id, 'requests.manage')) with check (public.has_permission(tenant_id, 'requests.manage'));
create policy hr_requests_read on public.hr_requests for select to authenticated using (public.can_view_hr_request(tenant_id, employee_id));
create policy request_attachments_read on public.request_attachments for select to authenticated using (
  exists (select 1 from public.hr_requests r where r.id = request_id and public.can_view_hr_request(r.tenant_id, r.employee_id))
);
create policy request_approval_actions_read on public.request_approval_actions for select to authenticated using (
  exists (select 1 from public.hr_requests r where r.id = request_id and public.can_view_hr_request(r.tenant_id, r.employee_id))
);
create policy request_status_events_read on public.request_status_events for select to authenticated using (
  exists (select 1 from public.hr_requests r where r.id = request_id and public.can_view_hr_request(r.tenant_id, r.employee_id))
);
create policy notifications_read on public.notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy notifications_acknowledge on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

grant select on public.request_types, public.approval_workflows, public.approval_workflow_steps, public.hr_requests, public.request_attachments, public.request_approval_actions, public.request_status_events, public.notifications to authenticated;
grant insert, update, delete on public.request_types, public.approval_workflows, public.approval_workflow_steps to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.request_types, public.approval_workflows, public.approval_workflow_steps, public.hr_requests, public.request_attachments, public.request_approval_actions, public.request_status_events, public.notifications to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('request-documents', 'request-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy request_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'request-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.tenant_id::text = (storage.foldername(name))[1]
      and (public.has_permission(m.tenant_id, 'requests.manage') or public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2])
  )
);
create policy request_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'request-documents'
  and exists (
    select 1 from public.request_attachments a
    join public.hr_requests r on r.id = a.request_id
    where a.object_path = name and public.can_view_hr_request(r.tenant_id, r.employee_id)
  )
);
create policy request_documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'request-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.tenant_id::text = (storage.foldername(name))[1]
      and (public.has_permission(m.tenant_id, 'requests.manage') or public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2])
  )
);

grant execute on function public.can_view_hr_request(uuid, uuid) to authenticated;
grant execute on function public.submit_hr_request(uuid, uuid, text, text, date, date, time, time, integer, jsonb, boolean) to authenticated;
grant execute on function public.attach_request_document(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.can_approve_hr_request(uuid) to authenticated;
grant execute on function public.review_hr_request(uuid, public.request_decision, text) to authenticated;
grant execute on function public.cancel_hr_request(uuid, text) to authenticated;
grant execute on function public.clone_request_workflow(uuid, text, text) to authenticated;
grant execute on function public.activate_request_workflow(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

revoke execute on function public.seed_request_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.grant_request_permissions_for_role() from public, anon, authenticated;
revoke execute on function public.validate_request_workflow_links() from public, anon, authenticated;
revoke execute on function public.prevent_active_workflow_step_changes() from public, anon, authenticated;
revoke execute on function public.request_step_actor_users(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.next_request_step(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.queue_request_step_notifications(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_request_employee(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.can_view_hr_request(uuid, uuid) from public, anon;
revoke execute on function public.submit_hr_request(uuid, uuid, text, text, date, date, time, time, integer, jsonb, boolean) from public, anon;
revoke execute on function public.attach_request_document(uuid, text, text, text, bigint) from public, anon;
revoke execute on function public.can_approve_hr_request(uuid) from public, anon;
revoke execute on function public.review_hr_request(uuid, public.request_decision, text) from public, anon;
revoke execute on function public.cancel_hr_request(uuid, text) from public, anon;
revoke execute on function public.clone_request_workflow(uuid, text, text) from public, anon;
revoke execute on function public.activate_request_workflow(uuid) from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read(uuid) from public, anon;
