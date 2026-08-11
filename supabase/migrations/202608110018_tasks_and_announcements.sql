-- Operational task delivery, evidence-backed completion, and targeted company communications.

create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.task_recurrence as enum ('none', 'daily', 'weekly', 'monthly');
create type public.task_status as enum ('assigned', 'in_progress', 'submitted', 'approved', 'cancelled');
create type public.task_assignment_status as enum ('assigned', 'in_progress', 'submitted', 'approved', 'rejected', 'cancelled');
create type public.task_audience_scope as enum ('employees', 'team', 'branch', 'company');
create type public.announcement_priority as enum ('normal', 'important', 'critical');
create type public.announcement_status as enum ('draft', 'published', 'archived');
create type public.announcement_audience_scope as enum ('company', 'branches', 'teams', 'employees', 'roles');

insert into public.permissions(key, description, module) values
  ('tasks.read', 'View assigned tasks and their delivery history', 'tasks'),
  ('tasks.create', 'Create and assign operational tasks', 'tasks'),
  ('tasks.approve', 'Review task evidence for managed employees', 'tasks'),
  ('tasks.manage', 'Manage all company tasks and recurring work', 'tasks'),
  ('announcements.read', 'View targeted company announcements', 'announcements'),
  ('announcements.publish', 'Create, publish, and archive announcements', 'announcements'),
  ('announcements.analytics', 'View announcement readership and acknowledgements', 'announcements')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r cross join public.permissions p
where (r.name in ('owner','hr_admin') and p.module in ('tasks','announcements'))
   or (r.name in ('branch_manager','team_manager') and p.key in ('tasks.read','tasks.create','tasks.approve','announcements.read','announcements.publish','announcements.analytics'))
   or (r.name in ('payroll_officer','accountant','employee') and p.key in ('tasks.read','announcements.read'))
on conflict do nothing;

create or replace function public.grant_collaboration_permissions_for_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name in ('owner','hr_admin') then
    insert into public.role_permissions(role_id,permission_key)
    select new.id,key from public.permissions where module in ('tasks','announcements') on conflict do nothing;
  elsif new.name in ('branch_manager','team_manager') then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'tasks.read'),(new.id,'tasks.create'),(new.id,'tasks.approve'),
      (new.id,'announcements.read'),(new.id,'announcements.publish'),(new.id,'announcements.analytics') on conflict do nothing;
  elsif new.name in ('payroll_officer','accountant','employee') then
    insert into public.role_permissions(role_id,permission_key) values
      (new.id,'tasks.read'),(new.id,'announcements.read') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_collaboration_permissions_after_role
after insert on public.roles for each row execute function public.grant_collaboration_permissions_for_role();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  series_id uuid not null default gen_random_uuid(),
  occurrence_number integer not null default 1 check (occurrence_number > 0),
  title_en text not null check (length(trim(title_en)) between 2 and 180),
  title_ar text,
  description_en text not null check (length(trim(description_en)) between 2 and 5000),
  description_ar text,
  priority public.task_priority not null default 'normal',
  start_at timestamptz not null,
  due_at timestamptz not null,
  require_evidence boolean not null default false,
  recurrence public.task_recurrence not null default 'none',
  recurrence_interval integer not null default 1 check (recurrence_interval between 1 and 365),
  recurrence_end_date date,
  status public.task_status not null default 'assigned',
  created_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id, occurrence_number),
  check (due_at > start_at),
  check (recurrence <> 'none' or recurrence_end_date is null)
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status public.task_assignment_status not null default 'assigned',
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  updated_at timestamptz not null default now(),
  unique(task_id, employee_id)
);

create table public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assignment_id uuid not null references public.task_assignments(id) on delete cascade,
  submission_number integer not null check (submission_number > 0),
  notes text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  decision text check (decision is null or decision in ('approved','rejected')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  unique(assignment_id, submission_number)
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  submission_id uuid not null references public.task_submissions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 20971520),
  created_at timestamptz not null default now(),
  unique(submission_id, storage_path)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index tasks_tenant_status_due_idx on public.tasks(tenant_id,status,due_at);
