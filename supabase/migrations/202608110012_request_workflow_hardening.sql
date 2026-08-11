-- Production follow-up for installations where migration 011 was applied before single-time request hardening.

do $$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.hr_requests'::regclass
    and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid) ilike '%start_time%null%end_time%null%'
  limit 1;
  if v_constraint is not null then
    execute format('alter table public.hr_requests drop constraint %I', v_constraint);
  end if;
end;
$$;

drop policy if exists request_documents_delete on storage.objects;
create policy request_documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'request-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'active' and m.tenant_id::text = (storage.foldername(name))[1]
      and (public.has_permission(m.tenant_id, 'requests.manage') or public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2])
  )
);
