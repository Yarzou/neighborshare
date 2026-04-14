--liquibase formatted sql

-- =============================================
-- 006 : Mise à jour RPC listings_within_radius
--       pour inclure les champs covoiturage
-- =============================================

-- DROP requis : CREATE OR REPLACE ne peut pas changer le type de retour
--changeset neighborshare:006-drop-rpc-before-carpool splitStatements:false
drop function if exists listings_within_radius(double precision, double precision, double precision);

--changeset neighborshare:006-rpc-listings-within-radius-carpool splitStatements:false
create or replace function listings_within_radius(
  lat float,
  lng float,
  radius_km float default 5
)
returns table (
  id uuid, user_id uuid, category_id integer,
  title text, description text, type listing_type,
  status listing_status, image_url text,
  address text, city text, created_at timestamptz,
  distance_m float,
  lat_out float, lng_out float,
  carpool_departure_address text,
  carpool_departure_lat float8,
  carpool_departure_lng float8,
  carpool_arrival_address text,
  carpool_arrival_lat float8,
  carpool_arrival_lng float8
)
language sql stable as $$
  select
    l.id, l.user_id, l.category_id,
    l.title, l.description, l.type,
    l.status, l.image_url,
    l.address, l.city, l.created_at,
    st_distance(l.location::geography, st_makepoint(lng, lat)::geography) as distance_m,
    st_y(l.location::geometry) as lat_out,
    st_x(l.location::geometry) as lng_out,
    l.carpool_departure_address,
    l.carpool_departure_lat,
    l.carpool_departure_lng,
    l.carpool_arrival_address,
    l.carpool_arrival_lat,
    l.carpool_arrival_lng
  from public.listings l
  where st_dwithin(
    l.location::geography,
    st_makepoint(lng, lat)::geography,
    radius_km * 1000
  )
  order by distance_m asc;
$$;

--changeset neighborshare:006-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
