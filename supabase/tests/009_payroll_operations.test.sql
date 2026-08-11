begin;
select plan(54);

select has_table('public','payroll_settings','tenant payroll settings exist');
select has_table('public','employee_compensation','effective-dated employee compensation exists');
select has_table('public','payroll_periods','payroll periods exist');
select has_table('public','payroll_employee_results','employee payroll snapshots exist');
select has_table('public','payroll_components','itemized payroll components exist');
select has_table('public','payroll_status_events','payroll status history exists');
select has_table('public','payslips','published payslips exist');
select has_column('public','employee_compensation','salary_basis','compensation supports configurable salary basis');
select has_column('public','payroll_periods','settings_snapshot','payroll periods retain their policy snapshot');
select has_column('public','payroll_employee_results','calculation_snapshot','employee payroll retains its calculation snapshot');
select has_column('public','payroll_employee_results','late_minutes','payroll snapshots attendance lateness');
select has_column('public','payroll_employee_results','unpaid_leave_units','payroll snapshots unpaid leave');
select has_column('public','payslips','acknowledged_at','payslip acknowledgement is supported');

select has_function('public','upsert_employee_compensation',array['uuid','salary_basis','numeric','numeric','numeric','numeric','text','date','text'],'guarded compensation versioning exists');
select has_function('public','create_payroll_period',array['uuid','text','text','date','date','date'],'guarded payroll period creation exists');
select has_function('public','calculate_payroll_period',array['uuid'],'payroll calculation engine exists');
select has_function('public','add_payroll_adjustment',array['uuid','payroll_component_kind','text','text','text','numeric','text'],'reasoned adjustments exist');
select has_function('public','delete_payroll_adjustment',array['uuid'],'adjustments can be removed before lock');
select has_function('public','transition_payroll_period',array['uuid','payroll_period_status','text'],'controlled payroll transitions exist');
select has_function('public','acknowledge_payslip',array['uuid'],'employee payslip acknowledgement exists');

select ok((select relrowsecurity from pg_class where oid='public.payroll_settings'::regclass),'payroll settings use RLS');
select ok((select relrowsecurity from pg_class where oid='public.employee_compensation'::regclass),'compensation uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.payroll_periods'::regclass),'payroll periods use RLS');
select ok((select relrowsecurity from pg_class where oid='public.payroll_employee_results'::regclass),'payroll results use RLS');
select ok((select relrowsecurity from pg_class where oid='public.payroll_components'::regclass),'payroll components use RLS');
select ok((select relrowsecurity from pg_class where oid='public.payslips'::regclass),'payslips use RLS');
select is((select count(*)::integer from public.permissions where module='payroll'),6,'six payroll permissions are registered');

insert into public.tenants(id,slug,name_en,status) values
('15000000-0000-0000-0000-000000000001','payroll-test','Payroll Test','active'),
('15000000-0000-0000-0000-000000000002','payroll-other','Payroll Other','active');

select is((select count(*)::integer from public.payroll_settings where tenant_id in ('15000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000002')),2,'new tenants receive payroll settings');
select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='15000000-0000-0000-0000-000000000001' and r.name='owner' and rp.permission_key like 'payroll.%'),6,'owners receive every payroll capability');
select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='15000000-0000-0000-0000-000000000001' and r.name='payroll_officer' and rp.permission_key like 'payroll.%'),4,'payroll officers can configure, calculate, and adjust payroll');
select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='15000000-0000-0000-0000-000000000001' and r.name='accountant' and rp.permission_key like 'payroll.%'),2,'accountants can read and approve payroll');

insert into public.branches(id,tenant_id,code,name_en) values
('25000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','PAY','Payroll Branch'),
('25000000-0000-0000-0000-000000000002','15000000-0000-0000-0000-000000000002','OTH','Other Branch');
insert into public.employees(id,tenant_id,employee_code,name_en,branch_id,status) values
('35000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','PAY-001','Payroll Employee','25000000-0000-0000-0000-000000000001','active'),
('35000000-0000-0000-0000-000000000002','15000000-0000-0000-0000-000000000002','OTH-001','Other Employee','25000000-0000-0000-0000-000000000002','active'),
('35000000-0000-0000-0000-000000000003','15000000-0000-0000-0000-000000000001','PAY-002','Hourly Employee','25000000-0000-0000-0000-000000000001','active');

select lives_ok($$insert into public.employee_compensation(tenant_id,employee_id,salary_basis,base_salary,effective_from) values ('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','monthly',12000,'2026-08-01')$$,'same-tenant compensation is accepted');
select throws_ok($$insert into public.employee_compensation(tenant_id,employee_id,salary_basis,base_salary,effective_from) values ('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000002','monthly',12000,'2026-08-01')$$,'P0001','Cross-tenant payroll relationship rejected','cross-tenant compensation is rejected');
select throws_ok($$insert into public.employee_compensation(tenant_id,employee_id,salary_basis,base_salary,effective_from) values ('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','monthly',-1,'2026-09-01')$$,'23514',null,'negative compensation is rejected');
insert into public.employee_compensation(tenant_id,employee_id,salary_basis,base_salary,hourly_rate,effective_from) values ('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000003','hourly',0,50,'2026-08-01');

