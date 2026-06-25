--liquibase formatted sql

-- =============================================
-- 027 : Activation RLS sur spatial_ref_sys
-- =============================================
-- Objectif : tenter l'activation RLS sur public.spatial_ref_sys sans bloquer les migrations.
-- Remarque : cette table appartient en pratique au owner PostGIS ; le rôle applicatif
-- peut ne pas avoir les droits ALTER/CREATE POLICY.

--changeset neighborshare:027-rls-spatial-ref-sys splitStatements:false
DO $$
BEGIN
    IF to_regclass('public.spatial_ref_sys') IS NULL THEN
        RAISE NOTICE 'public.spatial_ref_sys absent, activation RLS ignoree.';
        RETURN;
    END IF;

    BEGIN
        ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'RLS non active: role courant non proprietaire de public.spatial_ref_sys.';
            RETURN;
    END;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'spatial_ref_sys'
           AND policyname = 'spatial_ref_sys_select'
    ) THEN
        BEGIN
            CREATE POLICY "spatial_ref_sys_select"
                ON public.spatial_ref_sys
                FOR SELECT
                USING (true);
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Policy non creee: role courant non proprietaire de public.spatial_ref_sys.';
        END;
    END IF;
END;
$$;
