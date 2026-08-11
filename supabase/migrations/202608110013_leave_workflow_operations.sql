-- Bring statutory leave onto the shared versioned approval engine.

alter table public.approval_workflows
  alter column request_type_id drop not null,
  add column leave_type_id uuid references public.leave_types(id) on delete cascade,
  add constraint approval_workflows_one_subject check (num_nonnulls(request_type_id, leave_type_id) = 1),
  add constraint approval_workflows_leave_type_version_unique unique (leave_type_id, version);

create unique index approval_workflows_one_active_leave_idx
  on public.approval_workflows(leave_type_id) where is_active and leave_type_id is not null;

drop policy if exists approval_workflows_manage on public.approval_workflows;
create policy approval_workflows_manage on public.approval_workflows for all to authenticated
using (
  (request_type_id is not null and public.has_permission(tenant_id, 'requests.manage'))
  or (leave_type_id is not null and public.has_permission(tenant_id, 'leave.manage'))
)
with check (
  (request_type_id is not null and public.has_permission(tenant_id, 'requests.manage'))
  or (leave_type_id is not null and public.has_permission(tenant_id, 'leave.manage'))
);

drop policy if exists approval_workflow_steps_manage on public.approval_workflow_steps;
create policy approval_workflow_steps_manage on public.approval_workflow_steps for all to authenticated
using (exists (
  select 1 from public.approval_workflows w
  where w.id = workflow_id
    and (
      (w.request_type_id is not null and public.has_permission(w.tenant_id, 'requests.manage'))
      or (w.leave_type_id is not null and public.has_permission(w.tenant_id, 'leave.manage'))
    )
))
with check (exists (
  select 1 from public.approval_workflows w
  where w.id = workflow_id
    and (
      (w.request_type_id is not null and public.has_permission(w.tenant_id, 'requests.manage'))
      or (w.leave_type_id is not null and public.has_permission(w.tenant_id, 'leave.manage'))
    )
));

alter table public.leave_requests
  add column workflow_id uuid references public.approval_workflows(id) on delete restrict,
  add column current_workflow_step_id uuid references public.approval_workflow_steps(id) on delete restrict;

create index leave_requests_current_workflow_step_idx
  on public.leave_requests(current_workflow_step_id) where current_workflow_step_id is not null;

alter table public.leave_approval_actions
  add column workflow_step_id uuid references public.approval_workflow_steps(id) on delete restrict;

alter table public.leave_approval_actions
  drop constraint leave_approval_actions_request_id_stage_key;

create unique index leave_approval_actions_actor_step_unique
  on public.leave_approval_actions(request_id, workflow_step_id, actor_user_id)
  where workflow_step_id is not null;

create or replace function public.validate_request_workflow_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject_tenant uuid;
  v_workflow_tenant uuid;
  v_role_tenant uuid;
begin
  if tg_table_name = 'approval_workflows' then
    if new.request_type_id is not null then
      select tenant_id into v_subject_tenant from public.request_types where id = new.request_type_id;
    elsif new.leave_type_id is not null then
      select tenant_id into v_subject_tenant from public.leave_types where id = new.leave_type_id;
    end if;
    if v_subject_tenant is distinct from new.tenant_id then raise exception 'Workflow and subject must belong to the same company'; end if;
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

