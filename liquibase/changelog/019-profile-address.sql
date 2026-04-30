--liquibase formatted sql

--changeset neighborshare:019-profile-address-columns
-- Adresse par défaut de l'utilisateur (utilisée en pré-remplissage lors de la création d'annonce)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_display text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_road    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_city    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_lat     double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_lng     double precision;

--changeset neighborshare:019-update-handle-new-user splitStatements:false
-- Mise à jour du trigger pour inclure l'adresse passée dans raw_user_meta_data à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $func$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, address_display, address_road, address_city, address_lat, address_lng)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'address_display',
        NEW.raw_user_meta_data->>'address_road',
        NEW.raw_user_meta_data->>'address_city',
        (NEW.raw_user_meta_data->>'address_lat')::double precision,
        (NEW.raw_user_meta_data->>'address_lng')::double precision
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$func$;
