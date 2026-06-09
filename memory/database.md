# Base de données & Migrations

## Connexion
- Provider : Supabase (PostgreSQL + PostGIS)
- Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Migrations gérées par **Liquibase** (pas les migrations Supabase natives)
- Config : `liquibase/liquibase.properties` (ne pas committer — copier `.example`)

## Migrations (ordre chronologique)
| Fichier | Contenu |
|---|---|
| 001 | Schéma initial (profiles, listings, categories, geography) |
| 002 | Réponses aux annonces |
| 003 | Additions diverses + fix RLS messaging |
| 004 | Bucket storage `listings` |
| 005 | Champs covoiturage (departure/arrival lat/lng/address) |
| 006 | Update RPC covoiturage |
| 007 | Champs garde-enfant (childcare_start_at, childcare_end_at, childcare_mode) |
| 008 | Update RPC garde-enfant |
| 009 | childcare_slots (JSONB) |
| 010 | listing_intent (offre/demande) + expires_at |
| 011 | Préférences notifications |
| 012 | Tokens FCM |
| 013 | Catégorie cuisine (id=7) |
| 014 | Type vente |
| 015 | Soft-delete conversations |
| 016 | conversation_visible_from |
| 017 | Realtime activé |
| 018 | avatar_color sur profiles |
| 019 | Adresse profil (address_display, address_road, address_city, address_lat/lng) |
| 020 | Fix RLS |
| 021 | Messages système |
| 022 | Réactions aux messages (MessageReaction) |
| 023 | RLS spatial_ref_sys |
| 024 | Table events (événements de quartier) |

## Tables principales
### `profiles`
`id, username, full_name, avatar_url, bio, rating, rating_count, created_at, email_notifications_enabled, push_notifications_enabled, avatar_color, address_display, address_road, address_city, address_lat, address_lng`

### `listings`
`id, user_id, category_id, title, description, type, status, image_url, address, city`  
`carpool_departure_address/lat/lng, carpool_arrival_address/lat/lng`  
`childcare_start_at, childcare_end_at, childcare_mode, childcare_slots (JSONB)`  
`listing_intent, expires_at, price, created_at`  
Colonne géo : `geography(Point, 4326)` — insert en WKT : `POINT(lng lat)` (longitude d'abord)

### `categories`
`id (serial), slug, label, icon` — IDs stables 1–7

### `conversations` + `conversation_participants` + `direct_messages`
Messagerie entre voisins — Realtime activé

### `events`
`id, user_id, title, description, event_date, event_end_date, location_text, location_lat/lng, image_urls (text[]), created_at`

### `message_reactions`
`id, message_id, user_id, emoji, created_at`

## RPC PostGIS
```sql
listings_within_radius(lat, lng, radius_km)
-- Retourne les listings + distance_m, lat_out, lng_out
```

## Storage
- Bucket : `listings`
- Chemin : `{userId}/{timestamp}.{ext}`
- URL publique stockée dans `listings.image_url`

## Valeurs métier (slugs français)
### Types d'annonces (`ListingType`)
`'pret' | 'don' | 'echange' | 'service' | 'vente'`

### Statuts (`ListingStatus`)
`'disponible' | 'reserve' | 'termine' | 'en_cours' | 'validee'`

### Intention (`ListingIntent`)
`'offre' | 'demande'`

### Mode garde-enfant (`ChildcareMode`)
`'demande' | 'offre'`
