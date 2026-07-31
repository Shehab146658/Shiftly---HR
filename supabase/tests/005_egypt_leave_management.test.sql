begin;
select plan(20);

select has_table('public', 'leave_types', 'leave types exist');
select has_table('public', 'public_holidays', 'public holidays exist');
select has_table('public', 'leave_requests', 'leave requests exist');
select has_table('public', 'leave_request_days', 'approved leave days exist');
select has_table('public', 'leave_approval_actions', 'approval actions exist');
select has_table('public', 'leave_balance_transactions', 'leave balance ledger exists');
select has_column('public', 'leave_requests', 'approval_stage', 'leave requests track their workflow stage');
select has_column('public', 'employees', 'prior_service_years', 'employees store prior service for entitlement');
select has_column('public', 'branches', 'weekly_rest_isodows', 'branches store weekly rest days');
select has_function('public', 'annual_leave_entitlement', array['uuid', 'date'], 'annual entitlement calculator exists');
select has_function('public', 'calculate_leave_units', array['uuid', 'date', 'date', 'leave_day_part', 'integer', 'boolean'], 'chargeable leave-day calculator exists');
select has_function('public', 'submit_leave_request', array['uuid', 'uuid', 'date', 'date', 'leave_day_part', 'integer', 'text', 'boolean', 'date', 'date'], 'leave submission RPC exists');
select has_function('public', 'review_leave_request', array['uuid', 'text', 'text'], 'staged leave review RPC exists');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.leave_requests'::regclass), 'RLS is enabled on leave requests');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.leave_approval_actions'::regclass), 'RLS is enabled on approval history');

insert into public.tenants(id, slug, name_en, status)
values ('12000000-0000-0000-0000-000000000001', 'leave-test', 'Leave Test', 'active');

select is(
  (select count(*)::integer from public.leave_types where tenant_id = '12000000-0000-0000-0000-000000000001'),
  13,
  'new tenants receive the statutory and configurable leave catalogue'
);
select is(
  (select count(*)::integer from public.public_holidays where tenant_id = '12000000-0000-0000-0000-000000000001' and extract(year from holiday_date) = 2026),
  21,
  'new tenants receive all published 2026 Egyptian holiday dates'
);
select is(
  (select name_en from public.public_holidays where tenant_id = '12000000-0000-0000-0000-000000000001' and holiday_date = date '2026-01-07'),
  'Coptic Christmas Day',
  'the official holiday calendar includes Coptic Christmas'
);
select ok(has_function_privilege('authenticated', 'public.review_leave_request(uuid,text,text)', 'EXECUTE'), 'authenticated reviewers can call the guarded workflow RPC');
select ok(not has_function_privilege('anon', 'public.review_leave_request(uuid,text,text)', 'EXECUTE'), 'anonymous users cannot review leave requests');

select * from finish();
rollback;
