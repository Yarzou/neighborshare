--liquibase formatted sql

-- =============================================
-- 030 : fermeture de la lecture aux comptes authentifiés
--
-- Avant : profiles / listings / events étaient en `using (true)`, donc lisibles
-- par le rôle `anon`. La clé anon étant publique par conception (embarquée dans
-- le bundle JS), les adresses et coordonnées de tous les foyers étaient
-- accessibles sans compte.
--
-- Les policies sont recréées avec `to authenticated` plutôt que
-- `using (auth.role() = 'authenticated')` : comportement identique, mais le rôle
-- est évalué une fois par requête au lieu d'une fois par ligne, et cela ne
-- dépend pas de `auth.role()` que Supabase déconseille désormais.
--
-- ⚠️ `categories` reste volontairement en lecture publique : /api/keepalive
-- l'interroge avec la clé anon, et sans ça le ping anti-mise-en-pause casse.
-- =============================================

--changeset neighborshare:030-profiles-select-authenticated
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

--changeset neighborshare:030-listings-select-authenticated
drop policy if exists "listings_select" on public.listings;
create policy "listings_select" on public.listings
  for select to authenticated using (true);

--changeset neighborshare:030-events-select-authenticated
drop policy if exists "events_select_all" on public.events;
create policy "events_select_all" on public.events
  for select to authenticated using (true);

-- Le RPC est en LANGUAGE sql STABLE (pas SECURITY DEFINER) : il respecte donc
-- déjà le RLS de listings et renverrait 0 ligne à un anonyme. On retire quand
-- même le droit d'exécution, par défense en profondeur.
--changeset neighborshare:030-revoke-rpc-from-anon
revoke execute on function listings_within_radius(float, float, float) from anon;

--changeset neighborshare:030-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
