--liquibase formatted sql

--changeset neighborshare:017-enable-realtime
-- Activation du realtime Supabase pour les messages et participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
