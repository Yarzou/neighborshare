-- =============================================
-- Migration : système de réponse aux annonces
-- À exécuter dans l'éditeur SQL Supabase
-- =============================================

-- 1. Nouveaux statuts
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'en_cours';
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'validee';

-- 2. Colonnes supplémentaires sur listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS responder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 3. listing_id sur les conversations (contexte)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL;

-- 4. RPC : contacter une annonce (crée la conversation + premier message + met à jour le statut)
CREATE OR REPLACE FUNCTION contact_listing(
  p_listing_id    uuid,
  p_first_message text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Annonce introuvable'; END IF;
  IF v_listing.user_id = auth.uid() THEN RAISE EXCEPTION 'Vous ne pouvez pas contacter votre propre annonce'; END IF;
  IF v_listing.status != 'disponible' THEN RAISE EXCEPTION 'Annonce non disponible'; END IF;

  -- Créer la conversation liée à l'annonce
  INSERT INTO public.conversations (listing_id)
  VALUES (p_listing_id)
  RETURNING id INTO v_conv_id;

  -- Ajouter les deux participants
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conv_id, auth.uid());
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conv_id, v_listing.user_id);

  -- Premier message
  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (v_conv_id, auth.uid(), p_first_message);

  -- Mettre à jour l'annonce
  UPDATE public.listings
  SET status = 'en_cours',
      responder_id = auth.uid(),
      conversation_id = v_conv_id,
      updated_at = now()
  WHERE id = p_listing_id;

  RETURN v_conv_id;
END;
$$;

-- 5. RPC : propriétaire valide le répondant
CREATE OR REPLACE FUNCTION validate_listing_response(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  UPDATE public.listings
  SET status = 'validee', updated_at = now()
  WHERE id = p_listing_id
    AND user_id = auth.uid()
    AND status = 'en_cours';

  IF NOT FOUND THEN RAISE EXCEPTION 'Impossible de valider'; END IF;
END;
$$;

-- 6. RPC : annulation (propriétaire OU répondant)
CREATE OR REPLACE FUNCTION cancel_listing_response(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Annonce introuvable'; END IF;

  IF auth.uid() != v_listing.user_id AND auth.uid() != v_listing.responder_id THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE public.listings
  SET status = 'disponible',
      responder_id = NULL,
      conversation_id = NULL,
      updated_at = now()
  WHERE id = p_listing_id;
END;
$$;