create index task_assignments_employee_status_idx on public.task_assignments(employee_id,status,updated_at desc);
create index task_submissions_assignment_idx on public.task_submissions(assignment_id,submission_number desc);
create index task_comments_task_idx on public.task_comments(task_id,created_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title_en text not null check (length(trim(title_en)) between 2 and 180),
  title_ar text,
  body_en text not null check (length(trim(body_en)) between 2 and 10000),
  body_ar text,
  priority public.announcement_priority not null default 'normal',
  status public.announcement_status not null default 'draft',
  is_pinned boolean not null default false,
  requires_acknowledgement boolean not null default false,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > created_at)
);

create table public.announcement_audiences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  scope public.announcement_audience_scope not null,
  scope_id uuid,
  created_at timestamptz not null default now(),
  check ((scope='company' and scope_id is null) or (scope<>'company' and scope_id is not null)),
  unique(announcement_id,scope,scope_id)
);
create unique index announcement_company_audience_unique on public.announcement_audiences(announcement_id) where scope='company';

create table public.announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  unique(announcement_id,user_id)
);

create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 20971520),
  created_at timestamptz not null default now(),
  unique(announcement_id,storage_path)
);

create index announcements_tenant_status_idx on public.announcements(tenant_id,status,published_at desc);
create index announcement_recipients_user_idx on public.announcement_recipients(user_id,read_at,delivered_at desc);

