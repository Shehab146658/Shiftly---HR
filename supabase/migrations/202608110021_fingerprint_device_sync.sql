-- Fingerprint attendance: tenant-scoped device registry, idempotent file imports,
-- row reconciliation, and a replaceable adapter boundary for future live sync.

create table public.attendance_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9_-]{2,40}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  provider text not null default 'generic' check (length(trim(provider)) between 2 and 80),
  model text check (model is null or length(trim(model)) between 1 and 100),
  serial_number text check (serial_number is null or length(trim(serial_number)) between 1 and 120),
  connection_mode text not null default 'file' check (connection_mode in ('file','api','database','sdk')),
  timezone text not null default 'Africa/Cairo',
  status text not null default 'active' check (status in ('active','inactive','error')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create unique index attendance_devices_serial_unique
  on public.attendance_devices(tenant_id, lower(serial_number))
  where serial_number is not null;
create index attendance_devices_tenant_status_idx on public.attendance_devices(tenant_id, status, name);

alter table public.attendance_punches
  add column attendance_device_id uuid references public.attendance_devices(id) on delete set null;
create index attendance_punches_device_idx on public.attendance_punches(attendance_device_id, occurred_at desc)
  where attendance_device_id is not null;

create table public.attendance_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id uuid not null references public.attendance_devices(id) on delete restrict,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed')),
  row_count integer not null default 0 check (row_count between 0 and 10000),
  imported_count integer not null default 0 check (imported_count between 0 and row_count),
  duplicate_count integer not null default 0 check (duplicate_count between 0 and row_count),
  error_count integer not null default 0 check (error_count between 0 and row_count),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  error_summary text,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, device_id, file_sha256),
  check (imported_count + duplicate_count + error_count <= row_count)
);

create index attendance_import_batches_tenant_idx
  on public.attendance_import_batches(tenant_id, started_at desc);

create table public.attendance_import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null references public.attendance_import_batches(id) on delete cascade,
  row_number integer not null check (row_number between 2 and 10001),
  employee_number text,
  occurred_at_text text,
  punch_type_text text,
  branch_code text,
  external_reference text,
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data) = 'object'),
  status text not null check (status in ('imported','duplicate','error')),
  punch_id uuid references public.attendance_punches(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number),
  check ((status = 'error' and error_message is not null) or status <> 'error')
);

create index attendance_import_rows_batch_status_idx
  on public.attendance_import_rows(batch_id, status, row_number);

