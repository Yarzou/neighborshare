--liquibase formatted sql

-- =============================================
-- 034 : carnet de prestataires recommandés
--
-- Ouvert à tous les voisins (ce n'est pas de l'information officielle mais un
-- retour d'expérience) : chacun ajoute et ne modifie que ses propres fiches.
-- =============================================

--changeset neighborshare:034-providers-table
create table if not exists public.providers (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references public.profiles(id) on delete cascade,
    name        text not null,
    trade       text not null,
    phone       text,
    email       text,
    website     text,
    comment     text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists providers_trade_idx on public.providers (trade);
--rollback drop table if exists public.providers;

--changeset neighborshare:034-providers-rls
alter table public.providers enable row level security;

create policy "providers_select" on public.providers
    for select to authenticated using (true);

create policy "providers_insert" on public.providers
    for insert to authenticated with check (auth.uid() = created_by);

create policy "providers_update" on public.providers
    for update to authenticated using (auth.uid() = created_by);

-- Un référent peut retirer une fiche inappropriée, sinon seul l'auteur
create policy "providers_delete" on public.providers
    for delete to authenticated
    using (auth.uid() = created_by or public.is_referent());
--rollback drop policy if exists "providers_delete" on public.providers;
--rollback drop policy if exists "providers_update" on public.providers;
--rollback drop policy if exists "providers_insert" on public.providers;
--rollback drop policy if exists "providers_select" on public.providers;

--changeset neighborshare:034-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