select ok(has_function_privilege('authenticated','public.calculate_payroll_period(uuid)','EXECUTE'),'authenticated payroll operators can call the guarded calculator');
select ok(not has_function_privilege('anon','public.calculate_payroll_period(uuid)','EXECUTE'),'anonymous callers cannot calculate payroll');
select ok(has_function_privilege('authenticated','public.transition_payroll_period(uuid,payroll_period_status,text)','EXECUTE'),'authenticated approvers can call guarded transitions');
select ok(not has_function_privilege('anon','public.transition_payroll_period(uuid,payroll_period_status,text)','EXECUTE'),'anonymous callers cannot transition payroll');
select ok(not has_function_privilege('authenticated','public.recalculate_payroll_result_totals(uuid)','EXECUTE'),'employees cannot bypass controlled payroll totals');
select ok(not has_function_privilege('authenticated','public.seed_payroll_defaults(uuid)','EXECUTE'),'tenant payroll seeding remains internal');
select ok(has_function_privilege('authenticated','public.can_view_payroll_employee(uuid,uuid)','EXECUTE'),'authenticated RLS callers can resolve scoped payroll visibility');
select ok(not has_function_privilege('authenticated','public.calculate_payroll_period_legacy(uuid)','EXECUTE'),'the uncorrected payroll calculator is internal only');

select is((select count(*)::integer from pg_policies where schemaname='public' and tablename='payroll_periods'),2,'payroll periods have read and manage policies');
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename='employee_compensation'),2,'compensation has self-read and manage policies');
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename='payslips'),1,'payslip visibility has one guarded policy');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('45000000-0000-0000-0000-000000000001','authenticated','authenticated','payroll-owner@example.test','x',now(),'{}','{"full_name":"Payroll Owner"}');
update public.tenants set created_by='45000000-0000-0000-0000-000000000001' where id='15000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','45000000-0000-0000-0000-000000000001',true);
insert into public.memberships(id,tenant_id,user_id,status,is_owner,joined_at)
values ('55000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','45000000-0000-0000-0000-000000000001','active',true,now());
insert into public.membership_roles(membership_id,role_id)
select '55000000-0000-0000-0000-000000000001',id from public.roles where tenant_id='15000000-0000-0000-0000-000000000001' and name='owner';
insert into public.attendance_days(tenant_id,employee_id,branch_id,work_date,scheduled_minutes,actual_minutes,status)
values ('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001','2026-08-03',480,480,'present'),
('15000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000003','25000000-0000-0000-0000-000000000001','2026-08-03',480,0,'incomplete');
insert into public.payroll_periods(id,tenant_id,code,name,period_start,period_end,currency_code)
values ('65000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','2026-08','August 2026','2026-08-01','2026-08-31','EGP');

select set_config('request.jwt.claim.sub','45000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.calculate_payroll_period('65000000-0000-0000-0000-000000000001')$$,'authorized owner can calculate payroll');
select is((select count(*)::integer from public.payroll_employee_results where period_id='65000000-0000-0000-0000-000000000001'),2,'calculation creates every configured employee result');
select is((select net_amount from public.payroll_employee_results where period_id='65000000-0000-0000-0000-000000000001' and employee_id='35000000-0000-0000-0000-000000000001'),12000.00::numeric,'monthly base pay calculates from the effective compensation snapshot');
select is((select net_amount from public.payroll_employee_results where period_id='65000000-0000-0000-0000-000000000001' and employee_id='35000000-0000-0000-0000-000000000003'),0.00::numeric,'hourly pay does not double-deduct unworked minutes');
select lives_ok($$select public.add_payroll_adjustment((select id from public.payroll_employee_results where period_id='65000000-0000-0000-0000-000000000001' and employee_id='35000000-0000-0000-0000-000000000001'),'earning','release_bonus','Release bonus','مكافأة إصدار',1000,'Approved test bonus')$$,'reasoned manual earning can be added during review');
select is((select net_amount from public.payroll_employee_results where period_id='65000000-0000-0000-0000-000000000001' and employee_id='35000000-0000-0000-0000-000000000001'),13000.00::numeric,'manual earning immediately updates net pay');
select lives_ok($$select public.transition_payroll_period('65000000-0000-0000-0000-000000000001','reviewed','Ready'); select public.transition_payroll_period('65000000-0000-0000-0000-000000000001','approved','Checked'); select public.transition_payroll_period('65000000-0000-0000-0000-000000000001','locked','Locked'); select public.transition_payroll_period('65000000-0000-0000-0000-000000000001','published','Published')$$,'authorized workflow advances through review, approval, lock, and publication');
select is((select status::text from public.payroll_periods where id='65000000-0000-0000-0000-000000000001'),'published','payroll reaches published status only through controlled transitions');
select is((select count(*)::integer from public.payslips where period_id='65000000-0000-0000-0000-000000000001'),2,'publication creates every employee payslip');

select * from finish();
rollback;
