begin;
select no_plan();

select has_table('public','attendance_devices','fingerprint device registry exists');
select has_table('public','attendance_import_batches','attendance import batches exist');
select has_table('public','attendance_import_rows','row reconciliation history exists');
select has_column('public','attendance_punches','attendance_device_id','punch evidence links to its registered device');
select has_function('public','create_attendance_device',array['uuid','uuid','text','text','text','text','text','text','text'],'guarded device configuration exists');
select has_function('public','set_attendance_device_status',array['uuid','text'],'guarded device state management exists');
select has_function('public','import_fingerprint_punches',array['uuid','text','text','jsonb','jsonb'],'guarded idempotent fingerprint ingestion exists');
select ok((select relrowsecurity from pg_class where oid='public.attendance_devices'::regclass),'device registry uses RLS');
select ok((select relrowsecurity from pg_class where oid='public.attendance_import_batches'::regclass),'import batches use RLS');
select ok((select relrowsecurity from pg_class where oid='public.attendance_import_rows'::regclass),'import reconciliation uses RLS');
select ok(has_function_privilege('authenticated','public.import_fingerprint_punches(uuid,text,text,jsonb,jsonb)','EXECUTE'),'authorized administrators can call fingerprint ingestion');
select ok(not has_function_privilege('anon','public.import_fingerprint_punches(uuid,text,text,jsonb,jsonb)','EXECUTE'),'anonymous fingerprint ingestion is blocked');
select ok(not has_table_privilege('authenticated','public.attendance_import_rows','INSERT'),'clients cannot forge reconciliation history');
select has_index('public','attendance_punches','attendance_punches_device_idx','device punch lookups are indexed');

insert into public.tenants(id,slug,name_en,timezone,status) values
('18000000-0000-0000-0000-000000000001','fingerprint-test','Fingerprint Test','Africa/Cairo','active'),
('18000000-0000-0000-0000-000000000002','fingerprint-other','Fingerprint Other','Africa/Cairo','active');
insert into public.branches(id,tenant_id,code,name_en,operational_day_start) values
('28000000-0000-0000-0000-000000000021','18000000-0000-0000-0000-000000000001','MAIN','Main Branch','06:00'),
('28000000-0000-0000-0000-000000000022','18000000-0000-0000-0000-000000000002','OTHER','Other Branch','06:00');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('48000000-0000-0000-0000-000000000021','authenticated','authenticated','fingerprint-owner@example.test','x',now(),'{}','{"full_name":"Fingerprint Owner"}'),
('48000000-0000-0000-0000-000000000022','authenticated','authenticated','fingerprint-employee@example.test','x',now(),'{}','{"full_name":"Fingerprint Employee"}');
update public.tenants set created_by='48000000-0000-0000-0000-000000000021' where id='18000000-0000-0000-0000-000000000001';
insert into public.employees(id,tenant_id,user_id,employee_code,name_en,branch_id,status) values
('38000000-0000-0000-0000-000000000021','18000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000022','EMP-FP-1','Fingerprint Employee','28000000-0000-0000-0000-000000000021','active');
select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000021',true);
insert into public.memberships(id,tenant_id,user_id,status,is_owner,joined_at) values
('58000000-0000-0000-0000-000000000021','18000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000021','active',true,now()),
('58000000-0000-0000-0000-000000000022','18000000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000022','active',false,now());
insert into public.membership_roles(membership_id,role_id)
select '58000000-0000-0000-0000-000000000021',id from public.roles where tenant_id='18000000-0000-0000-0000-000000000001' and name='owner';
insert into public.membership_roles(membership_id,role_id)
select '58000000-0000-0000-0000-000000000022',id from public.roles where tenant_id='18000000-0000-0000-0000-000000000001' and name='employee' on conflict do nothing;

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000021',true);
set local role authenticated;
select lives_ok(
  $$select public.create_attendance_device(
    '18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000021',
    'fp-main','Main entrance terminal','generic','ZK-compatible','SN-TEST-1','file','Africa/Cairo'
  )$$,
  'owner can register a branch fingerprint terminal'
);
select is((select code from public.attendance_devices),'FP-MAIN','device codes are normalized for reliable imports');
select is((select count(*)::integer from public.attendance_devices),1,'owner RLS exposes the registered device');