create or replace function public.validate_attendance_device_links()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.branch_id is not null and not exists(
    select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Attendance device branch must belong to the same company';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'Attendance device timezone is invalid';
  end if;
  new.code := upper(trim(new.code));
  new.name := trim(new.name);
  new.provider := lower(trim(new.provider));
  new.model := nullif(trim(coalesce(new.model,'')), '');
  new.serial_number := nullif(trim(coalesce(new.serial_number,'')), '');
  return new;
end;
$$;

create or replace function public.validate_attendance_import_batch_links()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(
    select 1 from public.attendance_devices d where d.id = new.device_id and d.tenant_id = new.tenant_id
  ) then
    raise exception 'Attendance import device must belong to the same company';
  end if;
  return new;
end;
$$;

create or replace function public.validate_attendance_import_row_links()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(
    select 1 from public.attendance_import_batches b where b.id = new.batch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Attendance import row batch must belong to the same company';
  end if;
  if new.punch_id is not null and not exists(
    select 1 from public.attendance_punches p where p.id = new.punch_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'Attendance import punch must belong to the same company';
  end if;
  return new;
end;
$$;

create or replace function public.validate_attendance_punch_device_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.attendance_device_id is not null and not exists(
    select 1 from public.attendance_devices d where d.id = new.attendance_device_id and d.tenant_id = new.tenant_id
  ) then
    raise exception 'Attendance punch device must belong to the same company';
  end if;
  return new;
end;
$$;

create trigger attendance_devices_validate before insert or update on public.attendance_devices
for each row execute function public.validate_attendance_device_links();
create trigger attendance_devices_updated_at before update on public.attendance_devices
for each row execute function public.set_updated_at();
create trigger attendance_import_batches_validate before insert or update on public.attendance_import_batches
for each row execute function public.validate_attendance_import_batch_links();
create trigger attendance_import_batches_updated_at before update on public.attendance_import_batches
for each row execute function public.set_updated_at();
create trigger attendance_import_rows_validate before insert or update on public.attendance_import_rows
for each row execute function public.validate_attendance_import_row_links();
create trigger attendance_punch_device_validate before insert or update on public.attendance_punches
for each row execute function public.validate_attendance_punch_device_link();

create or replace function public.create_attendance_device(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_code text,
  p_name text,
  p_provider text,
  p_model text,
  p_serial_number text,
  p_connection_mode text,
  p_timezone text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_permission(p_tenant_id,'attendance.manage') then
    raise exception 'Not authorized to configure attendance devices';
  end if;
  if coalesce(length(trim(p_name)),0) < 2 then raise exception 'Device name is required'; end if;
  if upper(trim(coalesce(p_code,''))) !~ '^[A-Z0-9_-]{2,40}$' then raise exception 'Device code must use letters, numbers, dash, or underscore'; end if;
  if coalesce(p_connection_mode,'') not in ('file','api','database','sdk') then raise exception 'Unsupported attendance connection mode'; end if;
  insert into public.attendance_devices(
    tenant_id,branch_id,code,name,provider,model,serial_number,connection_mode,timezone,created_by
  ) values (
    p_tenant_id,p_branch_id,upper(trim(p_code)),trim(p_name),coalesce(nullif(trim(p_provider),''),'generic'),
    nullif(trim(coalesce(p_model,'')),''),nullif(trim(coalesce(p_serial_number,'')),''),p_connection_mode,p_timezone,auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.set_attendance_device_status(p_device_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_device public.attendance_devices%rowtype;
begin
  select * into v_device from public.attendance_devices where id = p_device_id for update;
  if v_device.id is null then raise exception 'Attendance device not found'; end if;
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_permission(v_device.tenant_id,'attendance.manage') then
    raise exception 'Not authorized to configure attendance devices';
  end if;
  if p_status not in ('active','inactive') then raise exception 'Device status must be active or inactive'; end if;
  update public.attendance_devices set status = p_status,last_error = case when p_status='active' then null else last_error end where id = p_device_id;
end;
$$;

create or replace function public.import_fingerprint_punches(
  p_device_id uuid,
  p_file_name text,
  p_file_sha256 text,
  p_rows jsonb,
  p_mapping jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_device public.attendance_devices%rowtype;
  v_batch_id uuid;
  v_existing_batch uuid;
  v_item record;
  v_row jsonb;
  v_row_number integer;
  v_employee public.employees%rowtype;
  v_branch public.branches%rowtype;
  v_employee_number text;
  v_timestamp_text text;
  v_punch_type text;
  v_branch_code text;
  v_external_reference text;
  v_occurred_at timestamptz;
  v_work_date date;
  v_punch_id uuid;
  v_imported integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_row_count integer;
begin
  select * into v_device from public.attendance_devices where id = p_device_id for update;
  if v_device.id is null then raise exception 'Attendance device not found'; end if;
  if v_device.status <> 'active' then raise exception 'Attendance device is not active'; end if;
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_permission(v_device.tenant_id,'attendance.manage') then
    raise exception 'Not authorized to import attendance';
  end if;
  if coalesce(length(trim(p_file_name)),0) < 1 or length(trim(p_file_name)) > 255 then raise exception 'Attendance file name is invalid'; end if;
  if lower(trim(coalesce(p_file_sha256,''))) !~ '^[a-f0-9]{64}$' then raise exception 'Attendance file checksum is invalid'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Attendance rows must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 then raise exception 'Attendance file contains no data rows'; end if;
  if v_row_count > 10000 then raise exception 'Attendance import is limited to 10,000 rows'; end if;
  if jsonb_typeof(coalesce(p_mapping,'{}'::jsonb)) <> 'object' then raise exception 'Attendance import mapping must be an object'; end if;

  select id into v_existing_batch from public.attendance_import_batches
  where tenant_id=v_device.tenant_id and device_id=v_device.id and file_sha256=lower(trim(p_file_sha256));
  if v_existing_batch is not null then return v_existing_batch; end if;

  insert into public.attendance_import_batches(
    tenant_id,device_id,file_name,file_sha256,row_count,mapping,started_by
  ) values (
    v_device.tenant_id,v_device.id,trim(p_file_name),lower(trim(p_file_sha256)),v_row_count,coalesce(p_mapping,'{}'::jsonb),auth.uid()
  ) returning id into v_batch_id;

  for v_item in select source.value,source.ordinality from jsonb_array_elements(p_rows) with ordinality as source(value,ordinality)
  loop
    v_row := v_item.value;
    v_row_number := v_item.ordinality::integer + 1;
    v_employee_number := nullif(trim(coalesce(v_row->>'employee_number','')), '');
    v_timestamp_text := nullif(trim(coalesce(v_row->>'occurred_at','')), '');
    v_punch_type := lower(trim(coalesce(v_row->>'punch_type','')));
    v_branch_code := nullif(upper(trim(coalesce(v_row->>'branch_code',''))), '');
    v_external_reference := nullif(trim(coalesce(v_row->>'external_reference','')), '');
    v_punch_id := null;
    begin
      if jsonb_typeof(v_row) <> 'object' then raise exception 'Row must be an object'; end if;
      if v_employee_number is null then raise exception 'Employee number is required'; end if;
      if v_timestamp_text is null then raise exception 'Attendance date/time is required'; end if;
      if v_punch_type not in ('check_in','check_out') then raise exception 'Punch type must map to check_in or check_out'; end if;

      select * into v_employee from public.employees e
      where e.tenant_id=v_device.tenant_id and lower(e.employee_code)=lower(v_employee_number) and e.status <> 'terminated'
      limit 1;
      if v_employee.id is null then raise exception 'Employee number % was not found',v_employee_number; end if;

      v_branch := null;
      if v_branch_code is not null then
        select * into v_branch from public.branches b
        where b.tenant_id=v_device.tenant_id and upper(b.code)=v_branch_code and b.is_active=true limit 1;
        if v_branch.id is null then raise exception 'Branch code % was not found',v_branch_code; end if;
      elsif v_device.branch_id is not null then
        select * into v_branch from public.branches b where b.id=v_device.branch_id;
      elsif v_employee.branch_id is not null then
        select * into v_branch from public.branches b where b.id=v_employee.branch_id;
      end if;

      if v_timestamp_text ~* '(Z|[+-][0-9]{2}([:]?[0-9]{2})?)$' then
        v_occurred_at := v_timestamp_text::timestamptz;
      else
        v_occurred_at := v_timestamp_text::timestamp at time zone v_device.timezone;
      end if;
      v_work_date := (
        (v_occurred_at at time zone v_device.timezone)
        - (coalesce(extract(epoch from v_branch.operational_day_start),21600) * interval '1 second')
      )::date;
      v_external_reference := coalesce(v_external_reference,v_device.id::text || ':' || lower(trim(p_file_sha256)) || ':' || v_row_number::text);

      select p.id into v_punch_id from public.attendance_punches p
      where p.tenant_id=v_device.tenant_id and p.source='fingerprint' and p.external_reference=v_external_reference;
      if v_punch_id is not null then
        v_duplicates := v_duplicates + 1;
        insert into public.attendance_import_rows(
          tenant_id,batch_id,row_number,employee_number,occurred_at_text,punch_type_text,branch_code,external_reference,raw_data,status,punch_id
        ) values (
          v_device.tenant_id,v_batch_id,v_row_number,v_employee_number,v_timestamp_text,v_punch_type,v_branch_code,v_external_reference,v_row,'duplicate',v_punch_id
        );
        continue;
      end if;

      begin
        insert into public.attendance_punches(
          tenant_id,employee_id,branch_id,work_date,punch_type,occurred_at,source,validation_status,
          external_reference,device_identifier,attendance_device_id,notes,created_by
        ) values (
          v_device.tenant_id,v_employee.id,v_branch.id,v_work_date,v_punch_type::public.attendance_punch_type,v_occurred_at,
          'fingerprint','valid',v_external_reference,v_device.code,v_device.id,'Fingerprint import: ' || trim(p_file_name),auth.uid()
        ) returning id into v_punch_id;
      exception when unique_violation then
        select p.id into v_punch_id from public.attendance_punches p
        where p.tenant_id=v_device.tenant_id and p.employee_id=v_employee.id
          and p.punch_type=v_punch_type::public.attendance_punch_type and p.occurred_at=v_occurred_at limit 1;
      end;

      if v_punch_id is null then raise exception 'Duplicate punch could not be reconciled'; end if;
      if exists(select 1 from public.attendance_punches p where p.id=v_punch_id and p.external_reference=v_external_reference) then
        v_imported := v_imported + 1;
        insert into public.attendance_import_rows(
          tenant_id,batch_id,row_number,employee_number,occurred_at_text,punch_type_text,branch_code,external_reference,raw_data,status,punch_id
        ) values (
          v_device.tenant_id,v_batch_id,v_row_number,v_employee_number,v_timestamp_text,v_punch_type,v_branch_code,v_external_reference,v_row,'imported',v_punch_id
        );
      else
        v_duplicates := v_duplicates + 1;
        insert into public.attendance_import_rows(
          tenant_id,batch_id,row_number,employee_number,occurred_at_text,punch_type_text,branch_code,external_reference,raw_data,status,punch_id
        ) values (
          v_device.tenant_id,v_batch_id,v_row_number,v_employee_number,v_timestamp_text,v_punch_type,v_branch_code,v_external_reference,v_row,'duplicate',v_punch_id
        );
      end if;
    exception when others then
      v_errors := v_errors + 1;
      insert into public.attendance_import_rows(
        tenant_id,batch_id,row_number,employee_number,occurred_at_text,punch_type_text,branch_code,external_reference,raw_data,status,error_message
      ) values (
        v_device.tenant_id,v_batch_id,v_row_number,v_employee_number,v_timestamp_text,v_punch_type,v_branch_code,v_external_reference,
        case when jsonb_typeof(v_row)='object' then v_row else jsonb_build_object('value',v_row) end,'error',left(sqlerrm,1000)
      );
    end;
  end loop;

  update public.attendance_import_batches set
    status=case when v_errors>0 then 'completed_with_errors' else 'completed' end,
    imported_count=v_imported,duplicate_count=v_duplicates,error_count=v_errors,finished_at=now(),
    error_summary=case when v_errors>0 then v_errors::text || ' of ' || v_row_count::text || ' rows require correction' else null end
  where id=v_batch_id;
  update public.attendance_devices set
    last_synced_at=now(),
    status=case when v_imported=0 and v_errors=v_row_count then 'error' else status end,
    last_error=case when v_errors>0 then v_errors::text || ' rows failed in ' || trim(p_file_name) else null end
  where id=v_device.id;
  return v_batch_id;
end;
$$;

create trigger audit_attendance_devices after insert or update or delete on public.attendance_devices
for each row execute function public.capture_audit_log();
create trigger audit_attendance_import_batches after insert or update or delete on public.attendance_import_batches
for each row execute function public.capture_audit_log();

alter table public.attendance_devices enable row level security;
alter table public.attendance_import_batches enable row level security;
alter table public.attendance_import_rows enable row level security;

create policy attendance_devices_read on public.attendance_devices for select to authenticated using(
  public.has_permission(tenant_id,'attendance.manage')
  or public.has_permission(tenant_id,'attendance.reports')
  or public.has_permission(tenant_id,'attendance.read_all')
);
create policy attendance_import_batches_read on public.attendance_import_batches for select to authenticated using(
  public.has_permission(tenant_id,'attendance.manage')
  or public.has_permission(tenant_id,'attendance.reports')
  or public.has_permission(tenant_id,'attendance.read_all')
);
create policy attendance_import_rows_read on public.attendance_import_rows for select to authenticated using(
  public.has_permission(tenant_id,'attendance.manage')
  or public.has_permission(tenant_id,'attendance.reports')
  or public.has_permission(tenant_id,'attendance.read_all')
);

grant select on public.attendance_devices,public.attendance_import_batches,public.attendance_import_rows to authenticated;
grant all on public.attendance_devices,public.attendance_import_batches,public.attendance_import_rows to service_role;
grant execute on function public.create_attendance_device(uuid,uuid,text,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.set_attendance_device_status(uuid,text) to authenticated,service_role;
grant execute on function public.import_fingerprint_punches(uuid,text,text,jsonb,jsonb) to authenticated,service_role;

revoke insert,update,delete on public.attendance_devices,public.attendance_import_batches,public.attendance_import_rows from anon,authenticated;
revoke execute on function public.create_attendance_device(uuid,uuid,text,text,text,text,text,text,text),public.set_attendance_device_status(uuid,text),public.import_fingerprint_punches(uuid,text,text,jsonb,jsonb) from public,anon;
revoke execute on function public.validate_attendance_device_links(),public.validate_attendance_import_batch_links(),public.validate_attendance_import_row_links(),public.validate_attendance_punch_device_link() from public,anon,authenticated;
