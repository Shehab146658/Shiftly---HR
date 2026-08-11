begin;
select no_plan();

select has_table('public','tasks','operational tasks exist');
select has_table('public','task_assignments','employee task assignments exist');
select has_table('public','task_submissions','submission history exists');
select has_table('public','task_attachments','task evidence metadata exists');
select has_table('public','task_comments','task collaboration exists');
select has_table('public','announcements','announcements exist');
select has_table('public','announcement_audiences','targeted announcement audiences exist');
select has_table('public','announcement_recipients','read receipt recipients exist');
select has_table('public','announcement_attachments','announcement files exist');

select has_column('public','tasks','require_evidence','tasks can require proof');
select has_column('public','tasks','recurrence','tasks retain recurrence rules');
select has_column('public','tasks','series_id','recurring task lineage is retained');
select has_column('public','task_assignments','review_note','task review decisions retain context');
select has_column('public','announcement_recipients','acknowledged_at','mandatory read confirmation is measured');
select has_column('public','announcements','is_pinned','important communications can be pinned');

select has_function('public','create_operational_task',array['uuid','text','text','text','text','task_priority','timestamp with time zone','timestamp with time zone','boolean','task_recurrence','integer','date','task_audience_scope','uuid[]'],'guarded task assignment exists');
select has_function('public','submit_task_assignment',array['uuid','text','jsonb'],'evidence-backed submission exists');
select has_function('public','review_task_assignment',array['uuid','boolean','text'],'task approval exists');
select has_function('public','create_announcement',array['uuid','text','text','text','text','announcement_priority','boolean','boolean','timestamp with time zone','announcement_audience_scope','uuid[]'],'targeted announcement creation exists');
select has_function('public','publish_announcement',array['uuid'],'announcement publication expands recipients');
select has_function('public','mark_announcement_read',array['uuid','boolean'],'read acknowledgement exists');

select ok((select relrowsecurity from pg_class where oid='public.tasks'::regclass),'tasks use RLS');
select ok((select relrowsecurity from pg_class where oid='public.task_assignments'::regclass),'task assignments use RLS');
select ok((select relrowsecurity from pg_class where oid='public.task_submissions'::regclass),'submissions use RLS');
select ok((select relrowsecurity from pg_class where oid='public.announcements'::regclass),'announcements use RLS');
select ok((select relrowsecurity from pg_class where oid='public.announcement_recipients'::regclass),'read receipts use RLS');
select is((select count(*)::integer from public.permissions where module='tasks'),4,'four task capabilities are configurable');
select is((select count(*)::integer from public.permissions where module='announcements'),3,'three announcement capabilities are configurable');
select ok(has_function_privilege('authenticated','public.create_operational_task(uuid,text,text,text,text,task_priority,timestamp with time zone,timestamp with time zone,boolean,task_recurrence,integer,date,task_audience_scope,uuid[])','EXECUTE'),'authenticated users can call guarded task creation');
select ok(not has_function_privilege('anon','public.create_operational_task(uuid,text,text,text,text,task_priority,timestamp with time zone,timestamp with time zone,boolean,task_recurrence,integer,date,task_audience_scope,uuid[])','EXECUTE'),'anonymous task creation is blocked');
select ok(not has_function_privilege('authenticated','public.clone_next_task_occurrence(uuid)','EXECUTE'),'recurrence cloning remains internal');

insert into public.tenants(id,slug,name_en,status) values
('17000000-0000-0000-0000-000000000001','collaboration-test','Collaboration Test','active'),
('17000000-0000-0000-0000-000000000002','collaboration-other','Collaboration Other','active');
insert into public.branches(id,tenant_id,code,name_en) values
('27000000-0000-0000-0000-000000000011','17000000-0000-0000-0000-000000000001','MAIN','Main Branch'),
('27000000-0000-0000-0000-000000000012','17000000-0000-0000-0000-000000000002','OTHER','Other Branch');
insert into public.teams(id,tenant_id,branch_id,code,name_en) values
('28000000-0000-0000-0000-000000000011','17000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000011','OPS','Operations');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('47000000-0000-0000-0000-000000000011','authenticated','authenticated','collaboration-owner@example.test','x',now(),'{}','{"full_name":"Collaboration Owner"}'),
('47000000-0000-0000-0000-000000000012','authenticated','authenticated','collaboration-employee@example.test','x',now(),'{}','{"full_name":"Collaboration Employee"}');
update public.tenants set created_by='47000000-0000-0000-0000-000000000011' where id='17000000-0000-0000-0000-000000000001';
insert into public.employees(id,tenant_id,user_id,employee_code,name_en,branch_id,team_id,status) values
('37000000-0000-0000-0000-000000000011','17000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000012','EMP-011','Operations Employee','27000000-0000-0000-0000-000000000011','28000000-0000-0000-0000-000000000011','active'),
('37000000-0000-0000-0000-000000000012','17000000-0000-0000-0000-000000000002',null,'OTH-011','Other Employee','27000000-0000-0000-0000-000000000012',null,'active');
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000011',true);
insert into public.memberships(id,tenant_id,user_id,status,is_owner,joined_at) values
('57000000-0000-0000-0000-000000000011','17000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000011','active',true,now()),
('57000000-0000-0000-0000-000000000012','17000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000012','active',false,now());
insert into public.membership_roles(membership_id,role_id) select '57000000-0000-0000-0000-000000000011',id from public.roles where tenant_id='17000000-0000-0000-0000-000000000001' and name='owner';
insert into public.membership_roles(membership_id,role_id) select '57000000-0000-0000-0000-000000000012',id from public.roles where tenant_id='17000000-0000-0000-0000-000000000001' and name='employee' on conflict do nothing;

