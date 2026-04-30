--liquibase formatted sql

-- =============================================
-- 020 : Activation RLS sur les tables sans politique
-- =============================================

--changeset neighborshare:020-rls-categories
-- categories est publiquement lisible mais ne doit pas être modifiable via PostgREST
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (true);

--changeset neighborshare:020-rls-liquibase-tables
-- Tables internes Liquibase : RLS activé sans politique = inaccessibles via PostgREST
ALTER TABLE public.databasechangelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.databasechangeloglock ENABLE ROW LEVEL SECURITY;

--changeset neighborshare:020-rls-spatial-ref-sys
-- Table de référence PostGIS : lecture publique en lecture seule
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spatial_ref_sys_select" ON public.spatial_ref_sys FOR SELECT USING (true);
