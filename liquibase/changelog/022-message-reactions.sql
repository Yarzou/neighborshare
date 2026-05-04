--liquibase formatted sql

-- =============================================
-- 022 : Réactions emoji sur les messages
--       Table message_reactions
--       RLS : lecture pour les participants,
--             insert/delete pour son propre user
-- =============================================

--changeset neighborshare:022-message-reactions-table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji      text        NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','😢','🙏')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);

--changeset neighborshare:022-message-reactions-index
CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
    ON public.message_reactions (message_id);

--changeset neighborshare:022-message-reactions-rls
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Lecture : tout participant de la conversation peut voir les réactions
CREATE POLICY "reactions_select" ON public.message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.messages m
            JOIN public.conversation_participants cp
              ON cp.conversation_id = m.conversation_id
            WHERE m.id = message_reactions.message_id
              AND cp.user_id = auth.uid()
        )
    );

-- Insert : tout participant peut ajouter sa propre réaction
CREATE POLICY "reactions_insert" ON public.message_reactions
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.messages m
            JOIN public.conversation_participants cp
              ON cp.conversation_id = m.conversation_id
            WHERE m.id = message_reactions.message_id
              AND cp.user_id = auth.uid()
        )
    );

-- Delete : seulement sa propre réaction
CREATE POLICY "reactions_delete" ON public.message_reactions
    FOR DELETE USING (user_id = auth.uid());

--changeset neighborshare:022-message-reactions-realtime
ALTER publication supabase_realtime ADD TABLE public.message_reactions;
