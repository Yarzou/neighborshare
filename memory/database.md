# Base de données & Migrations

> Dernière vérification : 2026-07-28 (lecture complète du dépôt).

## Connexion
- Provider : Supabase (PostgreSQL + PostGIS)
- Variables app : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Migrations gérées par **Liquibase** (pas les migrations Supabase natives)
- `scripts/db-migrate.js` charge `.env.local` (dotenv), lit **`SUPABASE_DB_PASSWORD`**, et déduit l'utilisateur du pooler (`postgres.<project_ref>`) depuis `NEXT_PUBLIC_SUPABASE_URL`. Surcharges possibles : `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_POOLER_HOST`. Connexion via le pooler, port **6543**.
- `liquibase/liquibase.properties` (gitignoré) ne porte plus que `driver` / `changeLogFile` / `outputDefaultSchema` ; les identifiants viennent du script. Template : `.example`.
- ⚠️ Liquibase = outil Java : les commandes `db:*` échouent si `JAVA_HOME` est invalide.

## Migrations (ordre chronologique — 001 → 038)
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
| 028 | Catégorie `livre` (id = 8, ID posé explicitement + `setval` de la séquence) + colonnes `book_author`, `book_condition`, `book_genre` |
| 029 | Update RPC avec les champs livre **et `price`** (oublié en 014 : le badge prix ne remontait pas sur la carte) + re-grant `execute` perdu par le DROP |
| 030 | Lecture de `profiles` / `listings` / `events` réservée aux authentifiés (`to authenticated`) + `revoke execute` du RPC pour `anon`. `categories` reste public (keepalive). |
| 031 | `revoke select` sur `public.spatial_ref_sys` (anon / authenticated / PUBLIC) — **resté sans effet**, l'alerte Advisor persiste (voir ci-dessous) |
| 032 | Vue **`listings_geo`** (`security_invoker = true`, PG 15+) : `l.* + lat_out/lng_out`, filtre `expires_at`. Remplace le RPC côté app ; le RPC reste en base (fenêtre migration/déploiement) et pourra être droppé plus tard |
| 033 | `profiles.is_referent` + fonction `is_referent()` (SECURITY DEFINER) + table `announcements` (lecture authentifiée, écriture référents) |
| 034 | Table `providers` (prestataires recommandés) — CRUD par l'auteur, delete aussi par référent |
| 035 | Tables `group_purchases` + `group_purchase_participants` (PK composite = 1 participation/compte, quantité + seuil, unité libre) |
| 036 | Tables `polls` / `poll_options` / `poll_votes` + RPC `poll_results()`. Votes lisibles uniquement par leur auteur ; les totaux passent par le RPC, qui refuse de répondre avant d'avoir voté (sauf sondage clos ou auteur) |
| 037 | Delete **et update** d'événement élargis au référent : `events_delete_own` → `events_delete`, `events_update_own` → `events_update` (`user_id = auth.uid() OR is_referent()`), idem pour `events_storage_delete` (images du bucket) |
| 038 | **Modèle de droits complet** : update `providers`/`group_purchases` = créateur ou référent ; update/delete `announcements`/`polls` (+ gestion `poll_options`) = **tout** référent (plus seulement l'auteur) |
| 039 | **Performances** — 9 index (le schéma n'en avait que 9 au total, **aucune FK indexée**) + RPC `conversations_overview()`, `unread_message_count()`, `poll_results_bulk()` + `listings` ajoutée à `supabase_realtime`. Purement additive. ⚠️ **écrite, pas encore appliquée** |

Ajouter une migration = créer `0NN-nom.sql` **et** l'inclure dans `db.changelog-master.xml` avec un commentaire. Ne jamais modifier un changeset déjà appliqué.

### Index (état après 039)

Avant 039 le schéma comptait **9 index explicites** et **aucune clé étrangère indexée** — Postgres
ne les crée pas tout seul. Ajoutés :

| Index | Sert |
|---|---|
| `messages(conversation_id, created_at)` | La requête la plus chaude. `messages_select` (002) appelle `is_conversation_participant()` **une fois par ligne scannée** : sans index, ouvrir un fil parcourait toute la table *et* exécutait la fonction autant de fois |
| `messages(sender_id)` | Aucune requête ne filtre dessus — justifié par la cascade depuis `profiles` (`/api/account/delete`) |
| `conversation_participants(user_id)` | La PK est `(conversation_id, user_id)`, inutilisable pour `user_id` seul. Bénéficiaire principal : `find_or_create_conversation` (016). **Volontairement non partiel** sur `deleted_at` — 016 interroge délibérément les soft-deleted |
| `listings(user_id, created_at desc)` | `/profile`, `/profil/[id]`, `/demandes` |
| `listings(responder_id)` *partiel* | `/demandes`, pastille, suppression de compte |
| `listings(status, created_at desc)` | `/recent` |
| `listings(conversation_id)` *partiel* | `/messages/[id]` |
| `poll_votes(user_id)` | `PollsSection` lit `poll_votes` **sans filtre** : tout vient de la policy |
| `poll_votes(option_id)` | `poll_results()` / `poll_results_bulk()` |

**Écartés volontairement, ne pas les rajouter « par principe »** : `listings(category_id)`,
`listings(expires_at)`, `listings(updated_at)`, `conversations(updated_at)`,
`group_purchase_participants(user_id)`, `message_reactions(user_id)`, et les FK `author_id` /
`created_by` de `announcements` / `providers` / `group_purchases` / `polls` — un embed PostgREST
`profiles!author_id(...)` est *to-one*, il résout `profiles.id` (PK côté parent) et **jamais** la
colonne enfant. Justifications complètes dans l'en-tête de `039-perf-indexes-et-messagerie.sql`.

**Pas de `create index concurrently`** : interdit en transaction, imposerait `runInTransaction:false`
et la perte de l'atomicité du changeset. À reconsidérer si `messages` dépassait le million de lignes.

### `auth.uid()` vs `(select auth.uid())` — décision prise

La préconisation Supabase (évaluer une fois par requête en InitPlan) **ne s'applique pas ici** :
- les policies `select` des tables les plus lues sont en `to authenticated using (true)` depuis 030,
  elles n'appellent pas `auth.uid()` du tout ;
- là où le coût par ligne est réel (`messages_select`, `conversations_select`, `participants_select`),
  l'argument de `is_conversation_participant(<colonne de la ligne>)` **dépend de la ligne** : aucun
  InitPlan n'est possible, quelle que soit l'écriture d'`auth.uid()` à l'intérieur. Le correctif de
  ce chemin est l'index de 039, pas la réécriture.

Réécrire ~40 policies sans aucun test, sur le seul verrou de l'application, pour un gain non mesurable
à ce volume : **non**. Convention retenue à la place — `(select auth.uid())` dans toute policy
**nouvelle** (039+), et réécriture opportuniste quand une policy est de toute façon recréée pour une
raison fonctionnelle (méthode déjà appliquée en 037/038).

### `spatial_ref_sys` et l'alerte Advisor — NON RÉGLÉE (état 2026-08-03)

> `Table public.spatial_ref_sys is public, but RLS has not been enabled.`

PostGIS est installé **dans `public`** (001) et sa table `spatial_ref_sys` appartient à
`supabase_admin`. Le rôle applicatif (`postgres.<ref>`) ne peut donc **rien** faire des trois
leviers qui lèveraient l'alerte :

| Levier | Ce qu'il faut | Verdict |
|---|---|---|
| `alter table … enable row level security` + policy | être owner | ❌ testé en 027 (`insufficient_privilege`) |
| `alter extension postgis set schema extensions` (`extensions` est exclu du lint) | superuser | ❌ testé en 026 |
| `revoke select` de `anon`/`authenticated`/`PUBLIC` (le lint filtre aussi sur les droits) | grant option | ❌ testé en 031 — REVOKE sans effet, PostgreSQL n'émet qu'un `WARNING` |
| `set role supabase_admin` puis n'importe lequel des trois | appartenance au rôle | ❌ testé le 2026-08-03 en SQL Editor — `42501 permission denied to set role "supabase_admin"` |
| `drop extension postgis` + `create … with schema extensions` | être owner de l'extension | ❌ `pg_extension` : owner = `supabase_admin`, `extrelocatable = false` |

**Pourquoi `supabase_admin` possède tout ça** alors que c'est Liquibase (rôle `postgres`) qui a lancé
`create extension if not exists postgis` en 001 : PostGIS est une **trusted extension** côté
Supabase. PostgreSQL installe une extension « trusted » demandée par un non-superuser *comme si*
elle l'était par un superuser — l'extension et **tous ses objets** appartiennent alors au superuser
d'amorçage. Personne au niveau projet n'a la main dessus, et ce n'était pas un choix de migration.

⚠️ **Ne pas basculer PostGIS depuis la page Extensions du dashboard « pour voir »** : la
désactivation passe par un `cascade` qui emporterait `listings.location`, l'index GIST et tous les
RPC géo.

Le SQL du lint (`splinter/0013_rls_disabled_in_public`) est bien
`not relrowsecurity AND (has_table_privilege('anon'|'authenticated', …, 'SELECT')) AND nspname in
<schémas exposés>` — le levier « droits » était le bon raisonnement, mais le droit vient de
`supabase_admin`, hors de portée de `postgres`.

⚠️ **Ne pas rejouer ces trois pistes** : quatre migrations (023, 025, 026, 027) plus 031 s'y sont
déjà cassé les dents. 025 est même contre-productive (elle re-grant le SELECT). Ne jamais
re-grant `select` non plus : si un jour le revoke devient possible, il ne faut pas le défaire.

**Conclusion : l'alerte n'est pas levable depuis le dépôt.** Position retenue → **on vit avec**.
C'est un catalogue de systèmes de coordonnées (EPSG/IGN), publié en clair partout ; il ne contient
aucune donnée du quartier, et la vraie fermeture des données est 030. Seul l'Advisor reste rouge.

Si le sujet est un jour rouvert, les deux seules voies sont :
- **Réinstaller PostGIS dans `extensions`** via la page Extensions du dashboard (seule interface à
  s'exécuter avec les droits suffisants). Destructif : sauvegarder lat/lng, supprimer
  `listings.location` et tous les RPC qui en dépendent, puis tout recréer en qualifiant les types
  (`extensions.geography`) — et PostgREST doit voir `extensions` dans son `db-extra-search-path`.
- **Demander à Supabase** (support / discussion GitHub) de lancer `enable row level security` ou le
  `revoke` en `supabase_admin`.

Sans impact fonctionnel dans tous les cas : aucun `st_transform` dans le projet, et le SRID 4326
de `listings.location` court-circuite la lecture du catalogue.

Les SQL de `supabase/` (`schema.sql`, `migration_*.sql`, `fix_rls_conversation_participants.sql`) sont **de l'historique** — pas la source de vérité.

## Tables

### `profiles`
`id, username, full_name, avatar_url, bio, rating, rating_count, created_at, email_notifications_enabled, push_notifications_enabled, avatar_color, address_display, address_road, address_city, address_lat, address_lng, is_referent`  
Créé automatiquement à l'inscription par le trigger `on_auth_user_created` → `handle_new_user()`.  
`is_referent` (033) : rôle, pas un contrôle d'accès — autorise la publication d'`announcements` et de `polls`. Désignation du premier référent : `update` manuel en SQL Editor (aucune UI d'administration).

### `listings`
`id, user_id, category_id, title, description, type, status, image_url, address, city`  
`carpool_departure_address/lat/lng, carpool_arrival_address/lat/lng`  
`childcare_start_at, childcare_end_at, childcare_mode, childcare_slots (JSONB)`  
`book_author, book_condition, book_genre` (text libre ; valeurs de `book_condition` contraintes côté TS par `BookCondition`)  
`listing_intent, expires_at, price, created_at, responder_id, conversation_id`  
Colonne géo : `geography(Point, 4326)` — insert en WKT `POINT(lng lat)` (**longitude d'abord**).  
⚠️ `responder_id` n'a **pas** de CASCADE : la suppression de compte doit d'abord le remettre à `null` (fait par `/api/account/delete`).

### `categories`
`id (serial), slug, label, icon` — IDs stables 1–8 (8 = `livre`, ajouté en 028).

### Messagerie : `conversations` + `conversation_participants` + `messages`
⚠️ La table s'appelle **`messages`** en base ; le type TS correspondant est **`DirectMessage`**.  
Le type `Message` de `lib/types.ts` est un **legacy** (ancienne messagerie par annonce) — ne pas l'utiliser pour du nouveau code.  
Colonnes notables : `messages.is_system`, `conversation_participants.last_read_at` / `deleted_at` / `visible_from`.  
Trigger `messages_update_conversation_ts` (met à jour `conversations.updated_at`) et `messages_restore_participants` (rouvre une conversation soft-deleted à l'arrivée d'un message).

### `message_reactions`
`id, message_id, user_id, emoji, created_at` — emojis autorisés côté app : `MESSAGE_EMOJIS` (👍 ❤️ 😂 😮 😢 🙏).

### `events`
`id, user_id, title, description, event_date, event_end_date, location_text, location_lat, location_lng, image_urls (text[]), created_at`  
RLS : lecture **authentifiée** (030) ; insert réservé au créateur ; **update et delete = créateur ou référent** (037, delete aussi sur les images du bucket `events`).

### `fcm_tokens`
`user_id` (→ `auth.users`, cascade), `token`. Upsert `onConflict: 'token'`. Les tokens rejetés par FCM sont supprimés automatiquement par `lib/fcm-admin.ts`.

### `announcements` (033, droits 038)
`id, author_id, title, body, is_pinned, created_at, updated_at` — infos officielles de l'ASL.  
RLS : lecture authentifiée ; insert par l'auteur référent ; **update/delete par tout référent** (`author_id` conservé à l'update : pas d'appropriation).

### `providers` (034, droits 038)
`id, created_by, name, trade, phone, email, website, comment, created_at, updated_at`.  
RLS : lecture authentifiée ; insert par l'auteur ; **update/delete par l'auteur ou un référent**.

### `group_purchases` + `group_purchase_participants` (035, droits 038)
Achat : `id, created_by, title, description, unit (texte libre), target_quantity, unit_price, deadline, status ('ouvert'|'cloture'|'annule' — text libre, contraint côté TS)`.  
Participation : PK `(purchase_id, user_id)` → une par compte, `quantity > 0` (check), `comment`. Upsert `onConflict: 'purchase_id,user_id'` pour modifier.  
RLS : lecture authentifiée (les participations sont visibles de tous — c'est l'intérêt) ; **update/delete de l'achat (y compris statut) par l'auteur ou un référent**.

### `polls` + `poll_options` + `poll_votes` (036, droits 038)
Sondage : `question, description, closes_at (date)` — création **référents uniquement** ; **update/delete par tout référent**. Côté UI, l'édition ne porte que les métadonnées (question/description/clôture) : **les options ne sont pas éditables une fois le sondage créé** (des voisins ont pu voter). Options ordonnées par `position`.  
Vote : PK `(poll_id, user_id)` → une voix par compte, upsert pour changer d'avis.  
⚠️ **« Résultats après vote » est appliqué en base** : `poll_votes` n'est lisible que par son auteur, les totaux passent par le RPC `poll_results(p_poll_id)` (SECURITY DEFINER) qui lève une exception si l'appelant n'a pas voté — sauf sondage clos ou appelant auteur. Conséquence : pas de dépouillement nominatif possible via l'API.

## Fonctions / RPC
| RPC | Rôle |
|---|---|
| **`listings_geo` (VUE, 032)** | Remplace le RPC côté app : `listings.* + lat_out/lng_out`, filtre `expires_at`, `security_invoker = true` (respecte le RLS de 030). En `l.*` → **plus aucune colonne à déclarer** quand `listings` évolue. La distance/le tri se font côté client (`distanceMeters()` de `lib/neighborhood.ts`). |
| `listings_within_radius(lat, lng, radius_km)` | **Obsolète depuis 032** (plus appelé par le code ; conservé en base pour la fenêtre migration/déploiement, à dropper dans une migration future). Dernière définition : 029. |
| `poll_results(p_poll_id)` | Totaux d'un sondage — refuse de répondre si l'appelant n'a pas voté (sauf clos / auteur) |
| **`poll_results_bulk(p_poll_ids uuid[])` (039)** | Idem pour **plusieurs** sondages en un appel (`PollsSection` en lançait un par sondage). Un sondage non accessible est **omis** du retour au lieu de lever — sinon un seul sondage ferait échouer le lot. |
| **`conversations_overview()` (039)** | Toute la liste `/messages` en une requête : nom, dernier message, **vrai** décompte de non-lus, participants (jsonb). Respecte `deleted_at` et `visible_from`. `security definer` nécessaire (sinon `is_conversation_participant()` est réévaluée par ligne) mais refermée par `auth.uid()` dans la CTE `mine`. |
| **`unread_message_count()` (039)** | Pastille de la navbar — scalaire. Remplace 2 requêtes dont un `select messages` en pratique non borné, exécuté **sur chaque page**. |
| `is_referent()` | Helper RLS : `profiles.is_referent` de l'appelant |
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
- ⚠️ Ces buckets restent **publics** après la migration 030 (nécessaire pour `getPublicUrl`) : une image est donc accessible par son URL directe même sans compte. URL non devinable, limite assumée — passer aux signed URLs si ça devient un enjeu.

## Visibilité des données (migration 030)
`profiles`, `listings`, `events` : `for select **to authenticated**` (avant : `using (true)`, donc lisibles par le rôle `anon` avec la clé publique).  
`categories` : **reste en lecture publique** — `/api/keepalive` l'interroge avec la clé anon.  
Messagerie (`conversations`, `conversation_participants`, `messages`, `message_reactions`) et `fcm_tokens` : déjà cloisonnés par utilisateur, non touchés.  
Pas de notion de membre du lotissement : l'inscription reste ouverte (choix assumé).

## Realtime
Activé sur `messages` et `conversation_participants` (migration 017), + `message_reactions` (022),
+ **`listings` (039)**.  
Canaux utilisés côté app : `conv:{id}`, `typing:{id}` (broadcast), `messages_list_updates`, `navbar_unread`.

⚠️ **Piège historique** : `usePendingRequests` (`lib/hooks.ts`) s'abonnait à `UPDATE listings` depuis
toujours, alors que la table n'était **pas dans la publication** — ces callbacks ne se déclenchaient
jamais, et la pastille « Demandes » ne bougeait qu'au changement de page. Corrigé par 039. Avant
d'ajouter un abonnement Realtime, vérifier que la table est bien publiée : l'API ne signale rien.

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