select lives_ok(
  $$select public.import_fingerprint_punches(
    (select id from public.attendance_devices where code='FP-MAIN'),
    'attendance-2026-08-11.csv',repeat('a',64),
    jsonb_build_array(
      jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-11 09:04:00','punch_type','check_in','external_reference','FP-LOG-1','branch_code','MAIN'),
      jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-11 18:01:00','punch_type','check_out','external_reference','FP-LOG-2','branch_code','MAIN'),
      jsonb_build_object('employee_number','UNKNOWN','occurred_at','2026-08-11 09:00:00','punch_type','check_in','external_reference','FP-LOG-3'),
      jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-11 09:00:00','punch_type','break','external_reference','FP-LOG-4')
    ),
    jsonb_build_object('employee_number','PIN','occurred_at','Punch Time','punch_type','State')
  )$$,
  'valid rows import while invalid device rows remain reviewable'
);
select is((select status from public.attendance_import_batches),'completed_with_errors','partial file issues do not lose valid punches');
select is((select imported_count from public.attendance_import_batches),2,'valid fingerprint rows are imported');
select is((select error_count from public.attendance_import_batches),2,'invalid rows are counted for reconciliation');
select is((select count(*)::integer from public.attendance_import_rows where status='error'),2,'every failed row retains its own error');
select is((select count(*)::integer from public.attendance_punches where source='fingerprint'),2,'fingerprint evidence reaches attendance calculations');
select is((select count(*)::integer from public.attendance_punches where attendance_device_id=(select id from public.attendance_devices)),2,'every imported punch retains device lineage');
select is((select occurred_at from public.attendance_punches where external_reference='FP-LOG-1'),'2026-08-11 06:04:00+00'::timestamptz,'timezone-free device time is interpreted using device timezone');
select is((select work_date from public.attendance_punches where external_reference='FP-LOG-1'),'2026-08-11'::date,'branch operational-day boundary assigns the correct work date');

select is(
  public.import_fingerprint_punches(
    (select id from public.attendance_devices where code='FP-MAIN'),'same-file-renamed.csv',repeat('a',64),
    jsonb_build_array(jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-12 09:00:00','punch_type','check_in')),
    '{}'::jsonb
  ),
  (select id from public.attendance_import_batches where file_sha256=repeat('a',64)),
  'the same file checksum returns its original batch instead of duplicating attendance'
);
select is((select count(*)::integer from public.attendance_import_batches),1,'idempotent retry does not create another batch');

select lives_ok(
  $$select public.import_fingerprint_punches(
    (select id from public.attendance_devices where code='FP-MAIN'),'duplicate-reference.csv',repeat('b',64),
    jsonb_build_array(jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-11 09:04:00','punch_type','check_in','external_reference','FP-LOG-1')),
    '{}'::jsonb
  )$$,
  'a different file safely reconciles an already imported device reference'
);
select is((select duplicate_count from public.attendance_import_batches where file_sha256=repeat('b',64)),1,'duplicate device logs are reported without another punch');
select is((select count(*)::integer from public.attendance_punches where source='fingerprint'),2,'duplicate reconciliation preserves the unique punch set');
select set_config('shiftly.test_device_id',(select id::text from public.attendance_devices where code='FP-MAIN'),true);
reset role;

select throws_ok(
  $$insert into public.attendance_devices(tenant_id,branch_id,code,name,timezone) values(
    '18000000-0000-0000-0000-000000000001','28000000-0000-0000-0000-000000000022','CROSS','Cross tenant','Africa/Cairo'
  )$$,
  'P0001','Attendance device branch must belong to the same company','cross-company device configuration is rejected'
);

select set_config('request.jwt.claim.sub','48000000-0000-0000-0000-000000000022',true);
set local role authenticated;
select is((select count(*)::integer from public.attendance_devices),0,'ordinary employees cannot read device configuration');
select throws_ok(
  $$select public.import_fingerprint_punches(
    current_setting('shiftly.test_device_id')::uuid,'unauthorized.csv',repeat('c',64),jsonb_build_array(jsonb_build_object('employee_number','EMP-FP-1','occurred_at','2026-08-11 09:00:00','punch_type','check_in')),'{}'::jsonb
  )$$,
  'P0001','Not authorized to import attendance','employees cannot invoke the integration import boundary'
);
reset role;

select * from finish();
rollback;
