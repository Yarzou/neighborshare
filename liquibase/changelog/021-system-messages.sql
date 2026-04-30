--liquibase formatted sql

-- =============================================
-- 021 : Messages système dans les conversations
--       Ajout colonne is_system sur messages
--       Mise à jour des RPCs validate/cancel
--       pour insérer un message système centré
-- =============================================

--changeset neighborshare:021-messages-is-system
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

--changeset neighborshare:021-fn-validate-listing-sysmsg splitStatements:false
CREATE OR REPLACE FUNCTION validate_listing_response(p_listing_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $func$
DECLARE
    v_user_id uuid := auth.uid();
    v_listing listings%rowtype;
BEGIN
    SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Annonce introuvable';
    END IF;
    IF v_listing.user_id <> v_user_id THEN
        RAISE EXCEPTION 'Seul le proprietaire peut valider';
    END IF;
    IF v_listing.status <> 'en_cours' THEN
        RAISE EXCEPTION 'La demande n''est pas en cours';
    END IF;

    UPDATE listings
    SET status     = 'validee',
        updated_at = now()
    WHERE id = p_listing_id;

    -- Message système : demande validée
    IF v_listing.conversation_id IS NOT NULL THEN
        INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
        VALUES (v_listing.conversation_id, v_user_id, '✅ La demande a été acceptée', true);
    END IF;
END;
$func$;

--changeset neighborshare:021-fn-cancel-listing-sysmsg splitStatements:false
CREATE OR REPLACE FUNCTION cancel_listing_response(p_listing_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $func$
DECLARE
    v_user_id    uuid := auth.uid();
    v_listing    listings%rowtype;
    v_conv_id    uuid;
    v_system_msg text;
BEGIN
    SELECT * INTO v_listing FROM listings WHERE id = p_listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Annonce introuvable';
    END IF;
    IF v_listing.user_id <> v_user_id
       AND (v_listing.responder_id IS NULL OR v_listing.responder_id <> v_user_id) THEN
        RAISE EXCEPTION 'Permission insuffisante';
    END IF;

    -- Capture l'id de la conversation avant de la détacher
    v_conv_id := v_listing.conversation_id;

    -- Détermine le message selon le rôle et le statut
    IF v_listing.user_id = v_user_id THEN
        IF v_listing.status = 'en_cours' THEN
            v_system_msg := '❌ La demande a été refusée';
        ELSE
            v_system_msg := '↩️ La validation a été annulée';
        END IF;
    ELSE
        v_system_msg := '↩️ La demande a été annulée par le demandeur';
    END IF;

    UPDATE listings
    SET status          = 'disponible',
        responder_id    = null,
        conversation_id = null,
        updated_at      = now()
    WHERE id = p_listing_id;

    -- Message système dans la conversation (qui reste accessible même si détachée)
    IF v_conv_id IS NOT NULL THEN
        INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
        VALUES (v_conv_id, v_user_id, v_system_msg, true);
    END IF;
END;
$func$;
