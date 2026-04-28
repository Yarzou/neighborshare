--liquibase formatted sql

-- =============================================
-- 015 : Soft delete de conversation par utilisateur
-- =============================================

--changeset neighborshare:015-conversation-participants-deleted-at
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ── Trigger : restaure les participants "supprimés" quand un nouveau message arrive ──

--changeset neighborshare:015-fn-restore-deleted-participants splitStatements:false
CREATE OR REPLACE FUNCTION public.restore_deleted_participants_fn()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $func$
BEGIN
  -- Quand un message est inséré, réactive les participants qui avaient "supprimé"
  -- la conversation (reset deleted_at → NULL) pour qu'elle réapparaisse dans leur liste.
  UPDATE public.conversation_participants
  SET deleted_at = NULL
  WHERE conversation_id = NEW.conversation_id
    AND deleted_at IS NOT NULL;
  RETURN NEW;
END;
$func$;

--changeset neighborshare:015-trigger-restore-deleted-participants
CREATE TRIGGER messages_restore_participants
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_deleted_participants_fn();

-- ── Mise à jour de find_or_create_conversation ──
-- Quand une conversation 1-à-1 existante est trouvée, reset deleted_at pour
-- l'utilisateur courant si nécessaire (il avait "supprimé" la conv).

--changeset neighborshare:015-fn-find-or-create-conversation splitStatements:false
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
    -- Réactive la conversation si l'utilisateur courant l'avait supprimée
    UPDATE public.conversation_participants
    SET deleted_at = NULL
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
