-- Private mobile-attendance evidence used by the employee self-service clock.

create index if not exists attendance_punches_selfie_path_idx
  on public.attendance_punches(selfie_path)
  where selfie_path is not null;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-selfies',
  'attendance-selfies',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy attendance_selfies_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attendance-selfies'
  and exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.tenant_id::text = (storage.foldername(name))[1]
      and (
        public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2]
        or public.has_permission(m.tenant_id, 'attendance.manage')
      )
  )
);

create policy attendance_selfies_read
on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-selfies'
  and exists (
    select 1
    from public.attendance_punches p
    where p.selfie_path = name
      and public.can_view_attendance_employee(p.tenant_id, p.employee_id)
  )
);

create policy attendance_selfies_delete_orphan
on storage.objects for delete to authenticated
using (
  bucket_id = 'attendance-selfies'
  and exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.tenant_id::text = (storage.foldername(name))[1]
      and (
        public.has_permission(m.tenant_id, 'attendance.manage')
        or (
          public.current_employee_id(m.tenant_id)::text = (storage.foldername(name))[2]
          and not exists (
            select 1 from public.attendance_punches p where p.selfie_path = name
          )
        )
      )
  )
);