create or replace function public.validate_collaboration_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_valid boolean := false;
begin
  if tg_table_name='task_assignments' then
    select exists(select 1 from public.tasks t where t.id=new.task_id and t.tenant_id=new.tenant_id)
       and exists(select 1 from public.employees e where e.id=new.employee_id and e.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name='task_submissions' then
    select exists(select 1 from public.task_assignments a where a.id=new.assignment_id and a.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name='task_attachments' then
    select exists(select 1 from public.task_submissions s where s.id=new.submission_id and s.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name='task_comments' then
    select exists(select 1 from public.tasks t where t.id=new.task_id and t.tenant_id=new.tenant_id) into v_valid;
  elsif tg_table_name='announcement_audiences' then
    select exists(select 1 from public.announcements a where a.id=new.announcement_id and a.tenant_id=new.tenant_id)
       and case new.scope
         when 'company' then new.scope_id is null
         when 'branches' then exists(select 1 from public.branches b where b.id=new.scope_id and b.tenant_id=new.tenant_id)
         when 'teams' then exists(select 1 from public.teams t where t.id=new.scope_id and t.tenant_id=new.tenant_id)
         when 'employees' then exists(select 1 from public.employees e where e.id=new.scope_id and e.tenant_id=new.tenant_id)
         when 'roles' then exists(select 1 from public.roles r where r.id=new.scope_id and r.tenant_id=new.tenant_id)
       end into v_valid;
  elsif tg_table_name='announcement_recipients' then
    select exists(select 1 from public.announcements a where a.id=new.announcement_id and a.tenant_id=new.tenant_id)
       and exists(select 1 from public.memberships m where m.tenant_id=new.tenant_id and m.user_id=new.user_id and m.status='active')
       and (new.employee_id is null or exists(select 1 from public.employees e where e.id=new.employee_id and e.user_id=new.user_id and e.tenant_id=new.tenant_id)) into v_valid;
  elsif tg_table_name='announcement_attachments' then
    select exists(select 1 from public.announcements a where a.id=new.announcement_id and a.tenant_id=new.tenant_id) into v_valid;
  end if;
  if not v_valid then raise exception 'Cross-tenant collaboration relationship rejected'; end if;
  return new;
end;
$$;

create trigger validate_task_assignments before insert or update on public.task_assignments for each row execute function public.validate_collaboration_links();
create trigger validate_task_submissions before insert or update on public.task_submissions for each row execute function public.validate_collaboration_links();
create trigger validate_task_attachments before insert or update on public.task_attachments for each row execute function public.validate_collaboration_links();
create trigger validate_task_comments before insert or update on public.task_comments for each row execute function public.validate_collaboration_links();
create trigger validate_announcement_audiences before insert or update on public.announcement_audiences for each row execute function public.validate_collaboration_links();
create trigger validate_announcement_recipients before insert or update on public.announcement_recipients for each row execute function public.validate_collaboration_links();
create trigger validate_announcement_attachments before insert or update on public.announcement_attachments for each row execute function public.validate_collaboration_links();

create or replace function public.can_manage_task_employee(p_tenant_id uuid,p_employee_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_viewer public.employees%rowtype; v_target public.employees%rowtype; v_branch_manager boolean; v_team_manager boolean;
begin
  if public.has_permission(p_tenant_id,'tasks.manage') then return true; end if;
  if not public.has_permission(p_tenant_id,'tasks.approve') then return false; end if;
  select * into v_viewer from public.employees where tenant_id=p_tenant_id and user_id=auth.uid() and status<>'terminated' limit 1;
  select * into v_target from public.employees where id=p_employee_id and tenant_id=p_tenant_id and status<>'terminated';
  if v_viewer.id is null or v_target.id is null then return false; end if;
  select exists(select 1 from public.memberships m join public.membership_roles mr on mr.membership_id=m.id join public.roles r on r.id=mr.role_id where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' and r.name='branch_manager') into v_branch_manager;
  select exists(select 1 from public.memberships m join public.membership_roles mr on mr.membership_id=m.id join public.roles r on r.id=mr.role_id where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' and r.name='team_manager') into v_team_manager;
  return v_target.manager_employee_id=v_viewer.id
    or (v_team_manager and v_viewer.team_id is not null and v_target.team_id=v_viewer.team_id)
    or (v_branch_manager and v_viewer.branch_id is not null and v_target.branch_id=v_viewer.branch_id);
end;
$$;

create or replace function public.can_view_task_employee(p_tenant_id uuid,p_employee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_permission(p_tenant_id,'tasks.manage')
    or (public.has_permission(p_tenant_id,'tasks.read') and p_employee_id=public.current_employee_id(p_tenant_id))
    or public.can_manage_task_employee(p_tenant_id,p_employee_id)
$$;

create or replace function public.create_operational_task(
  p_tenant_id uuid,p_title_en text,p_title_ar text,p_description_en text,p_description_ar text,
  p_priority public.task_priority,p_start_at timestamptz,p_due_at timestamptz,p_require_evidence boolean,
  p_recurrence public.task_recurrence,p_recurrence_interval integer,p_recurrence_end_date date,
  p_scope public.task_audience_scope,p_scope_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_task_id uuid; v_count integer;
begin
  if not public.has_permission(p_tenant_id,'tasks.create') then raise exception 'Not authorized to create tasks'; end if;
  if p_due_at<=p_start_at then raise exception 'Task due time must follow its start time'; end if;
  if p_recurrence='none' and p_recurrence_end_date is not null then raise exception 'A one-time task cannot have a recurrence end date'; end if;
  insert into public.tasks(tenant_id,title_en,title_ar,description_en,description_ar,priority,start_at,due_at,require_evidence,recurrence,recurrence_interval,recurrence_end_date,created_by)
  values(p_tenant_id,trim(p_title_en),nullif(trim(p_title_ar),''),trim(p_description_en),nullif(trim(p_description_ar),''),p_priority,p_start_at,p_due_at,p_require_evidence,p_recurrence,p_recurrence_interval,p_recurrence_end_date,auth.uid()) returning id into v_task_id;
  if p_scope='employees' then
    insert into public.task_assignments(tenant_id,task_id,employee_id,assigned_by)
    select p_tenant_id,v_task_id,e.id,auth.uid() from public.employees e where e.tenant_id=p_tenant_id and e.status<>'terminated' and e.id=any(coalesce(p_scope_ids,'{}'::uuid[]));
  elsif p_scope='team' then
    insert into public.task_assignments(tenant_id,task_id,employee_id,assigned_by)
    select p_tenant_id,v_task_id,e.id,auth.uid() from public.employees e where e.tenant_id=p_tenant_id and e.status<>'terminated' and e.team_id=any(coalesce(p_scope_ids,'{}'::uuid[]));
  elsif p_scope='branch' then
    insert into public.task_assignments(tenant_id,task_id,employee_id,assigned_by)
    select p_tenant_id,v_task_id,e.id,auth.uid() from public.employees e where e.tenant_id=p_tenant_id and e.status<>'terminated' and e.branch_id=any(coalesce(p_scope_ids,'{}'::uuid[]));
  else
    insert into public.task_assignments(tenant_id,task_id,employee_id,assigned_by)
    select p_tenant_id,v_task_id,e.id,auth.uid() from public.employees e where e.tenant_id=p_tenant_id and e.status<>'terminated';
  end if;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Select at least one active employee'; end if;
  if not public.has_permission(p_tenant_id,'tasks.manage') and exists(select 1 from public.task_assignments a where a.task_id=v_task_id and not public.can_manage_task_employee(p_tenant_id,a.employee_id)) then raise exception 'One or more assignees are outside your management scope'; end if;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select p_tenant_id,e.user_id,'task.assigned','New task assigned','تم إسناد مهمة جديدة',trim(p_title_en),coalesce(nullif(trim(p_title_ar),''),trim(p_title_en)),'/en/tasks/'||v_task_id::text,'tasks',v_task_id::text
  from public.task_assignments a join public.employees e on e.id=a.employee_id where a.task_id=v_task_id and e.user_id is not null and e.user_id is distinct from auth.uid();
  return v_task_id;
end;
$$;

create or replace function public.start_task_assignment(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_assignment public.task_assignments%rowtype; v_task public.tasks%rowtype;
begin
  select * into v_assignment from public.task_assignments where id=p_assignment_id for update;
  select * into v_task from public.tasks where id=v_assignment.task_id;
  if v_assignment.employee_id<>public.current_employee_id(v_assignment.tenant_id) then raise exception 'Only the assignee can start this task'; end if;
  if v_assignment.status not in ('assigned','rejected') or v_task.status='cancelled' then raise exception 'Task cannot be started from its current status'; end if;
  update public.task_assignments set status='in_progress',started_at=coalesce(started_at,now()),review_note=null,updated_at=now() where id=p_assignment_id;
  update public.tasks set status='in_progress',updated_at=now() where id=v_task.id and status='assigned';
end;
$$;

create or replace function public.submit_task_assignment(p_assignment_id uuid,p_notes text,p_attachments jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_assignment public.task_assignments%rowtype; v_task public.tasks%rowtype; v_submission uuid; v_number integer; v_item record;
begin
  select * into v_assignment from public.task_assignments where id=p_assignment_id for update;
  select * into v_task from public.tasks where id=v_assignment.task_id;
  if v_assignment.employee_id<>public.current_employee_id(v_assignment.tenant_id) then raise exception 'Only the assignee can submit this task'; end if;
  if v_assignment.status not in ('assigned','in_progress','rejected') or v_task.status='cancelled' then raise exception 'Task cannot be submitted from its current status'; end if;
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb))<>'array' then raise exception 'Attachments must be an array'; end if;
  if v_task.require_evidence and jsonb_array_length(coalesce(p_attachments,'[]'::jsonb))=0 then raise exception 'Completion evidence is required'; end if;
  select coalesce(max(submission_number),0)+1 into v_number from public.task_submissions where assignment_id=p_assignment_id;
  insert into public.task_submissions(tenant_id,assignment_id,submission_number,notes,submitted_by)
  values(v_assignment.tenant_id,p_assignment_id,v_number,nullif(trim(p_notes),''),auth.uid()) returning id into v_submission;
  for v_item in select * from jsonb_to_recordset(coalesce(p_attachments,'[]'::jsonb)) as x(storage_path text,file_name text,mime_type text,size_bytes bigint)
  loop
    insert into public.task_attachments(tenant_id,submission_id,storage_path,file_name,mime_type,size_bytes)
    values(v_assignment.tenant_id,v_submission,v_item.storage_path,v_item.file_name,v_item.mime_type,v_item.size_bytes);
  end loop;
  update public.task_assignments set status='submitted',submitted_at=now(),reviewed_at=null,reviewed_by=null,review_note=null,updated_at=now() where id=p_assignment_id;
  update public.tasks set status='submitted',updated_at=now() where id=v_task.id;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select v_assignment.tenant_id,m.user_id,'task.submitted','Task ready for review','مهمة جاهزة للمراجعة',v_task.title_en,coalesce(v_task.title_ar,v_task.title_en),'/en/tasks/'||v_task.id::text,'tasks',v_task.id::text
  from public.memberships m join public.membership_roles mr on mr.membership_id=m.id join public.role_permissions rp on rp.role_id=mr.role_id
  where m.tenant_id=v_assignment.tenant_id and m.status='active' and rp.permission_key='tasks.approve' and m.user_id is distinct from auth.uid();
  return v_submission;
end;
$$;

create or replace function public.clone_next_task_occurrence(p_task_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_new_id uuid; v_next_start timestamptz; v_next_due timestamptz;
begin
  select * into v_task from public.tasks where id=p_task_id;
  if v_task.status<>'approved' or v_task.recurrence='none' then return null; end if;
  v_next_start:=case v_task.recurrence when 'daily' then v_task.start_at+(v_task.recurrence_interval||' days')::interval when 'weekly' then v_task.start_at+(v_task.recurrence_interval||' weeks')::interval else v_task.start_at+(v_task.recurrence_interval||' months')::interval end;
  v_next_due:=case v_task.recurrence when 'daily' then v_task.due_at+(v_task.recurrence_interval||' days')::interval when 'weekly' then v_task.due_at+(v_task.recurrence_interval||' weeks')::interval else v_task.due_at+(v_task.recurrence_interval||' months')::interval end;
  if v_task.recurrence_end_date is not null and v_next_start::date>v_task.recurrence_end_date then return null; end if;
  insert into public.tasks(tenant_id,series_id,occurrence_number,title_en,title_ar,description_en,description_ar,priority,start_at,due_at,require_evidence,recurrence,recurrence_interval,recurrence_end_date,created_by)
  values(v_task.tenant_id,v_task.series_id,v_task.occurrence_number+1,v_task.title_en,v_task.title_ar,v_task.description_en,v_task.description_ar,v_task.priority,v_next_start,v_next_due,v_task.require_evidence,v_task.recurrence,v_task.recurrence_interval,v_task.recurrence_end_date,v_task.created_by)
  on conflict(series_id,occurrence_number) do nothing returning id into v_new_id;
  if v_new_id is null then return (select id from public.tasks where series_id=v_task.series_id and occurrence_number=v_task.occurrence_number+1); end if;
  insert into public.task_assignments(tenant_id,task_id,employee_id,assigned_by)
  select tenant_id,v_new_id,employee_id,coalesce(auth.uid(),assigned_by) from public.task_assignments where task_id=p_task_id and status<>'cancelled';
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select v_task.tenant_id,e.user_id,'task.assigned','Recurring task assigned','تم إسناد مهمة متكررة',v_task.title_en,coalesce(v_task.title_ar,v_task.title_en),'/en/tasks/'||v_new_id::text,'tasks',v_new_id::text
  from public.task_assignments a join public.employees e on e.id=a.employee_id where a.task_id=v_new_id and e.user_id is not null and e.user_id is distinct from auth.uid();
  return v_new_id;
end;
$$;

create or replace function public.review_task_assignment(p_assignment_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_assignment public.task_assignments%rowtype; v_task public.tasks%rowtype; v_submission public.task_submissions%rowtype; v_all_approved boolean;
begin
  select * into v_assignment from public.task_assignments where id=p_assignment_id for update;
  select * into v_task from public.tasks where id=v_assignment.task_id;
  if not public.can_manage_task_employee(v_assignment.tenant_id,v_assignment.employee_id) then raise exception 'Not authorized to review this task'; end if;
  if v_assignment.status<>'submitted' then raise exception 'Only submitted work can be reviewed'; end if;
  select * into v_submission from public.task_submissions where assignment_id=p_assignment_id order by submission_number desc limit 1;
  if not p_approve and length(trim(p_note))<2 then raise exception 'A rejection reason is required'; end if;
  update public.task_submissions set decision=case when p_approve then 'approved' else 'rejected' end,decision_note=nullif(trim(p_note),''),decided_by=auth.uid(),decided_at=now() where id=v_submission.id;
  update public.task_assignments set status=case when p_approve then 'approved'::public.task_assignment_status else 'rejected'::public.task_assignment_status end,review_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_assignment_id;
  select bool_and(status='approved') into v_all_approved from public.task_assignments where task_id=v_task.id and status<>'cancelled';
  update public.tasks set status=case when v_all_approved then 'approved'::public.task_status else 'in_progress'::public.task_status end,updated_at=now() where id=v_task.id;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select v_assignment.tenant_id,e.user_id,case when p_approve then 'task.approved' else 'task.rejected' end,case when p_approve then 'Task approved' else 'Task needs changes' end,case when p_approve then 'تم اعتماد المهمة' else 'المهمة تحتاج تعديلات' end,coalesce(nullif(trim(p_note),''),v_task.title_en),coalesce(nullif(trim(p_note),''),v_task.title_ar,v_task.title_en),'/en/tasks/'||v_task.id::text,'tasks',v_task.id::text from public.employees e where e.id=v_assignment.employee_id and e.user_id is not null and e.user_id is distinct from auth.uid();
  if v_all_approved then perform public.clone_next_task_occurrence(v_task.id); end if;
end;
$$;

create or replace function public.add_task_comment(p_task_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_id uuid;
begin
  select * into v_task from public.tasks where id=p_task_id;
  if not exists(select 1 from public.task_assignments a where a.task_id=p_task_id and public.can_view_task_employee(v_task.tenant_id,a.employee_id)) then raise exception 'Not authorized to comment on this task'; end if;
  insert into public.task_comments(tenant_id,task_id,author_user_id,body) values(v_task.tenant_id,p_task_id,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_operational_task(p_task_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not public.has_permission(v_task.tenant_id,'tasks.manage') and v_task.created_by is distinct from auth.uid() then raise exception 'Not authorized to cancel this task'; end if;
  if v_task.status in ('approved','cancelled') then raise exception 'Completed or cancelled tasks cannot be cancelled'; end if;
  if length(trim(p_reason))<2 then raise exception 'A cancellation reason is required'; end if;
  update public.tasks set status='cancelled',cancelled_by=auth.uid(),cancellation_reason=trim(p_reason),updated_at=now() where id=p_task_id;
  update public.task_assignments set status='cancelled',updated_at=now() where task_id=p_task_id and status<>'approved';
end;
$$;

create or replace function public.create_announcement(
  p_tenant_id uuid,p_title_en text,p_title_ar text,p_body_en text,p_body_ar text,p_priority public.announcement_priority,
  p_is_pinned boolean,p_requires_acknowledgement boolean,p_expires_at timestamptz,p_scope public.announcement_audience_scope,p_scope_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_scope_id uuid; v_count integer:=0;
begin
  if not public.has_permission(p_tenant_id,'announcements.publish') then raise exception 'Not authorized to create announcements'; end if;
  insert into public.announcements(tenant_id,title_en,title_ar,body_en,body_ar,priority,is_pinned,requires_acknowledgement,expires_at,created_by)
  values(p_tenant_id,trim(p_title_en),nullif(trim(p_title_ar),''),trim(p_body_en),nullif(trim(p_body_ar),''),p_priority,p_is_pinned,p_requires_acknowledgement,p_expires_at,auth.uid()) returning id into v_id;
  if p_scope='company' then insert into public.announcement_audiences(tenant_id,announcement_id,scope) values(p_tenant_id,v_id,'company');
  else
    foreach v_scope_id in array coalesce(p_scope_ids,'{}'::uuid[]) loop insert into public.announcement_audiences(tenant_id,announcement_id,scope,scope_id) values(p_tenant_id,v_id,p_scope,v_scope_id); v_count:=v_count+1; end loop;
    if v_count=0 then raise exception 'Select at least one audience'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.add_announcement_attachment(p_announcement_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_item public.announcements%rowtype; v_id uuid;
begin
  select * into v_item from public.announcements where id=p_announcement_id;
  if v_item.status<>'draft' or not public.has_permission(v_item.tenant_id,'announcements.publish') then raise exception 'Announcement attachments can only be added to an authorized draft'; end if;
  insert into public.announcement_attachments(tenant_id,announcement_id,storage_path,file_name,mime_type,size_bytes) values(v_item.tenant_id,p_announcement_id,p_storage_path,p_file_name,p_mime_type,p_size_bytes) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.publish_announcement(p_announcement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.announcements%rowtype;
begin
  select * into v_item from public.announcements where id=p_announcement_id for update;
  if not public.has_permission(v_item.tenant_id,'announcements.publish') then raise exception 'Not authorized to publish announcements'; end if;
  if v_item.status<>'draft' then raise exception 'Only draft announcements can be published'; end if;
  insert into public.announcement_recipients(tenant_id,announcement_id,user_id,employee_id)
  select distinct v_item.tenant_id,v_item.id,m.user_id,e.id
  from public.memberships m
  left join public.employees e on e.tenant_id=m.tenant_id and e.user_id=m.user_id and e.status<>'terminated'
  where m.tenant_id=v_item.tenant_id and m.status='active' and exists(
    select 1 from public.announcement_audiences aa where aa.announcement_id=v_item.id and (
      aa.scope='company'
      or (aa.scope='branches' and e.branch_id=aa.scope_id)
      or (aa.scope='teams' and e.team_id=aa.scope_id)
      or (aa.scope='employees' and e.id=aa.scope_id)
      or (aa.scope='roles' and exists(select 1 from public.membership_roles mr where mr.membership_id=m.id and mr.role_id=aa.scope_id))
    )
  ) on conflict(announcement_id,user_id) do nothing;
  if not exists(select 1 from public.announcement_recipients where announcement_id=v_item.id) then raise exception 'The selected audience has no linked active accounts'; end if;
  update public.announcements set status='published',published_by=auth.uid(),published_at=now(),updated_at=now() where id=v_item.id;
  insert into public.notifications(tenant_id,recipient_user_id,kind,title_en,title_ar,body_en,body_ar,href,entity_type,entity_id)
  select v_item.tenant_id,r.user_id,'announcement.published',v_item.title_en,coalesce(v_item.title_ar,v_item.title_en),left(v_item.body_en,500),left(coalesce(v_item.body_ar,v_item.body_en),500),'/en/announcements','announcements',v_item.id::text from public.announcement_recipients r where r.announcement_id=v_item.id and r.user_id is distinct from auth.uid();
end;
$$;

create or replace function public.mark_announcement_read(p_announcement_id uuid,p_acknowledge boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.announcements%rowtype;
begin
  select * into v_item from public.announcements where id=p_announcement_id;
  update public.announcement_recipients set read_at=coalesce(read_at,now()),acknowledged_at=case when p_acknowledge then coalesce(acknowledged_at,now()) else acknowledged_at end where announcement_id=p_announcement_id and user_id=auth.uid();
  if not found then raise exception 'Announcement is not addressed to this account'; end if;
  if p_acknowledge and not v_item.requires_acknowledgement then raise exception 'This announcement does not require acknowledgement'; end if;
end;
$$;

create or replace function public.archive_announcement(p_announcement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.announcements%rowtype;
begin
  select * into v_item from public.announcements where id=p_announcement_id for update;
  if not public.has_permission(v_item.tenant_id,'announcements.publish') then raise exception 'Not authorized to archive announcements'; end if;
  if v_item.status='archived' then return; end if;
  update public.announcements set status='archived',archived_by=auth.uid(),archived_at=now(),updated_at=now() where id=p_announcement_id;
end;
$$;

create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger task_assignments_set_updated_at before update on public.task_assignments for each row execute function public.set_updated_at();
create trigger announcements_set_updated_at before update on public.announcements for each row execute function public.set_updated_at();
create trigger audit_tasks after insert or update or delete on public.tasks for each row execute function public.capture_audit_log();
create trigger audit_task_assignments after insert or update or delete on public.task_assignments for each row execute function public.capture_audit_log();
create trigger audit_announcements after insert or update or delete on public.announcements for each row execute function public.capture_audit_log();

alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_submissions enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_comments enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_audiences enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.announcement_attachments enable row level security;

create policy tasks_read on public.tasks for select to authenticated using(
  public.has_permission(tenant_id,'tasks.manage') or exists(select 1 from public.task_assignments a where a.task_id=public.tasks.id and public.can_view_task_employee(public.tasks.tenant_id,a.employee_id))
);
create policy task_assignments_read on public.task_assignments for select to authenticated using(public.can_view_task_employee(tenant_id,employee_id));
create policy task_submissions_read on public.task_submissions for select to authenticated using(exists(select 1 from public.task_assignments a where a.id=public.task_submissions.assignment_id and public.can_view_task_employee(public.task_submissions.tenant_id,a.employee_id)));
create policy task_attachments_read on public.task_attachments for select to authenticated using(exists(select 1 from public.task_submissions s join public.task_assignments a on a.id=s.assignment_id where s.id=public.task_attachments.submission_id and public.can_view_task_employee(public.task_attachments.tenant_id,a.employee_id)));
create policy task_comments_read on public.task_comments for select to authenticated using(exists(select 1 from public.task_assignments a where a.task_id=public.task_comments.task_id and public.can_view_task_employee(public.task_comments.tenant_id,a.employee_id)));
create policy announcements_read on public.announcements for select to authenticated using(public.has_permission(tenant_id,'announcements.publish') or exists(select 1 from public.announcement_recipients r where r.announcement_id=public.announcements.id and r.user_id=auth.uid()));
create policy announcement_audiences_read on public.announcement_audiences for select to authenticated using(public.has_permission(tenant_id,'announcements.analytics'));
create policy announcement_recipients_read on public.announcement_recipients for select to authenticated using(user_id=auth.uid() or public.has_permission(tenant_id,'announcements.analytics'));
create policy announcement_attachments_read on public.announcement_attachments for select to authenticated using(public.has_permission(tenant_id,'announcements.publish') or exists(select 1 from public.announcement_recipients r where r.announcement_id=public.announcement_attachments.announcement_id and r.user_id=auth.uid()));

grant select on public.tasks,public.task_assignments,public.task_submissions,public.task_attachments,public.task_comments,public.announcements,public.announcement_audiences,public.announcement_recipients,public.announcement_attachments to authenticated;
grant all on public.tasks,public.task_assignments,public.task_submissions,public.task_attachments,public.task_comments,public.announcements,public.announcement_audiences,public.announcement_recipients,public.announcement_attachments to service_role;
revoke execute on function public.can_manage_task_employee(uuid,uuid),public.can_view_task_employee(uuid,uuid) from public,anon;
revoke execute on function public.create_operational_task(uuid,text,text,text,text,public.task_priority,timestamptz,timestamptz,boolean,public.task_recurrence,integer,date,public.task_audience_scope,uuid[]) from public,anon;
revoke execute on function public.start_task_assignment(uuid),public.submit_task_assignment(uuid,text,jsonb),public.review_task_assignment(uuid,boolean,text),public.add_task_comment(uuid,text),public.cancel_operational_task(uuid,text) from public,anon;
revoke execute on function public.create_announcement(uuid,text,text,text,text,public.announcement_priority,boolean,boolean,timestamptz,public.announcement_audience_scope,uuid[]),public.add_announcement_attachment(uuid,text,text,text,bigint),public.publish_announcement(uuid),public.mark_announcement_read(uuid,boolean),public.archive_announcement(uuid) from public,anon;
grant execute on function public.can_manage_task_employee(uuid,uuid),public.can_view_task_employee(uuid,uuid) to authenticated;
grant execute on function public.create_operational_task(uuid,text,text,text,text,public.task_priority,timestamptz,timestamptz,boolean,public.task_recurrence,integer,date,public.task_audience_scope,uuid[]) to authenticated;
grant execute on function public.start_task_assignment(uuid),public.submit_task_assignment(uuid,text,jsonb),public.review_task_assignment(uuid,boolean,text),public.add_task_comment(uuid,text),public.cancel_operational_task(uuid,text) to authenticated;
grant execute on function public.create_announcement(uuid,text,text,text,text,public.announcement_priority,boolean,boolean,timestamptz,public.announcement_audience_scope,uuid[]),public.add_announcement_attachment(uuid,text,text,text,bigint),public.publish_announcement(uuid),public.mark_announcement_read(uuid,boolean),public.archive_announcement(uuid) to authenticated;

revoke execute on function public.grant_collaboration_permissions_for_role(),public.validate_collaboration_links(),public.clone_next_task_occurrence(uuid) from public,anon,authenticated;
revoke insert,update,delete on public.tasks,public.task_assignments,public.task_submissions,public.task_attachments,public.task_comments,public.announcements,public.announcement_audiences,public.announcement_recipients,public.announcement_attachments from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('task-evidence','task-evidence',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),('announcement-files','announcement-files',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy task_evidence_insert on storage.objects for insert to authenticated with check(
  bucket_id='task-evidence' and exists(select 1 from public.task_assignments a where a.tenant_id::text=(storage.foldername(name))[1] and a.id::text=(storage.foldername(name))[2] and (a.employee_id=public.current_employee_id(a.tenant_id) or public.can_manage_task_employee(a.tenant_id,a.employee_id)))
);
create policy task_evidence_read on storage.objects for select to authenticated using(
  bucket_id='task-evidence' and exists(select 1 from public.task_assignments a where a.tenant_id::text=(storage.foldername(name))[1] and a.id::text=(storage.foldername(name))[2] and public.can_view_task_employee(a.tenant_id,a.employee_id))
);
create policy announcement_files_insert on storage.objects for insert to authenticated with check(
  bucket_id='announcement-files' and exists(select 1 from public.announcements a where a.tenant_id::text=(storage.foldername(name))[1] and a.id::text=(storage.foldername(name))[2] and a.status='draft' and public.has_permission(a.tenant_id,'announcements.publish'))
);
create policy announcement_files_read on storage.objects for select to authenticated using(
  bucket_id='announcement-files' and exists(select 1 from public.announcements a where a.tenant_id::text=(storage.foldername(name))[1] and a.id::text=(storage.foldername(name))[2] and (public.has_permission(a.tenant_id,'announcements.publish') or exists(select 1 from public.announcement_recipients r where r.announcement_id=a.id and r.user_id=auth.uid())))
);
