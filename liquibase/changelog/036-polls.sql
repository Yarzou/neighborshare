--liquibase formatted sql

-- =============================================
-- 036 : sondages
--
-- Création réservée aux référents, choix unique, une voix par compte
-- (clé primaire (poll_id, user_id), donc changer d'avis = update).
--
-- « Résultats visibles après avoir voté » est appliqué EN BASE et pas seulement
-- dans l'interface : le RLS de `poll_votes` ne laisse lire que ses propres votes,
-- et les totaux passent par la fonction `poll_results()` qui refuse de répondre
-- à qui n'a pas voté. Sans ça, la règle serait cosmétique — l'API PostgREST
-- laisserait lire les votes un par un.
-- Effet de bord voulu : le vote n'est pas dépouillable nominativement via l'API.
-- =============================================

--changeset neighborshare:036-polls-tables
create table if not exists public.polls (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null references public.profiles(id) on delete cascade,
    question    text not null,
    description text,
    closes_at   date,
    created_at  timestamptz not null default now()
);

create table if not exists public.poll_options (
    id        uuid primary key default gen_random_uuid(),
    poll_id   uuid not null references public.polls(id) on delete cascade,
    label     text not null,
    position  integer not null default 0
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

create table if not exists public.poll_votes (
    poll_id    uuid not null references public.polls(id) on delete cascade,
    option_id  uuid not null references public.poll_options(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (poll_id, user_id)
);
--rollback drop table if exists public.poll_votes;
--rollback drop table if exists public.poll_options;
--rollback drop table if exists public.polls;

--changeset neighborshare:036-polls-rls
alter table public.polls enable row level security;

create policy "polls_select" on public.polls
    for select to authenticated using (true);

create policy "polls_insert" on public.polls
    for insert to authenticated
    with check (auth.uid() = created_by and public.is_referent());

create policy "polls_update" on public.polls
    for update to authenticated
    using (auth.uid() = created_by and public.is_referent());

create policy "polls_delete" on public.polls
    for delete to authenticated
    using (auth.uid() = created_by and public.is_referent());
--rollback drop policy if exists "polls_delete" on public.polls;
--rollback drop policy if exists "polls_update" on public.polls;
--rollback drop policy if exists "polls_insert" on public.polls;
--rollback drop policy if exists "polls_select" on public.polls;

--changeset neighborshare:036-poll-options-rls
alter table public.poll_options enable row level security;

create policy "poll_options_select" on public.poll_options
    for select to authenticated using (true);

-- Les options appartiennent au sondage : seul son auteur référent les gère
create policy "poll_options_insert" on public.poll_options
    for insert to authenticated
    with check (
      public.is_referent()
      and exists (select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid())
    );

create policy "poll_options_delete" on public.poll_options
    for delete to authenticated
    using (
      public.is_referent()
      and exists (select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid())
    );
--rollback drop policy if exists "poll_options_delete" on public.poll_options;
--rollback drop policy if exists "poll_options_insert" on public.poll_options;
--rollback drop policy if exists "poll_options_select" on public.poll_options;

--changeset neighborshare:036-poll-votes-rls
alter table public.poll_votes enable row level security;

-- On ne lit QUE son propre vote : les totaux passent par poll_results()
create policy "poll_votes_select_own" on public.poll_votes
    for select to authenticated using (user_id = auth.uid());

create policy "poll_votes_insert" on public.poll_votes
    for insert to authenticated with check (auth.uid() = user_id);

create policy "poll_votes_update" on public.poll_votes
    for update to authenticated using (auth.uid() = user_id);

create policy "poll_votes_delete" on public.poll_votes
    for delete to authenticated using (auth.uid() = user_id);
--rollback drop policy if exists "poll_votes_delete" on public.poll_votes;
--rollback drop policy if exists "poll_votes_update" on public.poll_votes;
--rollback drop policy if exists "poll_votes_insert" on public.poll_votes;
--rollback drop policy if exists "poll_votes_select_own" on public.poll_votes;

--changeset neighborshare:036-poll-results-function splitStatements:false
create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, label text, votes bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
        select 1 from public.poll_votes v
         where v.poll_id = p_poll_id and v.user_id = auth.uid()
     )
     and not exists (
        select 1 from public.polls p
         where p.id = p_poll_id
           and (
             (p.closes_at is not null and p.closes_at < current_date)  -- sondage clos
             or p.created_by = auth.uid()                              -- son auteur
           )
     )
  then
    raise exception 'Résultats visibles après avoir voté';
  end if;

  return query
    select o.id, o.label, count(v.user_id)
      from public.poll_options o
      left join public.poll_votes v on v.option_id = o.id
     where o.poll_id = p_poll_id
     group by o.id, o.label, o.position
     order by o.position;
end;
$$;
--rollback drop function if exists public.poll_results(uuid);

--changeset neighborshare:036-grant-poll-results
grant execute on function public.poll_results(uuid) to authenticated;
--rollback revoke execute on function public.poll_results(uuid) from authenticated;

--changeset neighborshare:036-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
