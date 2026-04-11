--changeset neighborshare:002-listing-status-values
DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'en_cours') THEN
            ALTER TYPE listing_status ADD VALUE 'en_cours';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'validee') THEN
            ALTER TYPE listing_status ADD VALUE 'validee';
        END IF;
    END$$;
