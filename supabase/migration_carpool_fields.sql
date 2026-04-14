-- Migration : ajout des champs covoiturage sur les annonces
-- À exécuter dans l'éditeur SQL de votre projet Supabase

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS carpool_departure_address text,
  ADD COLUMN IF NOT EXISTS carpool_departure_lat      double precision,
  ADD COLUMN IF NOT EXISTS carpool_departure_lng      double precision,
  ADD COLUMN IF NOT EXISTS carpool_arrival_address    text,
  ADD COLUMN IF NOT EXISTS carpool_arrival_lat        double precision,
  ADD COLUMN IF NOT EXISTS carpool_arrival_lng        double precision;
