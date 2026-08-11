begin;
select plan(82);

select has_table('public','loan_requests','employee loan requests exist');
select has_table('public','employee_loans','approved employee loans exist');
select has_table('public','loan_installments','loan installment schedules exist');
select has_table('public','loan_payments','loan payment ledger exists');
select has_table('public','sales_entries','daily sales entries exist');
select has_table('public','bonus_policies','configurable bonus policies exist');
select has_table('public','sales_targets','branch team and employee targets exist');
select has_table('public','bonus_results','employee bonus results exist');

select has_column('public','employee_loans','remaining_balance','loans retain an auditable outstanding balance');
select has_column('public','loan_installments','original_due_date','rescheduling preserves the original due date');
select has_column('public','loan_payments','payroll_component_id','payroll deductions are idempotently linked');
select has_column('public','bonus_policies','tiers','bonus policies store configurable tiers');
select has_column('public','sales_targets','scope_type','targets support multiple business scopes');
select has_column('public','bonus_results','calculation_snapshot','bonus calculations retain their rule snapshot');

select has_function('public','submit_loan_request',array['uuid','numeric','integer','date','text'],'guarded loan requests exist');
select has_function('public','review_loan_request',array['uuid','boolean','numeric','integer','date','text'],'loan review and conversion exists');
select has_function('public','record_loan_payment',array['uuid','numeric','date','loan_payment_method','text','text'],'manual and settlement payments exist');
select has_function('public','reschedule_loan_installment',array['uuid','date','text'],'reasoned installment rescheduling exists');
select has_function('public','record_sales_entry',array['uuid','date','uuid','uuid','numeric','text','text','text'],'daily sales submission exists');
select has_function('public','review_sales_entry',array['uuid','boolean','text'],'sales review exists');
select has_function('public','create_bonus_policy',array['uuid','text','text','text','bonus_basis','jsonb','date','date'],'tiered bonus policies exist');
select has_function('public','create_sales_target',array['uuid','text','text','date','date','performance_scope','uuid','numeric','text','uuid'],'scoped targets exist');
select has_function('public','calculate_bonus_target',array['uuid'],'bonus calculation exists');
select has_function('public','review_bonus_target',array['uuid','boolean','text'],'bonus approval exists');

select ok((select relrowsecurity from pg_class where oid='public.loan_requests'::regclass),'loan requests use RLS');
select ok((select relrowsecurity from pg_class where oid='public.employee_loans'::regclass),'employee loans use RLS');
select ok((select relrowsecurity from pg_class where oid='public.loan_installments'::regclass),'installments use RLS');
select ok((select relrowsecurity from pg_class where oid='public.loan_payments'::regclass),'loan payments use RLS');
select ok((select relrowsecurity from pg_class where oid='public.sales_entries'::regclass),'sales entries use RLS');
select ok((select relrowsecurity from pg_class where oid='public.bonus_policies'::regclass),'bonus policies use RLS');
select ok((select relrowsecurity from pg_class where oid='public.sales_targets'::regclass),'sales targets use RLS');
select ok((select relrowsecurity from pg_class where oid='public.bonus_results'::regclass),'bonus results use RLS');

select is((select count(*)::integer from public.permissions where module='loans'),5,'five loan permissions are registered');
select is((select count(*)::integer from public.permissions where module='performance'),5,'five performance permissions are registered');
select ok(has_function_privilege('authenticated','public.submit_loan_request(uuid,numeric,integer,date,text)','EXECUTE'),'authenticated employees can call guarded loan requests');
select ok(not has_function_privilege('anon','public.submit_loan_request(uuid,numeric,integer,date,text)','EXECUTE'),'anonymous loan requests are blocked');
select ok(not has_function_privilege('authenticated','public.calculate_payroll_period_without_financial_services(uuid)','EXECUTE'),'the incomplete payroll wrapper remains internal');
select ok(not has_function_privilege('authenticated','public.transition_payroll_period_without_financial_services(uuid,payroll_period_status,text)','EXECUTE'),'the incomplete publication wrapper remains internal');

