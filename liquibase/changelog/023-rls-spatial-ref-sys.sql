--liquibase formatted sql

-- =============================================
-- 023 : (no-op) spatial_ref_sys appartient à PostGIS
-- =============================================
-- spatial_ref_sys est une table système PostGIS dont le owner est postgres/superuser.
-- Un rôle applicatif ne peut pas activer RLS dessus (ERROR: must be owner of table).
-- Cette migration est conservée comme no-op pour ne pas casser le changelog.

--changeset neighborshare:023-rls-spatial-ref-sys
SELECT 1; -- no-op : spatial_ref_sys appartient au superuser, RLS non applicable
