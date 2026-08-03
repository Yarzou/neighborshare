--liquibase formatted sql

-- =============================================
-- 038 : alignement des droits — le référent peut tout modifier et supprimer
--
-- Modèle cible confirmé par l'utilisateur :
--   · le créateur modifie et supprime SES contenus (prestataire, achat groupé) ;
--   · un référent modifie et supprime TOUT (y compris les informations du
--     lotissement et les sondages créés par un autre référent).
--
-- Avant : providers/group_purchases n'étaient modifiables que par leur créateur,
-- et announcements/polls exigeaient d'être À LA FOIS l'auteur ET référent — un
-- second référent ne pouvait donc rien gérer derrière le premier.
--
-- Rétrocompatible : élargissement de droits pur (fichier séparé : 033-036 sont
-- déjà appliquées, on ne retouche jamais un changeset appliqué).
-- =============================================

--changeset neighborshare:038-providers-update-referent
drop policy if exists "providers_update" on public.providers;
create policy "providers_update" on public.providers
    for update to authenticated
    using (auth.uid() = created_by or public.is_referent());
--rollback drop policy if exists "providers_update" on public.providers;
--rollback create policy "providers_update" on public.providers for update to authenticated using (auth.uid() = created_by);

--changeset neighborshare:038-group-purchases-update-referent
drop policy if exists "group_purchases_update" on public.group_purchases;
create policy "group_purchases_update" on public.group_purchases
    for update to authenticated
    using (auth.uid() = created_by or public.is_referent());
--rollback drop policy if exists "group_purchases_update" on public.group_purchases;
--rollback create policy "group_purchases_update" on public.group_purchases for update to authenticated using (auth.uid() = created_by);

--changeset neighborshare:038-announcements-referent
drop policy if exists "announcements_update" on public.announcements;
create policy "announcements_update" on public.announcements
    for update to authenticated using (public.is_referent());
drop policy if exists "announcements_delete" on public.announcements;
create policy "announcements_delete" on public.announcements
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "announcements_update" on public.announcements;
--rollback create policy "announcements_update" on public.announcements for update to authenticated using (auth.uid() = author_id and public.is_referent());
--rollback drop policy if exists "announcements_delete" on public.announcements;
--rollback create policy "announcements_delete" on public.announcements for delete to authenticated using (auth.uid() = author_id and public.is_referent());

--changeset neighborshare:038-polls-referent
drop policy if exists "polls_update" on public.polls;
create policy "polls_update" on public.polls
    for update to authenticated using (public.is_referent());
drop policy if exists "polls_delete" on public.polls;
create policy "polls_delete" on public.polls
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "polls_update" on public.polls;
--rollback create policy "polls_update" on public.polls for update to authenticated using (auth.uid() = created_by and public.is_referent());
--rollback drop policy if exists "polls_delete" on public.polls;
--rollback create policy "polls_delete" on public.polls for delete to authenticated using (auth.uid() = created_by and public.is_referent());

--changeset neighborshare:038-poll-options-referent
drop policy if exists "poll_options_insert" on public.poll_options;
create policy "poll_options_insert" on public.poll_options
    for insert to authenticated with check (public.is_referent());
drop policy if exists "poll_options_delete" on public.poll_options;
create policy "poll_options_delete" on public.poll_options
    for delete to authenticated using (public.is_referent());
--rollback drop policy if exists "poll_options_insert" on public.poll_options;
--rollback create policy "poll_options_insert" on public.poll_options for insert to authenticated with check (public.is_referent() and exists (select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid()));
--rollback drop policy if exists "poll_options_delete" on public.poll_options;
--rollback create policy "poll_options_delete" on public.poll_options for delete to authenticated using (public.is_referent() and exists (select 1 from public.polls p where p.id = poll_id and p.created_by = auth.uid()));

--changeset neighborshare:038-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
