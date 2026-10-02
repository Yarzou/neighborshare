--liquibase formatted sql

-- =============================================
-- 041 : documents permanents de l'ASL (statuts, règlement…)
--
-- Les documents de la 040 sont rattachés à une assemblée générale. Les statuts
-- de l'ASL n'en dépendent pas : un seul fichier de chaque nature, remplacé au
-- fil des mises à jour (pas de versions, règle confirmée pour la 040).
--
-- Même bucket privé `documents` (policies Storage de la 040 inchangées), chemin
-- `asl/{kind}-{timestamp}.pdf`. Même modèle de droits : lecture par tout compte
-- connecté, écriture par les référents.
--
-- Rétrocompatible : purement additif (phase expand). Dépend de public.is_referent() (033).
-- =============================================

--changeset neighborshare:041-asl-documents-table
create table if not exists public.asl_documents (
    id          uuid primary key default gen_random_uuid(),
    -- statuts = statuts de l'ASL · reglement = règlement intérieur · autre
    kind        text not null check (kind in ('statuts', 'reglement', 'autre')),
    title       text not null,
    file_path   text not null,
    file_name   text not null,
    file_size   bigint not null,
    mime_type   text not null,
    page_count  integer,
    uploaded_by uuid references public.profiles(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    -- Un seul fichier de chaque nature : remplacer = update
    unique (kind)
);
--rollback drop table if exists public.asl_documents;

--changeset neighborshare:041-asl-documents-rls
alter table public.asl_documents enable row level security;

create policy "asl_documents_select" on public.asl_documents
    for select to authenticated using (true);

create policy "asl_documents_insert" on public.asl_documents
    for insert to authenticated
    with check (auth.uid() = uploaded_by and public.is_referent());

create policy "asl_documents_update" on public.asl_documents
    for update to authenticated using (public.is_referent());

create policy "asl_documents_delete" on public.asl_documents
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "asl_documents_delete" on public.asl_documents;
--rollback drop policy if exists "asl_documents_update" on public.asl_documents;
--rollback drop policy if exists "asl_documents_insert" on public.asl_documents;
--rollback drop policy if exists "asl_documents_select" on public.asl_documents;

--changeset neighborshare:041-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
