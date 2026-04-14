--liquibase formatted sql

-- =============================================
-- 007 : Champs garde d'enfant sur les annonces
-- =============================================

--changeset neighborshare:007-childcare-fields
alter table public.listings
  add column if not exists childcare_start_at timestamptz,
  add column if not exists childcare_end_at   timestamptz;

--changeset neighborshare:007-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
