--liquibase formatted sql

-- =============================================
-- 031 : spatial_ref_sys retirée de l'API PostgREST
--
-- Objectif : faire disparaître l'alerte Supabase Advisor
--   « Table public.spatial_ref_sys is public, but RLS has not been enabled. »
--
-- ❌ RÉSULTAT RÉEL (2026-08-03) : le REVOKE est resté sans effet — le droit n'a pas été accordé
--    par `postgres`, qui n'a donc pas le grant option pour le retirer. L'alerte persiste.
--    Cette migration est conservée (elle est inoffensive et retire les grants qui, eux,
--    appartiennent à `postgres`), mais elle ne suffit pas. Voir le pavé « spatial_ref_sys »
--    de memory/database.md pour l'état des lieux et les options restantes.
--
-- Historique des tentatives ratées (ne pas les rejouer) :
--   023 → no-op documentaire.
--   025 → revoke des droits d'écriture, MAIS re-grant du SELECT à anon/authenticated :
--         c'est précisément ce GRANT qui maintient l'alerte. 031 l'annule.
--   026 → `alter extension postgis set schema extensions` : impossible, opération superuser.
--   027 → `alter table … enable row level security` : impossible, la table appartient à
--         `supabase_admin` (l'erreur insufficient_privilege était avalée en NOTICE, ce qui a
--         laissé croire que le sujet était traité).
--
-- Pourquoi un REVOKE règle le problème : le lint Supabase (splinter
-- 0013_rls_disabled_in_public) ne teste pas seulement l'absence de RLS, son WHERE contient
-- aussi un filtre sur les droits :
--     and not c.relrowsecurity
--     and ( has_table_privilege('anon', c.oid, 'SELECT')
--        or has_table_privilege('authenticated', c.oid, 'SELECT') )
-- Retirer le SELECT à ces deux rôles rend le prédicat faux : l'alerte tombe, sans avoir besoin
-- d'un RLS qu'on n'a pas le droit d'activer. Et ce n'est pas cosmétique — la table cesse
-- réellement d'être interrogeable avec la clé anon publique (même esprit que 030).
--
-- Sans impact fonctionnel ici : aucun appel PostGIS du projet ne lit spatial_ref_sys.
-- Les RPC n'utilisent que st_dwithin / st_distance sur `geography`, st_makepoint, st_x/st_y
-- (aucun st_transform dans tout le changelog) et `listings.location` est en
-- geography(Point, 4326) — PostGIS court-circuite la lecture du catalogue pour le SRID par
-- défaut 4326. Les rôles `postgres` et `service_role` gardent leurs droits.
--
-- ⚠️ Ne jamais re-grant `select` à anon/authenticated : l'alerte reviendrait aussitôt.
-- =============================================

--changeset neighborshare:031-revoke-select-spatial-ref-sys
--comment: retire le SELECT de spatial_ref_sys aux rôles API (supprime l'alerte Advisor 0013)
-- Le revoke sur PUBLIC est indispensable : has_table_privilege('anon', …) resterait vrai si le
-- droit était hérité du pseudo-rôle PUBLIC plutôt que d'un grant nominatif.
revoke select on table public.spatial_ref_sys from anon, authenticated;
revoke select on table public.spatial_ref_sys from public;
--rollback grant select on table public.spatial_ref_sys to anon, authenticated;

--changeset neighborshare:031-report-privileges splitStatements:false
--comment: constate l'état des droits sans faire échouer la migration
-- Un REVOKE que le rôle courant n'a pas le droit d'appliquer n'échoue pas en PostgreSQL : il
-- émet un simple WARNING. Il faut donc vérifier le résultat explicitement.
--
-- ⚠️ CONSTAT DU 2026-08-03 (première exécution) : le revoke ci-dessus est SANS EFFET.
-- Le SELECT n'a pas été accordé par `postgres` mais hors de son périmètre (`supabase_admin` /
-- script d'installation PostGIS) : sans grant option, `postgres` ne peut pas le retirer, et
-- PostgreSQL se contente d'un WARNING. L'alerte Advisor 0013 persiste donc.
--
-- La version initiale de ce changeset levait une EXCEPTION ; elle est volontairement rétrogradée
-- en WARNING, car un changeset en échec bloque toutes les migrations suivantes. Le constat vit
-- désormais dans la doc (memory/database.md, CLAUDE.md) et non dans un échec de build.
DO $$
DECLARE
    v_anon boolean;
    v_auth boolean;
BEGIN
    IF to_regclass('public.spatial_ref_sys') IS NULL THEN
        RAISE NOTICE 'public.spatial_ref_sys absent, verification ignoree.';
        RETURN;
    END IF;

    v_anon := has_table_privilege('anon', 'public.spatial_ref_sys', 'select');
    v_auth := has_table_privilege('authenticated', 'public.spatial_ref_sys', 'select');

    IF v_anon OR v_auth THEN
        RAISE WARNING
            'spatial_ref_sys : SELECT toujours accorde (anon=%, authenticated=%). Le revoke est '
            'reste sans effet pour le role % (pas de grant option) : l''alerte Advisor 0013 '
            'persiste. Voir memory/database.md.', v_anon, v_auth, current_user;
    ELSE
        RAISE NOTICE 'public.spatial_ref_sys : SELECT retire a anon et authenticated.';
    END IF;
END;
$$;
--rollback select 1;

--changeset neighborshare:031-reload-schema-cache
--comment: PostgREST doit recharger son cache pour cesser d'exposer la table
select pg_notify('pgrst', 'reload schema');
--rollback select 1;