create or replace function public.seed_leave_approval_workflows(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type record;
  v_workflow_id uuid;
begin
  for v_type in select id, name_en, name_ar from public.leave_types where tenant_id = p_tenant_id loop
    if not exists (select 1 from public.approval_workflows where leave_type_id = v_type.id) then
      insert into public.approval_workflows(tenant_id, leave_type_id, name_en, name_ar, version, is_active, activated_at)
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

select public.seed_leave_approval_workflows(id) from public.tenants;

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
  perform public.seed_leave_approval_workflows(new.id);
  return new;
end;
$$;

create or replace function public.validate_leave_workflow_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.approval_workflows%rowtype;
begin
  if new.workflow_id is null then
    if new.current_workflow_step_id is not null then raise exception 'A current leave step requires a workflow'; end if;
    return new;
  end if;
  select * into v_workflow from public.approval_workflows where id = new.workflow_id;
  if v_workflow.id is null
     or v_workflow.tenant_id <> new.tenant_id
     or v_workflow.leave_type_id is distinct from new.leave_type_id
  then raise exception 'Leave request and workflow must use the same company and leave type'; end if;
  if new.current_workflow_step_id is not null and not exists (
    select 1 from public.approval_workflow_steps s where s.id = new.current_workflow_step_id and s.workflow_id = new.workflow_id
  ) then raise exception 'Current leave approval step must belong to its workflow'; end if;
  return new;
end;
$$;

create trigger validate_leave_request_workflow
before insert or update of workflow_id, current_workflow_step_id, leave_type_id, tenant_id on public.leave_requests
for each row execute function public.validate_leave_workflow_assignment();

create or replace function public.leave_step_actor_users(p_step_id uuid, p_request_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select s.approver_kind, s.role_id, r.tenant_id, r.employee_id
    from public.approval_workflow_steps s
    join public.leave_requests r on r.id = p_request_id and r.workflow_id = s.workflow_id
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

create or replace function public.next_leave_workflow_step(p_workflow_id uuid, p_request_id uuid, p_after_order integer default 0)
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
    and exists (select 1 from public.leave_step_actor_users(s.id, p_request_id))
  order by s.step_order
  limit 1;
$$;

create or replace function public.queue_leave_step_notifications(p_request_id uuid, p_step_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_type public.leave_types%rowtype;
  v_employee public.employees%rowtype;
begin
  select * into v_request from public.leave_requests where id = p_request_id;
  select * into v_type from public.leave_types where id = v_request.leave_type_id;
  select * into v_employee from public.employees where id = v_request.employee_id;
  insert into public.notifications(
    tenant_id, recipient_user_id, kind, title_en, title_ar, body_en, body_ar, href, entity_type, entity_id
  )
  select v_request.tenant_id, actors.user_id, 'leave.approval', 'Leave awaiting your approval', 'إجازة تنتظر اعتمادك',
    coalesce(v_employee.name_en, v_employee.employee_code) || ' requested ' || v_type.name_en,
    coalesce(v_employee.name_ar, v_employee.name_en, v_employee.employee_code) || ' طلب ' || v_type.name_ar,
    '/en/leaves?request=' || v_request.id::text, 'leave_requests', v_request.id::text
  from public.leave_step_actor_users(p_step_id, p_request_id) actors
  where actors.user_id is distinct from auth.uid();
end;
$$;

create or replace function public.notify_leave_employee(p_request_id uuid, p_kind text, p_title_en text, p_title_ar text, p_body_en text, p_body_ar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_user_id uuid;
begin
  select * into v_request from public.leave_requests where id = p_request_id;
  select user_id into v_user_id from public.employees where id = v_request.employee_id;
  if v_user_id is not null and v_user_id is distinct from auth.uid() then
    insert into public.notifications(tenant_id, recipient_user_id, kind, title_en, title_ar, body_en, body_ar, href, entity_type, entity_id)
    values (v_request.tenant_id, v_user_id, p_kind, p_title_en, p_title_ar, p_body_en, p_body_ar, '/en/leaves?request=' || p_request_id::text, 'leave_requests', p_request_id::text);
  end if;
end;
$$;

update public.leave_requests r
set workflow_id = (
  select w.id
  from public.approval_workflows w
  where w.leave_type_id = r.leave_type_id and w.is_active
  order by w.version desc limit 1
)
where r.workflow_id is null;

update public.leave_requests r
set current_workflow_step_id = (
  select s.id
  from public.approval_workflow_steps s
  where s.workflow_id = r.workflow_id
    and (
      (r.approval_stage = 'manager_review' and s.approver_kind = 'manager')
      or (r.approval_stage = 'owner_review' and s.approver_kind = 'owner')
  )
  order by s.step_order limit 1
)
where r.status = 'pending' and r.current_workflow_step_id is null;

alter function public.submit_leave_request(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date)
  rename to submit_leave_request_legacy;
alter function public.review_leave_request(uuid, text, text)
  rename to review_leave_request_legacy;

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
  v_workflow public.approval_workflows%rowtype;
  v_request_id uuid;
  v_first_step uuid;
  v_kind public.request_approver_kind;
begin
  select * into v_workflow
  from public.approval_workflows
  where leave_type_id = p_leave_type_id and is_active
  order by version desc limit 1;
  if v_workflow.id is null then raise exception 'No active approval workflow is configured for this leave type'; end if;

  v_request_id := public.submit_leave_request_legacy(
    p_employee_id, p_leave_type_id, p_start_date, p_end_date, p_day_part,
    p_requested_minutes, p_reason, p_has_document, p_expected_delivery_date, p_actual_delivery_date
  );
  update public.leave_requests set workflow_id = v_workflow.id where id = v_request_id;
  v_first_step := public.next_leave_workflow_step(v_workflow.id, v_request_id, 0);
  if v_first_step is null then raise exception 'The leave workflow has no available approver'; end if;
  select approver_kind into v_kind from public.approval_workflow_steps where id = v_first_step;
  update public.leave_requests set
    current_workflow_step_id = v_first_step,
    approval_stage = case when v_kind = 'manager' then 'manager_review'::public.leave_approval_stage else 'owner_review'::public.leave_approval_stage end
  where id = v_request_id;
  perform public.queue_leave_step_notifications(v_request_id, v_first_step);
  return v_request_id;
end;
$$;

create or replace function public.can_approve_leave_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leave_requests r
    join public.leave_step_actor_users(r.current_workflow_step_id, r.id) actors on actors.user_id = auth.uid()
    where r.id = p_request_id and r.status = 'pending'
  ) or public.is_platform_admin();
$$;

create or replace function public.finalize_leave_request(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_requests%rowtype;
  v_type public.leave_types%rowtype;
  v_prior_industrial numeric := 0;
begin
  select * into v_request from public.leave_requests where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'pending' then raise exception 'Only a pending leave request can be finalized'; end if;
  select * into v_type from public.leave_types where id = v_request.leave_type_id;

  update public.leave_requests
  set status = 'approved', approval_stage = 'completed', current_workflow_step_id = null,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
  where id = p_request_id;

  if v_type.code = 'industrial_sick' then
    select coalesce(sum(d.units), 0) into v_prior_industrial
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.request_id
    join public.leave_types lt on lt.id = r.leave_type_id
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

  if v_type.balance_code is not null and not exists (
    select 1 from public.leave_balance_transactions where request_id = v_request.id and kind = 'leave_usage'
  ) then
    insert into public.leave_balance_transactions(tenant_id, employee_id, balance_code, leave_year, kind, units, request_id, reason, created_by)
    values (v_request.tenant_id, v_request.employee_id, v_type.balance_code, extract(year from v_request.start_date)::integer, 'leave_usage', -v_request.requested_units, v_request.id, 'Approved ' || v_type.code || ' leave', auth.uid());
  end if;
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
  v_step public.approval_workflow_steps%rowtype;
  v_required integer;
  v_approved integer;
  v_next_step uuid;
  v_next_kind public.request_approver_kind;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_request from public.leave_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Leave request not found'; end if;
  if v_request.workflow_id is null then
    perform public.review_leave_request_legacy(p_request_id, p_decision, p_note);
    return;
  end if;
  if v_request.status <> 'pending' or v_request.current_workflow_step_id is null then raise exception 'This leave request is not awaiting approval'; end if;
  if not public.can_approve_leave_request(v_request.id) then raise exception 'This leave approval is not assigned to you'; end if;
  if p_decision = 'rejected' and coalesce(length(trim(p_note)), 0) = 0 then raise exception 'A rejection reason is required'; end if;
  select * into v_step from public.approval_workflow_steps where id = v_request.current_workflow_step_id;

  insert into public.leave_approval_actions(tenant_id, request_id, stage, workflow_step_id, decision, actor_user_id, note)
  values (
    v_request.tenant_id, v_request.id,
    case when v_step.approver_kind = 'manager' then 'manager_review'::public.leave_approval_stage else 'owner_review'::public.leave_approval_stage end,
    v_step.id, p_decision::public.leave_approval_decision, auth.uid(), nullif(trim(p_note), '')
  );

  if p_decision = 'rejected' then
    update public.leave_requests
    set status = 'rejected', approval_stage = 'completed', current_workflow_step_id = null,
        reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
    where id = v_request.id;
    perform public.notify_leave_employee(v_request.id, 'leave.rejected', 'Leave request rejected', 'تم رفض طلب الإجازة', coalesce(trim(p_note), 'Your leave request was rejected.'), coalesce(trim(p_note), 'تم رفض طلب الإجازة.'));
    return;
  end if;

  v_required := case
    when v_step.approval_mode = 'any' then 1
    when v_step.approval_mode = 'count' then v_step.approvals_required
    else greatest(1, (select count(*) from public.leave_step_actor_users(v_step.id, v_request.id)))
  end;
  select count(*) into v_approved from public.leave_approval_actions
  where request_id = v_request.id and workflow_step_id = v_step.id and decision = 'approved';
  if v_approved < v_required then return; end if;

  v_next_step := public.next_leave_workflow_step(v_request.workflow_id, v_request.id, v_step.step_order);
  if v_next_step is null then
    perform public.finalize_leave_request(v_request.id, p_note);
    perform public.notify_leave_employee(v_request.id, 'leave.approved', 'Leave request approved', 'تم اعتماد طلب الإجازة', 'Your leave request completed its approval workflow.', 'اكتمل مسار اعتماد طلب الإجازة.');
  else
    select approver_kind into v_next_kind from public.approval_workflow_steps where id = v_next_step;
    update public.leave_requests set
      current_workflow_step_id = v_next_step,
      approval_stage = case when v_next_kind = 'manager' then 'manager_review'::public.leave_approval_stage else 'owner_review'::public.leave_approval_stage end,
      review_note = nullif(trim(p_note), '')
    where id = v_request.id;
    perform public.queue_leave_step_notifications(v_request.id, v_next_step);
  end if;
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
  if not public.has_permission(v_workflow.tenant_id, 'requests.manage') and not public.has_permission(v_workflow.tenant_id, 'leave.manage') then raise exception 'Not authorized to manage workflows'; end if;
  if v_workflow.request_type_id is not null then
    select coalesce(max(version), 0) + 1 into v_version from public.approval_workflows where request_type_id = v_workflow.request_type_id;
  else
    select coalesce(max(version), 0) + 1 into v_version from public.approval_workflows where leave_type_id = v_workflow.leave_type_id;
  end if;
  insert into public.approval_workflows(tenant_id, request_type_id, leave_type_id, name_en, name_ar, version, is_active, created_by)
  values (v_workflow.tenant_id, v_workflow.request_type_id, v_workflow.leave_type_id, coalesce(nullif(trim(p_name_en), ''), v_workflow.name_en), coalesce(nullif(trim(p_name_ar), ''), v_workflow.name_ar), v_version, false, auth.uid())
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
  if not public.has_permission(v_workflow.tenant_id, 'requests.manage') and not public.has_permission(v_workflow.tenant_id, 'leave.manage') then raise exception 'Not authorized to manage workflows'; end if;
  if not exists (select 1 from public.approval_workflow_steps where workflow_id = v_workflow.id) then raise exception 'A workflow needs at least one approval step'; end if;
  if v_workflow.request_type_id is not null then
    update public.approval_workflows set is_active = false where request_type_id = v_workflow.request_type_id and is_active;
  else
    update public.approval_workflows set is_active = false where leave_type_id = v_workflow.leave_type_id and is_active;
  end if;
  update public.approval_workflows set is_active = true, activated_at = now() where id = v_workflow.id;
end;
$$;

grant execute on function public.submit_leave_request(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date) to authenticated;
grant execute on function public.review_leave_request(uuid, text, text) to authenticated;
grant execute on function public.can_approve_leave_request(uuid) to authenticated;

revoke execute on function public.submit_leave_request(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date) from public, anon;
revoke execute on function public.review_leave_request(uuid, text, text) from public, anon;
revoke execute on function public.can_approve_leave_request(uuid) from public, anon;

revoke execute on function public.submit_leave_request_legacy(uuid, uuid, date, date, public.leave_day_part, integer, text, boolean, date, date) from public, anon, authenticated;
revoke execute on function public.review_leave_request_legacy(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.seed_leave_approval_workflows(uuid) from public, anon, authenticated;
revoke execute on function public.validate_leave_workflow_assignment() from public, anon, authenticated;
revoke execute on function public.leave_step_actor_users(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.next_leave_workflow_step(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.queue_leave_step_notifications(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_leave_employee(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.finalize_leave_request(uuid, text) from public, anon, authenticated;
revoke execute on function public.can_approve_leave_request(uuid) from public, anon;
