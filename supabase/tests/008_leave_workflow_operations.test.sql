begin;
select plan(18);

select has_column('public', 'approval_workflows', 'leave_type_id', 'shared workflows can target a leave type');
select has_column('public', 'leave_requests', 'workflow_id', 'leave requests retain their workflow version');
select has_column('public', 'leave_requests', 'current_workflow_step_id', 'leave requests track the current generic approval step');
select has_column('public', 'leave_approval_actions', 'workflow_step_id', 'leave decisions reference their generic workflow step');
select has_function('public', 'can_approve_leave_request', array['uuid'], 'guarded leave approval check exists');
select has_function('public', 'finalize_leave_request', array['uuid', 'text'], 'idempotent leave finalizer exists');
select has_function('public', 'seed_leave_approval_workflows', array['uuid'], 'leave workflow seeding exists');

insert into public.tenants(id, slug, name_en, status)
values ('14000000-0000-0000-0000-000000000001', 'leave-workflow-test', 'Leave Workflow Test', 'active');

select is(
  (select count(*)::integer from public.approval_workflows where tenant_id = '14000000-0000-0000-0000-000000000001' and leave_type_id is not null and is_active),
  13,
  'every statutory and company leave type receives an active workflow'
);
select is(
  (select count(*)::integer from public.approval_workflow_steps s where s.tenant_id = '14000000-0000-0000-0000-000000000001' and exists (select 1 from public.approval_workflows w where w.id = s.workflow_id and w.leave_type_id is not null)),
  26,
  'default leave workflows contain manager and owner steps'
);
select is(
  (select s.approver_kind::text from public.approval_workflow_steps s join public.approval_workflows w on w.id = s.workflow_id join public.leave_types lt on lt.id = w.leave_type_id where lt.tenant_id = '14000000-0000-0000-0000-000000000001' and lt.code = 'annual' and s.step_order = 1),
  'manager',
  'annual leave starts with the line manager'
);
select is(
  (select s.approver_kind::text from public.approval_workflow_steps s join public.approval_workflows w on w.id = s.workflow_id join public.leave_types lt on lt.id = w.leave_type_id where lt.tenant_id = '14000000-0000-0000-0000-000000000001' and lt.code = 'annual' and s.step_order = 2),
  'owner',
  'annual leave ends with an owner by default'
);
select ok(not exists (
  select 1 from public.approval_workflows w where w.tenant_id = '14000000-0000-0000-0000-000000000001' and num_nonnulls(w.request_type_id, w.leave_type_id) <> 1
), 'every workflow has exactly one operational subject');
select ok(has_function_privilege('authenticated', 'public.submit_leave_request(uuid,uuid,date,date,leave_day_part,integer,text,boolean,date,date)', 'EXECUTE'), 'employees can call the guarded versioned leave submission');
select ok(has_function_privilege('authenticated', 'public.review_leave_request(uuid,text,text)', 'EXECUTE'), 'resolved approvers can call the guarded leave review');
select ok(has_function_privilege('authenticated', 'public.can_approve_leave_request(uuid)', 'EXECUTE'), 'the UI can resolve leave review responsibility');
select ok(not has_function_privilege('anon', 'public.can_approve_leave_request(uuid)', 'EXECUTE'), 'anonymous users cannot inspect leave assignments');
select ok(not has_function_privilege('authenticated', 'public.finalize_leave_request(uuid,text)', 'EXECUTE'), 'employees cannot bypass the workflow finalizer');
select ok(not has_function_privilege('authenticated', 'public.submit_leave_request_legacy(uuid,uuid,date,date,leave_day_part,integer,text,boolean,date,date)', 'EXECUTE'), 'the fixed legacy leave workflow is not callable');

select * from finish();
rollback;
