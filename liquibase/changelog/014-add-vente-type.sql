--liquibase formatted sql

--changeset neighborshare:014-add-vente-type
ALTER TYPE listing_type ADD VALUE IF NOT EXISTS 'vente';

--changeset neighborshare:014-add-price-column
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price numeric(10,2);