insert into public.tenants(id,slug,name_en,status) values
('16000000-0000-0000-0000-000000000001','business-test','Business Test','active'),
('16000000-0000-0000-0000-000000000002','business-other','Business Other','active');
insert into public.branches(id,tenant_id,code,name_en) values
('26000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','MAIN','Main Branch'),
('26000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000002','OTHER','Other Branch');
insert into public.teams(id,tenant_id,branch_id,code,name_en) values
('27000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','26000000-0000-0000-0000-000000000001','SALES','Sales Team');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('46000000-0000-0000-0000-000000000001','authenticated','authenticated','business-owner@example.test','x',now(),'{}','{"full_name":"Business Owner"}'),
('46000000-0000-0000-0000-000000000002','authenticated','authenticated','business-employee@example.test','x',now(),'{}','{"full_name":"Business Employee"}');
update public.tenants set created_by='46000000-0000-0000-0000-000000000001' where id='16000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','46000000-0000-0000-0000-000000000001',true);
insert into public.employees(id,tenant_id,user_id,employee_code,name_en,branch_id,team_id,status) values
('36000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000002','EMP-001','Sales Employee','26000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','active'),
('36000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000002',null,'OTH-001','Other Employee','26000000-0000-0000-0000-000000000002',null,'active');
insert into public.memberships(id,tenant_id,user_id,status,is_owner,joined_at) values
('56000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000001','active',true,now()),
('56000000-0000-0000-0000-000000000002','16000000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000002','active',false,now());
insert into public.membership_roles(membership_id,role_id)
select '56000000-0000-0000-0000-000000000001',id from public.roles where tenant_id='16000000-0000-0000-0000-000000000001' and name='owner';
insert into public.membership_roles(membership_id,role_id)
select '56000000-0000-0000-0000-000000000002',id from public.roles where tenant_id='16000000-0000-0000-0000-000000000001' and name='employee'
on conflict do nothing;
insert into public.employee_compensation(tenant_id,employee_id,salary_basis,base_salary,effective_from)
values('16000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','monthly',10000,'2026-01-01');

select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='16000000-0000-0000-0000-000000000001' and r.name='owner' and rp.permission_key in (select key from public.permissions where module in ('loans','performance'))),10,'owners receive every financial and performance capability');
select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='16000000-0000-0000-0000-000000000001' and r.name='employee' and rp.permission_key like 'loans.%'),2,'employees can read and request their own loans');
select throws_ok($$insert into public.loan_requests(tenant_id,employee_id,requested_amount,requested_installments,requested_start_month,purpose) values('16000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000002',1000,2,'2026-08-01','Cross tenant')$$,'P0001','Cross-tenant financial-service relationship rejected','cross-tenant loan links are rejected');
select throws_ok($$insert into public.sales_entries(tenant_id,business_date,branch_id,amount) values('16000000-0000-0000-0000-000000000001','2026-08-01','26000000-0000-0000-0000-000000000002',1000)$$,'P0001','Cross-tenant performance relationship rejected','cross-tenant sales links are rejected');

