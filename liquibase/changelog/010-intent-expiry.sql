--liquibase formatted sql

-- =============================================
-- 010 : listing_intent (offre/demande global)
--       + expires_at (expiration optionnelle)
-- =============================================

--changeset neighborshare:010-listing-intent
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS listing_intent text NOT NULL DEFAULT 'offre';

--changeset neighborshare:010-listing-expires-at
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- DROP requis : CREATE OR REPLACE ne peut pas changer le type de retour
--changeset neighborshare:010-drop-rpc splitStatements:false
DROP FUNCTION IF EXISTS listings_within_radius(double precision, double precision, double precision);

--changeset neighborshare:010-rpc-listings-within-radius splitStatements:false
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
  childcare_slots    jsonb,
  listing_intent     text,
  expires_at         timestamptz
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
    l.childcare_slots,
    l.listing_intent,
    l.expires_at
  FROM public.listings l
  WHERE st_dwithin(
    l.location::geography,
    st_makepoint(lng, lat)::geography,
    radius_km * 1000
  )
  AND (l.expires_at IS NULL OR l.expires_at > NOW())
  ORDER BY distance_m ASC;
$$;

--changeset neighborshare:010-reload-schema-cache
SELECT pg_notify('pgrst', 'reload schema');
