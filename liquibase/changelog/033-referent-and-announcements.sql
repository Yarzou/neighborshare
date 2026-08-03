--liquibase formatted sql

-- =============================================
-- 033 : rôle référent + canal officiel de l'ASL
--
-- `is_referent` est un RÔLE, pas un contrôle d'accès à l'inscription : celle-ci
-- reste ouverte (choix assumé, cf. 030). Le flag sert uniquement à autoriser la
-- publication d'informations officielles et, plus tard, des sondages.
-- =============================================

--changeset neighborshare:033-profiles-is-referent
alter table public.profiles
  add column if not exists is_referent boolean not null default false;
--rollback alter table public.profiles drop column if exists is_referent;

-- Helper réutilisé par les policies de `announcements` et `polls`.
-- SECURITY DEFINER pour rester lisible même si le RLS de `profiles` évolue.
--changeset neighborshare:033-is-referent-function splitStatements:false
create or replace function public.is_referent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_referent from public.profiles p where p.id = auth.uid()), false)
$$;
--rollback drop function if exists public.is_referent();

--changeset neighborshare:033-grant-is-referent
grant execute on function public.is_referent() to authenticated;
--rollback revoke execute on function public.is_referent() from authenticated;

--changeset neighborshare:033-announcements-table
create table if not exists public.announcements (
    id         uuid primary key default gen_random_uuid(),
    author_id  uuid not null references public.profiles(id) on delete cascade,
    title      text not null,
    body       text not null,
    is_pinned  boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists announcements_created_at_idx
    on public.announcements (created_at desc);
--rollback drop table if exists public.announcements;

--changeset neighborshare:033-announcements-rls
alter table public.announcements enable row level security;

-- Lecture : tous les comptes authentifiés (même règle que listings/events en 030)
create policy "announcements_select" on public.announcements
    for select to authenticated using (true);

-- Écriture : référents uniquement, et seulement en leur nom
create policy "announcements_insert" on public.announcements
    for insert to authenticated
    with check (auth.uid() = author_id and public.is_referent());

create policy "announcements_update" on public.announcements
    for update to authenticated
    using (auth.uid() = author_id and public.is_referent());

create policy "announcements_delete" on public.announcements
    for delete to authenticated
    using (auth.uid() = author_id and public.is_referent());
--rollback drop policy if exists "announcements_delete" on public.announcements;
--rollback drop policy if exists "announcements_update" on public.announcements;
--rollback drop policy if exists "announcements_insert" on public.announcements;
--rollback drop policy if exists "announcements_select" on public.announcements;

--changeset neighborshare:033-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
