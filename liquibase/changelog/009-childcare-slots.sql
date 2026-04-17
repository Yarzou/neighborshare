--liquibase formatted sql

-- =============================================
-- 009 : Champs childcare_mode + childcare_slots
--       Mode "demande" vs "offre de disponibilités"
-- =============================================

--changeset neighborshare:009-childcare-mode-column
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS childcare_mode text;

--changeset neighborshare:009-childcare-slots-column
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS childcare_slots jsonb;

-- DROP requis : CREATE OR REPLACE ne peut pas changer le type de retour
--changeset neighborshare:009-drop-rpc splitStatements:false
DROP FUNCTION IF EXISTS listings_within_radius(double precision, double precision, double precision);

--changeset neighborshare:009-rpc-listings-within-radius splitStatements:false
CREATE OR REPLACE FUNCTION listings_within_radius(
  lat float,
  lng float,
  radius_km float DEFAULT 5
)
RETURNS TABLE (
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
  carpool_arrival_lng float8,
  childcare_start_at timestamptz,
  childcare_end_at   timestamptz,
  childcare_mode     text,
  childcare_slots    jsonb
)
LANGUAGE sql STABLE AS $$
  SELECT
    l.id, l.user_id, l.category_id,
    l.title, l.description, l.type,
    l.status, l.image_url,
    l.address, l.city, l.created_at,
    st_distance(l.location::geography, st_makepoint(lng, lat)::geography) AS distance_m,
    st_y(l.location::geometry) AS lat_out,
    st_x(l.location::geometry) AS lng_out,
    l.carpool_departure_address,
    l.carpool_departure_lat,
    l.carpool_departure_lng,
    l.carpool_arrival_address,
    l.carpool_arrival_lat,
    l.carpool_arrival_lng,
    l.childcare_start_at,
    l.childcare_end_at,
    l.childcare_mode,
    l.childcare_slots
  FROM public.listings l
  WHERE st_dwithin(
    l.location::geography,
    st_makepoint(lng, lat)::geography,
    radius_km * 1000
  )
  ORDER BY distance_m ASC;
$$;

--changeset neighborshare:009-reload-schema-cache
SELECT pg_notify('pgrst', 'reload schema');
