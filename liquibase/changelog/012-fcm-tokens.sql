--liquibase formatted sql

-- =============================================
-- 012 : Table fcm_tokens
--       Stocke les tokens FCM par utilisateur/appareil
--       pour les notifications push Firebase
-- =============================================

--changeset neighborshare:012-fcm-tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text         NOT NULL UNIQUE,
  created_at timestamptz  DEFAULT NOW()
);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own fcm tokens"
  ON public.fcm_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

--changeset neighborshare:012-reload-schema-cache
SELECT pg_notify('pgrst', 'reload schema');
