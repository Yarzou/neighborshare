--liquibase formatted sql

-- =============================================
-- 025 : Hardening spatial_ref_sys (phase immediate)
-- =============================================
-- Objectif : limiter strictement les droits d'écriture API sur la table PostGIS
--            public.spatial_ref_sys en attendant la migration de schéma PostGIS.

--changeset neighborshare:025-spatial-ref-sys-hardening splitStatements:false
DO $$
BEGIN
    IF to_regclass('public.spatial_ref_sys') IS NULL THEN
        RAISE NOTICE 'public.spatial_ref_sys absent, hardening ignore.';
        RETURN;
    END IF;

    -- Écriture interdite pour les rôles API ; SELECT conservé pour compatibilité PostGIS.
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON TABLE public.spatial_ref_sys
      FROM PUBLIC, anon, authenticated;

    GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated;
END;
$$;