select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='17000000-0000-0000-0000-000000000001' and r.name='owner' and rp.permission_key in (select key from public.permissions where module in ('tasks','announcements'))),7,'owners receive all collaboration capabilities');
select is((select count(*)::integer from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='17000000-0000-0000-0000-000000000001' and r.name='employee' and rp.permission_key in ('tasks.read','announcements.read')),2,'employees receive personal task and announcement access');

select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000011',true);
set local role authenticated;
select lives_ok($$select public.create_operational_task('17000000-0000-0000-0000-000000000001','Daily opening checklist','','Photograph the completed opening checklist','','high','2026-08-11 08:00+03','2026-08-11 10:00+03',true,'daily',1,'2026-08-12','employees',array['37000000-0000-0000-0000-000000000011']::uuid[])$$,'owner can assign an evidence-backed recurring task');
select is((select count(*)::integer from public.tasks where tenant_id='17000000-0000-0000-0000-000000000001'),1,'task creation produces the first occurrence');
select is((select count(*)::integer from public.task_assignments where tenant_id='17000000-0000-0000-0000-000000000001'),1,'selected employee receives one assignment');
reset role;
select throws_ok($$insert into public.task_assignments(tenant_id,task_id,employee_id) values('17000000-0000-0000-0000-000000000001',(select id from public.tasks where tenant_id='17000000-0000-0000-0000-000000000001'),'37000000-0000-0000-0000-000000000012')$$,'P0001','Cross-tenant collaboration relationship rejected','cross-tenant assignment links are rejected');

select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000012',true);
set local role authenticated;
select is((select count(*)::integer from public.tasks),1,'employee RLS exposes the assigned task');
select lives_ok($$select public.start_task_assignment((select id from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'))$$,'assignee can start work');
select is((select status::text from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'),'in_progress','starting work updates assignment status');
select throws_ok($$select public.submit_task_assignment((select id from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'),'Completed','[]'::jsonb)$$,'P0001','Completion evidence is required','required evidence cannot be bypassed');
select lives_ok($$select public.submit_task_assignment((select id from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'),'Completed with photo','[{"storage_path":"tenant/assignment/evidence.jpg","file_name":"evidence.jpg","mime_type":"image/jpeg","size_bytes":2048}]'::jsonb)$$,'assignee can submit evidence');
select is((select status::text from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'),'submitted','submitted work awaits review');
select is((select count(*)::integer from public.task_attachments),1,'evidence metadata is retained');
select lives_ok($$select public.add_task_comment((select id from public.tasks),'Opening complete and ready for review')$$,'assignee can add a progress comment');
reset role;

select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000011',true);
set local role authenticated;
select lives_ok($$select public.review_task_assignment((select id from public.task_assignments where employee_id='37000000-0000-0000-0000-000000000011'),true,'Photo verified')$$,'owner can approve submitted evidence');
select is((select status::text from public.tasks where occurrence_number=1),'approved','all approved assignments complete the occurrence');
select is((select count(*)::integer from public.tasks where series_id=(select series_id from public.tasks where occurrence_number=1)),2,'approval automatically creates the next recurrence');
select is((select start_at from public.tasks where occurrence_number=2),'2026-08-12 05:00:00+00'::timestamptz,'daily recurrence advances its start time exactly');
select is((select a.status::text from public.task_assignments a join public.tasks t on t.id=a.task_id where t.occurrence_number=2),'assigned','new recurrence is ready for delivery');

select lives_ok($$select public.create_announcement('17000000-0000-0000-0000-000000000001','Emergency drill','','The branch drill starts at 3 PM.','', 'critical',true,true,null,'company','{}'::uuid[])$$,'publisher can create a company announcement draft');
select is((select status::text from public.announcements),'draft','new announcement begins as a reviewable draft');
select lives_ok($$select public.publish_announcement((select id from public.announcements))$$,'publisher can release the announcement');
select is((select status::text from public.announcements),'published','released announcement is visibly published');
select is((select count(*)::integer from public.announcement_recipients),2,'company publication expands every active account');
reset role;
select is((select count(*)::integer from public.notifications where kind='announcement.published'),1,'publication notifies other recipients without notifying the actor');

select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-000000000012',true);
set local role authenticated;
select is((select count(*)::integer from public.announcements),1,'recipient can read the addressed announcement');
select lives_ok($$select public.mark_announcement_read((select id from public.announcements),true)$$,'recipient can acknowledge an important announcement');
select ok((select read_at is not null and acknowledged_at is not null from public.announcement_recipients where user_id='47000000-0000-0000-0000-000000000012'),'read and acknowledgement timestamps are independently retained');
reset role;

select * from finish();
rollback;
