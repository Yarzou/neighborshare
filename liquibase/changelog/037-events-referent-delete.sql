--liquibase formatted sql

-- =============================================
-- 037 : suppression ET modification d'événement par un référent
--
-- Cas nominal inchangé : le créateur modifie et supprime ses événements.
-- En plus, un référent peut modifier et supprimer n'importe quel événement
-- (modération), y compris ses images dans le bucket `events`.
--
-- Rétrocompatibilité : élargissement de droits uniquement — l'ancien code
-- (suppression de ses propres événements depuis /profile) fonctionne à
-- l'identique. Le nouveau bouton côté UI vérifie qu'une ligne a bien été
-- supprimée et affiche une erreur sinon (cas base pas encore migrée).
-- Dépend de public.is_referent() (033).
-- =============================================

--changeset neighborshare:037-events-delete-referent
drop policy if exists "events_delete_own" on public.events;
create policy "events_delete"
    on public.events for delete
    using (auth.uid() = user_id or public.is_referent());
--rollback drop policy if exists "events_delete" on public.events;
--rollback create policy "events_delete_own" on public.events for delete using (auth.uid() = user_id);

--changeset neighborshare:037-events-update-referent
drop policy if exists "events_update_own" on public.events;
create policy "events_update"
    on public.events for update
    using (auth.uid() = user_id or public.is_referent());
--rollback drop policy if exists "events_update" on public.events;
--rollback create policy "events_update_own" on public.events for update using (auth.uid() = user_id);

--changeset neighborshare:037-events-storage-delete-referent splitStatements:false
drop policy if exists "events_storage_delete" on storage.objects;
create policy "events_storage_delete"
    on storage.objects for delete
    using (
      bucket_id = 'events'
      and (auth.uid()::text = (storage.foldername(name))[1] or public.is_referent())
    );
--rollback drop policy if exists "events_storage_delete" on storage.objects;
--rollback create policy "events_storage_delete" on storage.objects for delete using (bucket_id = 'events' and auth.uid()::text = (storage.foldername(name))[1]);

--changeset neighborshare:037-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
