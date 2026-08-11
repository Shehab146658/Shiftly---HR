begin;
select plan(29);

select has_table('public', 'request_types', 'request catalogue exists');
select has_table('public', 'approval_workflows', 'versioned approval workflows exist');
select has_table('public', 'approval_workflow_steps', 'workflow steps exist');
select has_table('public', 'hr_requests', 'employee requests exist');
select has_table('public', 'request_attachments', 'request attachments exist');
select has_table('public', 'request_approval_actions', 'approval actions exist');
select has_table('public', 'request_status_events', 'request status history exists');
select has_table('public', 'notifications', 'in-app notifications exist');
select has_column('public', 'hr_requests', 'current_step_id', 'requests track the current workflow step');
select has_column('public', 'approval_workflows', 'version', 'workflows are versioned');
select has_column('public', 'approval_workflow_steps', 'approval_mode', 'steps support flexible approval modes');
select has_function('public', 'submit_hr_request', array['uuid', 'uuid', 'text', 'text', 'date', 'date', 'time without time zone', 'time without time zone', 'integer', 'jsonb', 'boolean'], 'request submission RPC exists');
select has_function('public', 'review_hr_request', array['uuid', 'request_decision', 'text'], 'guarded approval RPC exists');
select has_function('public', 'clone_request_workflow', array['uuid', 'text', 'text'], 'workflow version clone RPC exists');
select has_function('public', 'activate_request_workflow', array['uuid'], 'workflow activation RPC exists');
select has_function('public', 'mark_notification_read', array['uuid'], 'notification acknowledgement RPC exists');

select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.hr_requests'::regclass), 'RLS is enabled on employee requests');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.notifications'::regclass), 'RLS is enabled on notifications');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.approval_workflows'::regclass), 'RLS is enabled on workflows');
select ok(not exists (
  select 1 from pg_catalog.pg_constraint c
  where c.conrelid = 'public.hr_requests'::regclass and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid) ilike '%start_time%null%end_time%null%'
), 'single-time permissions can store an arrival-only or departure-only value');

insert into public.tenants(id, slug, name_en, status)
values ('13000000-0000-0000-0000-000000000001', 'request-test', 'Request Test', 'active');

select is(
  (select count(*)::integer from public.request_types where tenant_id = '13000000-0000-0000-0000-000000000001'),
  8,
  'new companies receive a practical default request catalogue'
);
select is(
  (select count(*)::integer from public.approval_workflows where tenant_id = '13000000-0000-0000-0000-000000000001' and is_active and request_type_id is not null),
  8,
  'every default request type receives an active workflow'
);
select is(
  (select count(*)::integer from public.approval_workflow_steps s where s.tenant_id = '13000000-0000-0000-0000-000000000001' and exists (select 1 from public.approval_workflows w where w.id = s.workflow_id and w.request_type_id is not null)),
  16,
  'default workflows route through manager and owner steps'
);
select is(
  (select approver_kind::text from public.approval_workflow_steps s join public.approval_workflows w on w.id = s.workflow_id join public.request_types t on t.id = w.request_type_id where t.tenant_id = '13000000-0000-0000-0000-000000000001' and t.code = 'overtime' and s.step_order = 1),
  'manager',
  'overtime starts with the line manager'
);
select is(
  (select approver_kind::text from public.approval_workflow_steps s join public.approval_workflows w on w.id = s.workflow_id join public.request_types t on t.id = w.request_type_id where t.tenant_id = '13000000-0000-0000-0000-000000000001' and t.code = 'overtime' and s.step_order = 2),
  'owner',
  'overtime finishes with an owner by default'
);

select ok(has_function_privilege('authenticated', 'public.submit_hr_request(uuid,uuid,text,text,date,date,time without time zone,time without time zone,integer,jsonb,boolean)', 'EXECUTE'), 'authenticated users can call the guarded submission RPC');
select ok(not has_function_privilege('anon', 'public.submit_hr_request(uuid,uuid,text,text,date,date,time without time zone,time without time zone,integer,jsonb,boolean)', 'EXECUTE'), 'anonymous users cannot submit requests');
select ok(has_function_privilege('authenticated', 'public.review_hr_request(uuid,request_decision,text)', 'EXECUTE'), 'authenticated reviewers can call the guarded approval RPC');
select ok(not has_function_privilege('anon', 'public.review_hr_request(uuid,request_decision,text)', 'EXECUTE'), 'anonymous users cannot approve requests');

select * from finish();
rollback;
