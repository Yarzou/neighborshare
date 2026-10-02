--liquibase formatted sql

-- =============================================
-- 040 : documents du lotissement — assemblées générales et leurs fichiers
--
-- Modèle confirmé par l'utilisateur :
--   · une assemblée = ordre du jour + présentation + procès-verbal (PV) ;
--   · publication par les référents uniquement, lecture par tout compte connecté ;
--   · une fois le PV publié, l'ordre du jour et la présentation sont effacés
--     (fait côté client dans le flux de dépôt du PV) — seul le PV reste ;
--   · un fichier de chaque nature par assemblée : remplacer écrase ;
--   · la présentation garde en plus le PowerPoint d'origine (téléchargeable).
--
-- Le bucket `documents` est PRIVÉ, à la différence de `listings` et `events` :
-- un PV contient des noms, des votes et des chiffres. La lecture passe par des
-- URL signées (createSignedUrl), ce qui exige une policy SELECT pour le rôle
-- authenticated. La limite de 50 Mo est celle du plan gratuit Supabase.
--
-- Rétrocompatible : purement additif (phase expand). L'ancien code ignore ces
-- objets ; le nouveau affiche une page vide si la table manque encore.
-- Dépend de public.is_referent() (033).
-- =============================================

--changeset neighborshare:040-assemblies-table
create table if not exists public.assemblies (
    id         uuid primary key default gen_random_uuid(),
    title      text not null,
    held_on    date not null,
    -- `set null` et non `cascade` : la disparition du compte d'un référent ne
    -- doit pas emporter les archives officielles du lotissement.
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists assemblies_held_on_idx
    on public.assemblies (held_on desc);
--rollback drop table if exists public.assemblies;

--changeset neighborshare:040-assembly-documents-table
create table if not exists public.assembly_documents (
    id           uuid primary key default gen_random_uuid(),
    assembly_id  uuid not null references public.assemblies(id) on delete cascade,
    -- agenda = ordre du jour · presentation = diaporama (PDF) · minutes = PV
    kind         text not null check (kind in ('agenda', 'presentation', 'minutes')),
    -- Fichier consultable dans la visionneuse (PDF)
    file_path    text not null,
    file_name    text not null,
    file_size    bigint not null,
    mime_type    text not null,
    page_count   integer,
    -- PowerPoint d'origine, présentation uniquement (téléchargement seul)
    source_path  text,
    source_name  text,
    source_size  bigint,
    uploaded_by  uuid references public.profiles(id) on delete set null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    -- Un seul fichier de chaque nature par assemblée : remplacer = update
    unique (assembly_id, kind)
);

create index if not exists assembly_documents_assembly_idx
    on public.assembly_documents (assembly_id);
--rollback drop table if exists public.assembly_documents;

--changeset neighborshare:040-assemblies-rls
alter table public.assemblies enable row level security;

create policy "assemblies_select" on public.assemblies
    for select to authenticated using (true);

create policy "assemblies_insert" on public.assemblies
    for insert to authenticated
    with check (auth.uid() = created_by and public.is_referent());

create policy "assemblies_update" on public.assemblies
    for update to authenticated using (public.is_referent());

create policy "assemblies_delete" on public.assemblies
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "assemblies_delete" on public.assemblies;
--rollback drop policy if exists "assemblies_update" on public.assemblies;
--rollback drop policy if exists "assemblies_insert" on public.assemblies;
--rollback drop policy if exists "assemblies_select" on public.assemblies;

--changeset neighborshare:040-assembly-documents-rls
alter table public.assembly_documents enable row level security;

create policy "assembly_documents_select" on public.assembly_documents
    for select to authenticated using (true);

create policy "assembly_documents_insert" on public.assembly_documents
    for insert to authenticated
    with check (auth.uid() = uploaded_by and public.is_referent());

create policy "assembly_documents_update" on public.assembly_documents
    for update to authenticated using (public.is_referent());

create policy "assembly_documents_delete" on public.assembly_documents
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "assembly_documents_delete" on public.assembly_documents;
--rollback drop policy if exists "assembly_documents_update" on public.assembly_documents;
--rollback drop policy if exists "assembly_documents_insert" on public.assembly_documents;
--rollback drop policy if exists "assembly_documents_select" on public.assembly_documents;

--changeset neighborshare:040-storage-bucket-documents
-- Bucket privé : pas de getPublicUrl, lecture par URL signée uniquement.
-- 52428800 = 50 Mo, plafond par fichier du plan gratuit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'
  ]
)
on conflict (id) do nothing;
--rollback delete from storage.buckets where id = 'documents';

--changeset neighborshare:040-storage-documents-policies splitStatements:false
-- Lecture : tout compte connecté (nécessaire à createSignedUrl)
create policy "documents_storage_select"
    on storage.objects for select to authenticated
    using (bucket_id = 'documents');

-- Écriture : référents uniquement (dépôt, remplacement, suppression)
create policy "documents_storage_insert"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and public.is_referent());

create policy "documents_storage_update"
    on storage.objects for update to authenticated
    using (bucket_id = 'documents' and public.is_referent());

create policy "documents_storage_delete"
    on storage.objects for delete to authenticated
    using (bucket_id = 'documents' and public.is_referent());
--rollback drop policy if exists "documents_storage_delete" on storage.objects;
--rollback drop policy if exists "documents_storage_update" on storage.objects;
--rollback drop policy if exists "documents_storage_insert" on storage.objects;
--rollback drop policy if exists "documents_storage_select" on storage.objects;

--changeset neighborshare:040-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
