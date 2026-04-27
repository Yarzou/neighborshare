--liquibase formatted sql

-- =============================================
-- 011 : Préférences de notifications utilisateur
--       email_notifications_enabled + push_notifications_enabled
-- =============================================

--changeset neighborshare:011-notification-prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled  boolean NOT NULL DEFAULT true;

--changeset neighborshare:011-reload-schema-cache
SELECT pg_notify('pgrst', 'reload schema');
