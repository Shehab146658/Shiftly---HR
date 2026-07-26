begin;
select plan(10);

select has_table('public', 'tenants', 'tenants table exists');
select has_table('public', 'memberships', 'memberships table exists');
select has_table('public', 'roles', 'roles table exists');
select has_table('public', 'branches', 'branches table exists');
select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'employees', 'employees table exists');
select has_table('public', 'audit_logs', 'audit table exists');
select ok(row_security_active('public.tenants'::regclass), 'RLS is active on tenants');
select ok(row_security_active('public.employees'::regclass), 'RLS is active on employees');
select has_function('public', 'create_tenant_with_owner', array['text','text','text','text'], 'tenant bootstrap RPC exists');

select * from finish();
rollback;
