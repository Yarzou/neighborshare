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

-- Note: spatial_ref_sys appartient à l'extension PostGIS (owned by superuser),
-- il est impossible d'y activer RLS sans droits superuser. Ce warning Supabase
-- peut être ignoré — la table est en lecture seule et ne contient aucune donnée sensible.
