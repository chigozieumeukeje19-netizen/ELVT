-- ---------------------------------------------------------------------------
-- The photo bucket.
--
-- Private. Every read is a signed URL with a five minute expiry, minted on the
-- server from a path that came out of a row the caller was allowed to see.
-- These are photographs of a person's body, so nothing about them is public and
-- nothing about them is a stable link.
--
-- The path is <client_id>/week-<n>/<angle>-<timestamp>, and the policies key on
-- the first segment. That is what makes a caller unable to reach another
-- client's folder even holding a valid token: the client_id in the path has to
-- match the client_id in their own claims.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-photos',
  'client-photos',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A client writes into their own folder and nowhere else.
create policy client_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

create policy client_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-photos'
    and (
      (storage.foldername(name))[1] = public.current_client_id()::text
      or public.is_staff()
    )
  );

-- Replacing Monday's photo is normal. Deleting one is not something a client
-- does from the app, so there is no delete policy at all.
create policy client_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'client-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );
