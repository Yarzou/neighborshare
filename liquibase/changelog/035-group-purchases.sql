--liquibase formatted sql

-- =============================================
-- 035 : achats groupés
--
-- Modèle « quantité + seuil » : le créateur définit une unité libre (litres,
-- stères, kg…) et un objectif, chaque foyer indique la quantité qu'il souhaite.
-- La clé primaire composite (purchase_id, user_id) garantit une participation
-- unique par compte, modifiable.
-- =============================================

--changeset neighborshare:035-group-purchases-table
create table if not exists public.group_purchases (
    id              uuid primary key default gen_random_uuid(),
    created_by      uuid not null references public.profiles(id) on delete cascade,
    title           text not null,
    description     text,
    unit            text not null,
    target_quantity numeric(12,2),
    unit_price      numeric(10,2),
    deadline        date,
    status          text not null default 'ouvert',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists group_purchases_created_at_idx
    on public.group_purchases (created_at desc);
--rollback drop table if exists public.group_purchases;

--changeset neighborshare:035-group-purchase-participants-table
create table if not exists public.group_purchase_participants (
    purchase_id uuid not null references public.group_purchases(id) on delete cascade,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    quantity    numeric(12,2) not null check (quantity > 0),
    comment     text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    primary key (purchase_id, user_id)
);
--rollback drop table if exists public.group_purchase_participants;

--changeset neighborshare:035-group-purchases-rls
alter table public.group_purchases enable row level security;

create policy "group_purchases_select" on public.group_purchases
    for select to authenticated using (true);

create policy "group_purchases_insert" on public.group_purchases
    for insert to authenticated with check (auth.uid() = created_by);

create policy "group_purchases_update" on public.group_purchases
    for update to authenticated using (auth.uid() = created_by);

create policy "group_purchases_delete" on public.group_purchases
    for delete to authenticated
    using (auth.uid() = created_by or public.is_referent());
--rollback drop policy if exists "group_purchases_delete" on public.group_purchases;
--rollback drop policy if exists "group_purchases_update" on public.group_purchases;
--rollback drop policy if exists "group_purchases_insert" on public.group_purchases;
--rollback drop policy if exists "group_purchases_select" on public.group_purchases;

--changeset neighborshare:035-participants-rls
alter table public.group_purchase_participants enable row level security;

-- Les participations sont visibles de tous : le total et la liste des foyers
-- engagés sont l'intérêt même d'un achat groupé.
create policy "gpp_select" on public.group_purchase_participants
    for select to authenticated using (true);

create policy "gpp_insert" on public.group_purchase_participants
    for insert to authenticated with check (auth.uid() = user_id);

create policy "gpp_update" on public.group_purchase_participants
    for update to authenticated using (auth.uid() = user_id);

create policy "gpp_delete" on public.group_purchase_participants
    for delete to authenticated using (auth.uid() = user_id);
--rollback drop policy if exists "gpp_delete" on public.group_purchase_participants;
--rollback drop policy if exists "gpp_update" on public.group_purchase_participants;
--rollback drop policy if exists "gpp_insert" on public.group_purchase_participants;
--rollback drop policy if exists "gpp_select" on public.group_purchase_participants;

--changeset neighborshare:035-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
