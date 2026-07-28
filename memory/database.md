# Base de données & Migrations

> Dernière vérification : 2026-07-28 (lecture complète du dépôt).

## Connexion
- Provider : Supabase (PostgreSQL + PostGIS)
- Variables app : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Migrations gérées par **Liquibase** (pas les migrations Supabase natives)
- `scripts/db-migrate.js` charge `.env.local` (dotenv), lit **`SUPABASE_DB_PASSWORD`**, et déduit l'utilisateur du pooler (`postgres.<project_ref>`) depuis `NEXT_PUBLIC_SUPABASE_URL`. Surcharges possibles : `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_POOLER_HOST`. Connexion via le pooler, port **6543**.
- `liquibase/liquibase.properties` (gitignoré) ne porte plus que `driver` / `changeLogFile` / `outputDefaultSchema` ; les identifiants viennent du script. Template : `.example`.
- ⚠️ Liquibase = outil Java : les commandes `db:*` échouent si `JAVA_HOME` est invalide.

## Migrations (ordre chronologique — 001 → 027)
| Fichier | Contenu |
|---|---|
| 001 | Schéma initial (profiles, listings, categories, messages, geography, RLS de base) |
| 002 | Réponses aux annonces : `contact_listing`, `validate_listing_response`, `cancel_listing_response`, RLS messagerie |
| 003 | Additions (`find_or_create_conversation`, `create_conversation`, suppression messages) + fix RLS messaging |
| 004 | Bucket storage `listings` + policies |
| 005 | Champs covoiturage (departure/arrival address/lat/lng) |
| 006 | Update RPC `listings_within_radius` avec champs covoiturage |
| 007 | Champs garde-enfant (`childcare_start_at`, `childcare_end_at`, `childcare_mode`) |
| 008 | Update RPC avec champs garde-enfant |
| 009 | `childcare_slots` (JSONB) — créneaux multiples |
| 010 | `listing_intent` (offre/demande) + `expires_at` |
| 011 | Préférences notifications (email + push) sur `profiles` |
| 012 | Table `fcm_tokens` |
| 013 | Catégorie cuisine (id = 7) |
| 014 | Type `vente` dans `listing_type` + colonne `price` |
| 015 | Soft-delete de conversation par utilisateur (`deleted_at`) |
| 016 | `conversation_visible_from` (historique masqué après suppression) |
| 017 | Realtime activé sur `messages` et `conversation_participants` |
| 018 | `avatar_color` sur `profiles` |
| 019 | Adresse profil (`address_display`, `address_road`, `address_city`, `address_lat/lng`) |
| 020 | Fix RLS (`categories`, `databasechangelog*`, `spatial_ref_sys`) |
| 021 | Messages système (`is_system`) + RPC validate/cancel postant un message auto |
| 022 | Réactions emoji (`message_reactions` + RLS + realtime) |
| 023 | (no-op) RLS `spatial_ref_sys` — table du superuser PostGIS, non applicable |
| 024 | Table `events` + bucket storage `events` |
| 025 | Hardening `spatial_ref_sys` (réduction des droits d'écriture) |
| 026 | Déplacement de PostGIS hors du schéma `public` (alerte Supabase Advisor) |
| 027 | Activation explicite de RLS sur `public.spatial_ref_sys` |

Ajouter une migration = créer `0NN-nom.sql` **et** l'inclure dans `db.changelog-master.xml` avec un commentaire. Ne jamais modifier un changeset déjà appliqué.

Les SQL de `supabase/` (`schema.sql`, `migration_*.sql`, `fix_rls_conversation_participants.sql`) sont **de l'historique** — pas la source de vérité.

## Tables

### `profiles`
`id, username, full_name, avatar_url, bio, rating, rating_count, created_at, email_notifications_enabled, push_notifications_enabled, avatar_color, address_display, address_road, address_city, address_lat, address_lng`  
Créé automatiquement à l'inscription par le trigger `on_auth_user_created` → `handle_new_user()`.

### `listings`
`id, user_id, category_id, title, description, type, status, image_url, address, city`  
`carpool_departure_address/lat/lng, carpool_arrival_address/lat/lng`  
`childcare_start_at, childcare_end_at, childcare_mode, childcare_slots (JSONB)`  
`listing_intent, expires_at, price, created_at, responder_id, conversation_id`  
Colonne géo : `geography(Point, 4326)` — insert en WKT `POINT(lng lat)` (**longitude d'abord**).  
⚠️ `responder_id` n'a **pas** de CASCADE : la suppression de compte doit d'abord le remettre à `null` (fait par `/api/account/delete`).

### `categories`
`id (serial), slug, label, icon` — IDs stables 1–7.

### Messagerie : `conversations` + `conversation_participants` + `messages`
⚠️ La table s'appelle **`messages`** en base ; le type TS correspondant est **`DirectMessage`**.  
Le type `Message` de `lib/types.ts` est un **legacy** (ancienne messagerie par annonce) — ne pas l'utiliser pour du nouveau code.  
Colonnes notables : `messages.is_system`, `conversation_participants.last_read_at` / `deleted_at` / `visible_from`.  
Trigger `messages_update_conversation_ts` (met à jour `conversations.updated_at`) et `messages_restore_participants` (rouvre une conversation soft-deleted à l'arrivée d'un message).

### `message_reactions`
`id, message_id, user_id, emoji, created_at` — emojis autorisés côté app : `MESSAGE_EMOJIS` (👍 ❤️ 😂 😮 😢 🙏).

### `events`
`id, user_id, title, description, event_date, event_end_date, location_text, location_lat, location_lng, image_urls (text[]), created_at`  
RLS : lecture publique, écriture/modif/suppression réservées au créateur.

### `fcm_tokens`
`user_id` (→ `auth.users`, cascade), `token`. Upsert `onConflict: 'token'`. Les tokens rejetés par FCM sont supprimés automatiquement par `lib/fcm-admin.ts`.

## Fonctions / RPC
| RPC | Rôle |
|---|---|
| `listings_within_radius(lat, lng, radius_km)` | Annonces dans un rayon + `distance_m`, `lat_out`, `lng_out` |
| `contact_listing(p_listing_id, …)` | Crée la conversation, pose `responder_id` + `conversation_id`, passe le statut à `en_cours` |
| `validate_listing_response(p_listing_id)` | `en_cours` → `validee` + message système |
| `cancel_listing_response(p_listing_id)` | Retour à `disponible`, remet `responder_id`/`conversation_id` à `null` + message système |
| `find_or_create_conversation(other_user_id)` | Conversation 1-à-1 existante ou nouvelle |
| `create_conversation(...)` | Conversation de groupe |
| `mark_conversation_read(conv_id)` | Met à jour `last_read_at` |
| `is_conversation_participant(conversation_id)` | Helper RLS |
| `handle_new_user()` | Trigger : crée le `profile` à l'inscription |
| `update_conversation_timestamp()`, `restore_deleted_participants_fn()` | Triggers messagerie |

## Cycle de vie d'une annonce
```
disponible ──contact_listing──▶ en_cours ──validate_listing_response──▶ validee
     ◀──────────────── cancel_listing_response ────────────────────────────┘
```
Toujours passer par ces RPC — jamais d'`update` direct sur `status`.  
`termine` est posé par la Edge Function `expire-listings` (cron) quand `expires_at` est dépassé.  
`reserve` existe dans le type mais n'est pas produit par les RPC actuels.

## Storage
- Buckets publics : **`listings`** (migration 004) et **`events`** (migration 024)
- Chemin : `{userId}/{timestamp}.{ext}` — les policies delete s'appuient sur `(storage.foldername(name))[1] = auth.uid()`
- URL publique stockée dans `listings.image_url` / `events.image_urls[]`

## Realtime
Activé sur `messages` et `conversation_participants` (migration 017), + `message_reactions` (022).  
Canaux utilisés côté app : `conv:{id}`, `typing:{id}` (broadcast), `messages_list_updates`, `navbar_unread`.

## Valeurs métier (slugs français)
### Types d'annonces (`ListingType`)
`'pret' | 'don' | 'echange' | 'service' | 'vente'`

### Statuts (`ListingStatus`)
`'disponible' | 'reserve' | 'termine' | 'en_cours' | 'validee'` (label affiché de `validee` : « En utilisation »)

### Intention (`ListingIntent`)
`'offre' | 'demande'`

### Mode garde-enfant (`ChildcareMode`)
`'demande' | 'offre'`

### Créneaux de garde (`ChildcareSlot`, JSONB)
`{ type: 'recurring', day: 0-6, start_time, end_time }` | `{ type: 'once', date, start_time, end_time }`  
`day` : 0 = dimanche … 6 = samedi (convention JS) ; heures `"HH:mm"`.
