--liquibase formatted sql

-- =============================================
-- 004 : Bucket Storage pour les images d'annonces
-- =============================================

--changeset neighborshare:004-storage-bucket-listings runOnChange:false
insert into storage.buckets (id, name, public)
values ('listings', 'listings', true)
on conflict (id) do nothing;

--changeset neighborshare:004-storage-policy-select splitStatements:false
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Images publiques'
  ) then
    execute 'create policy "Images publiques" on storage.objects
      for select using (bucket_id = ''listings'')';
  end if;
end;
$$;

--changeset neighborshare:004-storage-policy-insert splitStatements:false
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Upload authentifié'
  ) then
    execute 'create policy "Upload authentifié" on storage.objects
      for insert with check (bucket_id = ''listings'' and auth.role() = ''authenticated'')';
  end if;
end;
$$;

--changeset neighborshare:004-storage-policy-delete splitStatements:false
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Suppression propre'
  ) then
    execute 'create policy "Suppression propre" on storage.objects
      for delete using (bucket_id = ''listings'' and auth.uid()::text = (storage.foldername(name))[1])';
  end if;
end;
$$;
