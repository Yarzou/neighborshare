--liquibase formatted sql

-- =============================================
-- 032 : vue listings_geo — remplace le RPC listings_within_radius
--
-- Pourquoi : le RPC déclare un `RETURNS TABLE` exhaustif, qu'il faut étendre à
-- chaque nouvelle colonne de `listings`. C'est ce qui a fait oublier `price`
-- de la migration 014 à la 029 (badge prix invisible sur la carte), et qui a
-- imposé une migration de plus pour les champs livre. Une vue en `l.*` supprime
-- définitivement cette maintenance.
--
-- Le filtrage par rayon disparaît côté serveur : à l'échelle d'un lotissement
-- toutes les annonces tiennent dans une requête, et la distance n'était affichée
-- nulle part (seul le tri par proximité comptait — il est refait côté client via
-- `distanceMeters()` de lib/neighborhood.ts).
--
-- ⚠️ Le RPC est volontairement CONSERVÉ : le supprimer ici casserait la carte
-- pendant la fenêtre entre l'application de la migration et le déploiement du
-- code. Il devient inutilisé et pourra être retiré dans une migration ultérieure.
-- =============================================

-- security_invoker = true est INDISPENSABLE : sans lui, une vue s'exécute avec les
-- droits de son propriétaire et court-circuiterait le RLS de `listings` — ce qui
-- rouvrirait à `anon` les annonces que la migration 030 vient de fermer.
-- Requiert PostgreSQL 15+ ; sur une version antérieure la migration échoue sur une
-- erreur de syntaxe, ce qui est le comportement voulu (échec bruyant).
--changeset neighborshare:032-listings-geo-view splitStatements:false
create or replace view public.listings_geo
with (security_invoker = true) as
select
  l.*,
  st_y(l.location::geometry) as lat_out,
  st_x(l.location::geometry) as lng_out
from public.listings l
where l.expires_at is null or l.expires_at > now();
--rollback drop view if exists public.listings_geo;

--changeset neighborshare:032-grant-listings-geo
grant select on public.listings_geo to authenticated;
--rollback revoke select on public.listings_geo from authenticated;

--changeset neighborshare:032-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
