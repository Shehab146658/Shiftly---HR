begin;
select plan(7);

select is(
  (select public from storage.buckets where id = 'attendance-selfies'),
  false,
  'attendance selfie evidence is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'attendance-selfies'),
  8388608::bigint,
  'attendance selfie uploads are limited to eight megabytes'
);
select ok(
  (select 'image/heic' = any(allowed_mime_types) from storage.buckets where id = 'attendance-selfies'),
  'modern mobile camera images are accepted'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attendance_selfies_insert'),
  1,
  'employee selfie upload policy exists'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attendance_selfies_read'),
  1,
  'attendance evidence read policy exists'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'attendance_selfies_delete_orphan'),
  1,
  'failed uploads can be cleaned up without deleting linked evidence'
);
select has_index(
  'public',
  'attendance_punches',
  'attendance_punches_selfie_path_idx',
  'attendance selfie paths are indexed for protected evidence reads'
);

select * from finish();
rollback;