select set_config('request.jwt.claim.sub','46000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select lives_ok($$select public.submit_loan_request('36000000-0000-0000-0000-000000000001',1200,3,'2026-08-15','Emergency family expense')$$,'employee can submit a personal loan request');
select is((select status::text from public.loan_requests where employee_id='36000000-0000-0000-0000-000000000001'),'submitted','new loan request awaits review');
select is((select requested_start_month from public.loan_requests where employee_id='36000000-0000-0000-0000-000000000001'),'2026-08-01'::date,'requested start date is normalized to its month');
select is((select count(*)::integer from public.loan_requests),1,'employee RLS only exposes the personal request');
reset role;

select set_config('request.jwt.claim.sub','46000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.review_loan_request((select id from public.loan_requests where employee_id='36000000-0000-0000-0000-000000000001'),true,1200,3,'2026-08-01','Approved interest-free advance')$$,'owner can approve and convert a request');
select is((select status::text from public.loan_requests where employee_id='36000000-0000-0000-0000-000000000001'),'approved','approved request records the decision');
select is((select status::text from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),'active','approval creates an active loan');
select is((select count(*)::integer from public.loan_installments),3,'approval creates every installment');
select is((select sum(amount) from public.loan_installments),1200.00::numeric,'installments exactly equal the approved principal');
select is((select remaining_balance from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),1200.00::numeric,'new loan begins with the full balance outstanding');
select lives_ok($$select public.reschedule_loan_installment((select id from public.loan_installments where installment_number=2),'2026-12-01','Employee hardship')$$,'authorized rescheduling records a reason');
select is((select status::text from public.loan_installments where installment_number=2),'deferred','rescheduled installment is visibly deferred');
select is((select original_due_date from public.loan_installments where installment_number=2),'2026-09-01'::date,'rescheduling preserves the original due date');
select lives_ok($$select public.record_loan_payment((select id from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),200,'2026-08-10','cash','RCPT-1','Partial cash payment')$$,'authorized partial payment is recorded');
select is((select total_paid from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),200.00::numeric,'payment updates total paid');
select is((select remaining_balance from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),1000.00::numeric,'payment updates remaining balance');
select is((select status::text from public.loan_installments where installment_number=1),'partial','partial payment updates installment status');

select lives_ok($$select public.record_sales_entry('16000000-0000-0000-0000-000000000001','2026-08-05','26000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001',11000,'EGP','SALE-1','August employee sales')$$,'managerial sales submission works');
select lives_ok($$select public.review_sales_entry((select id from public.sales_entries where reference='SALE-1'),true,'Verified against POS')$$,'authorized sales approval works');
select is((select status::text from public.sales_entries where reference='SALE-1'),'approved','approved sales become eligible for targets');
select lives_ok($$select public.create_bonus_policy('16000000-0000-0000-0000-000000000001','STANDARD','Standard incentive','', 'fixed_amount','[{"min_percentage":80,"value":500},{"min_percentage":100,"value":1000}]'::jsonb,'2026-01-01',null)$$,'owner can create tiered bonus policy');
select lives_ok($$select public.create_sales_target('16000000-0000-0000-0000-000000000001','AUG-EMP','August employee target','2026-08-01','2026-08-31','employee','36000000-0000-0000-0000-000000000001',10000,'EGP',(select id from public.bonus_policies where code='STANDARD'))$$,'owner can create an employee target');
select lives_ok($$select public.calculate_bonus_target((select id from public.sales_targets where code='AUG-EMP'))$$,'target calculation succeeds');
select is((select achievement_percentage from public.bonus_results),110.0000::numeric,'achievement percentage reflects approved sales');
select is((select bonus_amount from public.bonus_results),1000.00::numeric,'highest eligible tier determines the bonus');
select lives_ok($$select public.review_bonus_target((select id from public.sales_targets where code='AUG-EMP'),true,'Approved for payroll')$$,'bonus approval succeeds');
select is((select status::text from public.bonus_results),'approved','approved bonus is ready for payroll');
select throws_ok($$select public.calculate_bonus_target((select id from public.sales_targets where code='AUG-EMP'))$$,'P0001','Approved or paid bonus results are locked','approved incentive results cannot be rewritten');

reset role;
insert into public.payroll_periods(id,tenant_id,code,name,period_start,period_end,pay_date,currency_code)
values('66000000-0000-0000-0000-000000000001','16000000-0000-0000-0000-000000000001','2026-08-BIZ','August Business','2026-08-01','2026-08-31','2026-08-31','EGP');
select set_config('request.jwt.claim.sub','46000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.calculate_payroll_period('66000000-0000-0000-0000-000000000001')$$,'payroll imports eligible loan and bonus components');
select is((select amount from public.payroll_components where code='loan_installment'),200.00::numeric,'payroll deducts only the unpaid installment balance');
select is((select amount from public.payroll_components where code='sales_bonus'),1000.00::numeric,'payroll imports the approved sales bonus');
select is((select net_amount from public.payroll_employee_results where period_id='66000000-0000-0000-0000-000000000001'),10800.00::numeric,'net payroll combines base pay loan deduction and bonus');
select lives_ok($$select public.transition_payroll_period('66000000-0000-0000-0000-000000000001','reviewed','Ready'); select public.transition_payroll_period('66000000-0000-0000-0000-000000000001','approved','Approved'); select public.transition_payroll_period('66000000-0000-0000-0000-000000000001','locked','Locked'); select public.transition_payroll_period('66000000-0000-0000-0000-000000000001','published','Published')$$,'payroll publication finalizes financial-service components');
select is((select status::text from public.loan_installments where installment_number=1),'deducted','published payroll marks the installment deducted');
select is((select total_paid from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),400.00::numeric,'published payroll updates the loan statement');
select is((select status::text from public.bonus_results),'paid','published payroll marks the approved bonus paid');
select is((select payroll_period_id from public.bonus_results),'66000000-0000-0000-0000-000000000001'::uuid,'paid bonus links to its payroll period');
select lives_ok($$select public.record_loan_payment((select id from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),800,'2026-08-31','settlement','SETTLE-1','Early settlement')$$,'remaining principal can be settled early');
select is((select status::text from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),'settled','early settlement closes the loan');
select is((select remaining_balance from public.employee_loans where employee_id='36000000-0000-0000-0000-000000000001'),0.00::numeric,'settled loan has no outstanding balance');

select * from finish();
rollback;
