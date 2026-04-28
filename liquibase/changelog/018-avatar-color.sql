--liquibase formatted sql

--changeset neighborshare:018-avatar-color
-- Couleur de fond personnalisable de l'avatar dans les profils
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color text;
