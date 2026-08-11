-- Repeatable task and announcement examples for the public Shiftly preview.
do $collaboration_seed$
declare v_tenant uuid; v_owner uuid; v_employee uuid; v_employee_two uuid; v_assignment uuid; v_submission uuid; v_role uuid;
begin
  select id into v_tenant from public.tenants where slug='shiftly-demo';
  if v_tenant is null then raise notice 'Shiftly demo tenant does not exist; collaboration seed skipped.'; return; end if;
  select user_id into v_owner from public.memberships where tenant_id=v_tenant and status='active' and is_owner order by joined_at limit 1;
  select id into v_employee from public.employees where tenant_id=v_tenant and status<>'terminated' order by employee_code limit 1;
  select id into v_employee_two from public.employees where tenant_id=v_tenant and status<>'terminated' and id<>v_employee order by employee_code limit 1;
  select id into v_role from public.roles where tenant_id=v_tenant and name='employee' limit 1;
  if v_employee is null then raise notice 'Shiftly demo employees do not exist; collaboration seed skipped.'; return; end if;

  insert into public.tasks(id,tenant_id,series_id,occurrence_number,title_en,title_ar,description_en,description_ar,priority,start_at,due_at,require_evidence,recurrence,recurrence_interval,recurrence_end_date,status,created_by)
  values
  ('18000000-0000-0000-0000-000000000001',v_tenant,'18100000-0000-0000-0000-000000000001',1,'Opening visual-merchandising check','فحص تجهيزات افتتاح الفرع','Photograph the entrance, promotion table, and till area before opening.','صوّر المدخل وطاولة العروض ومنطقة الخزينة قبل الافتتاح.','urgent','2026-08-11 09:00+03','2026-08-11 11:00+03',true,'daily',1,'2026-08-15','in_progress',v_owner),
  ('18000000-0000-0000-0000-000000000002',v_tenant,'18100000-0000-0000-0000-000000000002',1,'Weekly inventory variance review','مراجعة فروقات المخزون الأسبوعية','Compare the counted stock with the POS export and explain every variance.','قارن المخزون الفعلي بتقرير نقاط البيع واشرح كل فرق.','high','2026-08-10 10:00+03','2026-08-13 18:00+03',true,'weekly',1,'2026-09-30','submitted',v_owner),
  ('18000000-0000-0000-0000-000000000003',v_tenant,'18100000-0000-0000-0000-000000000003',1,'Customer follow-up list','قائمة متابعة العملاء','Complete the priority customer follow-up list.','أكمل قائمة متابعة العملاء ذوي الأولوية.','normal','2026-08-05 10:00+03','2026-08-07 18:00+03',false,'none',1,null,'approved',v_owner)
  on conflict(id) do update set title_en=excluded.title_en,description_en=excluded.description_en,priority=excluded.priority,start_at=excluded.start_at,due_at=excluded.due_at,status=excluded.status;

  insert into public.task_assignments(id,tenant_id,task_id,employee_id,status,assigned_by,started_at,submitted_at,reviewed_at,reviewed_by,review_note)
  values
  ('28000000-0000-0000-0000-000000000001',v_tenant,'18000000-0000-0000-0000-000000000001',v_employee,'in_progress',v_owner,'2026-08-11 09:08+03',null,null,null,null),
  ('28000000-0000-0000-0000-000000000002',v_tenant,'18000000-0000-0000-0000-000000000002',coalesce(v_employee_two,v_employee),'submitted',v_owner,'2026-08-10 10:30+03','2026-08-11 17:20+03',null,null,null),
  ('28000000-0000-0000-0000-000000000003',v_tenant,'18000000-0000-0000-0000-000000000003',v_employee,'approved',v_owner,'2026-08-05 10:10+03','2026-08-07 15:00+03','2026-08-07 15:30+03',v_owner,'Completed on time')
  on conflict(id) do update set status=excluded.status,review_note=excluded.review_note;
  select id into v_assignment from public.task_assignments where id='28000000-0000-0000-0000-000000000002';
  insert into public.task_submissions(id,tenant_id,assignment_id,submission_number,notes,submitted_by,submitted_at)
  values('38000000-0000-0000-0000-000000000001',v_tenant,v_assignment,1,'Variance notes and supporting count sheets uploaded for review.',null,'2026-08-11 17:20+03')
  on conflict(id) do update set notes=excluded.notes returning id into v_submission;

  insert into public.announcements(id,tenant_id,title_en,title_ar,body_en,body_ar,priority,status,is_pinned,requires_acknowledgement,created_by,published_by,published_at,expires_at)
  values
  ('48000000-0000-0000-0000-000000000001',v_tenant,'August operating priorities','أولويات التشغيل لشهر أغسطس','Please review the service, attendance, and visual-merchandising priorities for every branch.','يرجى مراجعة أولويات الخدمة والحضور والعرض المرئي لكل فرع.','important','published',true,true,v_owner,v_owner,'2026-08-10 09:00+03','2026-08-31 23:59+03'),
  ('48000000-0000-0000-0000-000000000002',v_tenant,'New starter welcome','ترحيب بالموظفين الجدد','Welcome our new colleagues joining this week.','نرحب بزملائنا الجدد المنضمين هذا الأسبوع.','normal','draft',false,false,v_owner,null,null,null)
  on conflict(id) do update set title_en=excluded.title_en,body_en=excluded.body_en,priority=excluded.priority,status=excluded.status;
  insert into public.announcement_audiences(id,tenant_id,announcement_id,scope,scope_id)
  values('58000000-0000-0000-0000-000000000001',v_tenant,'48000000-0000-0000-0000-000000000001','company',null),('58000000-0000-0000-0000-000000000002',v_tenant,'48000000-0000-0000-0000-000000000002','roles',v_role)
  on conflict do nothing;
  insert into public.announcement_recipients(tenant_id,announcement_id,user_id,employee_id,delivered_at)
  select v_tenant,'48000000-0000-0000-0000-000000000001',m.user_id,e.id,'2026-08-10 09:00+03' from public.memberships m left join public.employees e on e.tenant_id=m.tenant_id and e.user_id=m.user_id where m.tenant_id=v_tenant and m.status='active'
  on conflict(announcement_id,user_id) do nothing;
end;
$collaboration_seed$;
