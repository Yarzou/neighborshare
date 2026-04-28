--liquibase formatted sql

-- =============================================
-- 016 : Historique masqué après suppression (visible_from)
-- =============================================

--changeset neighborshare:016-conversation-participants-visible-from
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS visible_from timestamptz;

-- ── Mise à jour du trigger de restauration ──
-- Ne touche PAS visible_from : les messages antérieurs à la suppression
-- restent invisibles pour l'utilisateur qui avait supprimé la conversation.

--changeset neighborshare:016-fn-restore-deleted-participants splitStatements:false
CREATE OR REPLACE FUNCTION public.restore_deleted_participants_fn()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $func$
BEGIN
  UPDATE public.conversation_participants
  SET deleted_at = NULL
  WHERE conversation_id = NEW.conversation_id
    AND deleted_at IS NOT NULL;
  RETURN NEW;
END;
$func$;

-- ── Mise à jour de find_or_create_conversation ──
-- Quand la conv existante est trouvée et que l'utilisateur l'avait supprimée,
-- reset deleted_at et pose visible_from = now() pour masquer l'historique.

--changeset neighborshare:016-fn-find-or-create-conversation splitStatements:false
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(other_user_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $func$
DECLARE
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  -- Cherche une conversation 1-à-1 existante (inclut les soft-deleted)
  SELECT cp1.conversation_id INTO v_conv_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND (
      SELECT count(*)
      FROM public.conversation_participants cp3
      WHERE cp3.conversation_id = cp1.conversation_id
    ) = 2
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    -- Si l'utilisateur avait supprimé la conv, la restaure et coupe l'historique
    UPDATE public.conversation_participants
    SET deleted_at  = NULL,
        visible_from = now()
    WHERE conversation_id = v_conv_id
      AND user_id = auth.uid()
      AND deleted_at IS NOT NULL;
    RETURN v_conv_id;
  END IF;

  -- Pas de conversation existante : en crée une nouvelle
  INSERT INTO public.conversations (name) VALUES (NULL) RETURNING id INTO v_conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conv_id, auth.uid());
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$func$;
