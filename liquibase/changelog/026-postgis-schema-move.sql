--liquibase formatted sql

-- =============================================
-- 026 : Déplacement PostGIS hors du schéma public
-- =============================================
-- Objectif : supprimer l'exposition de spatial_ref_sys dans public.
-- Référence : procédure Supabase de relocation PostGIS.

--changeset neighborshare:026-postgis-schema-move splitStatements:false
DO $$
DECLARE
    v_schema text;
BEGIN
    SELECT n.nspname
      INTO v_schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'postgis';

    IF v_schema IS NULL THEN
        RAISE EXCEPTION 'Extension postgis introuvable';
    END IF;

    IF v_schema <> 'public' THEN
        RAISE NOTICE 'PostGIS deja hors de public (schema=%), aucune action.', v_schema;
        RETURN;
    END IF;

    -- La relocation PostGIS requiert des privilèges superuser (maj pg_extension)
    -- indisponibles dans ce pipeline Liquibase. On garde ce changeset en no-op
    -- explicite pour débloquer les migrations applicatives.
    RAISE NOTICE 'PostGIS est encore dans public: relocation a faire via support Supabase (operation superuser).';
END;
$$;
