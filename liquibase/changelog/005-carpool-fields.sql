--liquibase formatted sql

-- =============================================
-- 005 : Champs covoiturage sur les annonces
-- =============================================

--changeset neighborshare:005-carpool-fields
alter table public.listings
  add column if not exists carpool_departure_address text,
  add column if not exists carpool_departure_lat      double precision,
  add column if not exists carpool_departure_lng      double precision,
  add column if not exists carpool_arrival_address    text,
  add column if not exists carpool_arrival_lat        double precision,
  add column if not exists carpool_arrival_lng        double precision;

--changeset neighborshare:005-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
