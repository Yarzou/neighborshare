# CLAUDE.md — Règles pour les agents IA

## ⛔ Règles absolues

1. **Ne jamais faire de `git commit` ni de `git push`.**
   Toutes les modifications de code sont soumises à validation humaine avant tout commit.
2. **Ne jamais committer de secret.** `.env.local` et `liquibase/liquibase.properties` sont gitignorés — ils doivent le rester.
3. **Ne jamais modifier une migration Liquibase déjà appliquée.** Toujours créer un nouveau fichier numéroté.
4. **Toute l'UI et tous les textes visibles sont en français** (labels, messages d'erreur, emails, notifications).

---

## Le projet

**« Les voisins du Cèdre »** (nom technique : `neighborshare`) — plateforme d'entraide de quartier géolocalisée : prêt d'outils, services, garde d'enfant, covoiturage, dons, jardinage, cuisine, plus des événements de quartier et une messagerie temps réel. PWA installable avec notifications push.

Déploiement : Vercel, domaine de production **`voisinsducedre.vercel.app`** (`neighborshare-liard.vercel.app` est un ancien alias qui redirige en 307 — encore présent comme défaut d'`APP_URL` dans les Edge Functions).

---

## Stack réelle (vérifiée dans `package.json`)

| Élément | Version / choix |
|---|---|
| Framework | **Next.js 16.2.4** — App Router (⚠️ README et `.github/copilot-instructions.md` disent encore « Next.js 14 ») |
| React | 19 |
| TypeScript | 5, `strict: true`, alias `@/*` → racine |
| BDD | Supabase — PostgreSQL + PostGIS |
| Auth | Supabase Auth (`@supabase/ssr`), **côté client** |
| Carte | Leaflet 1.9 + leaflet.markercluster + tuiles OpenStreetMap |
| Styles | Tailwind CSS 3 (`darkMode: 'class'`) |
| Icônes | `lucide-react` |
| Push | Firebase Cloud Messaging (client `firebase`, serveur `firebase-admin`) |
| Email | Nodemailer via SMTP Gmail |
| Migrations | **Liquibase** (`liquibase/changelog/`), pilotées par `scripts/db-migrate.js` |
| Dates | `date-fns` (dispo) + `Intl` / helpers de `lib/utils.ts` |
| State | `useState`/`useEffect` + Context (`ThemeProvider`). Zustand est installé mais **non utilisé** |

**Pas de suite de tests.** Ne pas inventer de commande `npm test`. Les vérifications disponibles sont `npm run lint`, `npm run typecheck` et `npm run build` — les trois doivent passer.

**Lint** : `eslint.config.mjs` (flat config ESLint 9, `eslint-config-next/core-web-vitals`). `next lint` a été supprimé dans Next 16 et `.eslintrc.json` n'est plus lu par ESLint 9 — ne pas recréer d'`.eslintrc.*`.
Base actuelle : **0 erreur, 40 avertissements** (dette pré-existante : `react-hooks/exhaustive-deps`, `react-hooks/set-state-in-effect`). Ne pas laisser passer de nouvelle **erreur** ; éviter d'ajouter des avertissements.

**Gestionnaire de paquets** : `package-lock.json` est présent → utiliser **npm**, malgré le champ `packageManager: yarn@1.22.22` du `package.json` (incohérence connue, ne pas « corriger » sans demander).

---

## Commandes

```bash
npm run dev          # Dev server http://localhost:3000
npm run build        # Build prod
npm run lint         # ESLint 9 flat config (eslint .)
npm run lint:fix     # ESLint avec --fix
npm run typecheck    # tsc --noEmit

npm run db:status    # Migrations en attente
npm run db:migrate   # Applique les migrations
npm run db:rollback  # Rollback jusqu'à un tag  → node scripts/db-migrate.js rollback <tag>
npm run db:validate  # Valide le changelog
npm run db:tag       # Pose un tag (point de rollback)
```

---

## Architecture — règles à respecter

### 1. Deux clients Supabase, ne pas les mélanger
| Contexte | Import |
|---|---|
| Composant `'use client'` | `import { createClient } from '@/lib/supabase/client'` |
| Server Component / Route Handler | `import { createClient } from '@/lib/supabase/server'` (async, lit les cookies) |

Mélanger les deux casse la session / les cookies.

### 2. La donnée se lit côté client
Pas de Server Actions. Les Server Components ne font que du fetch de lecture ponctuel (ex. `app/accueil/page.tsx`, `app/listings/[id]/page.tsx`) ; l'essentiel des lectures/écritures se fait depuis des composants `'use client'` via le client navigateur.

Les **routes API** (`app/api/`) existent uniquement pour ce qui exige un secret serveur :
- `POST /api/notifications` — envoi push + email sur les événements de demande (`new_request` | `accepted` | `refused` | `cancelled`). Vérifie la session puis utilise la `SUPABASE_SERVICE_ROLE_KEY`.
- `POST /api/notifications/quartier` — push « vie du quartier » (`new_announcement` | `new_poll` | `new_event` | `new_group_purchase` | `gp_participation` | `gp_target_reached`). **Push uniquement, jamais d'email** (plafond SMTP Gmail). Appelée fire-and-forget via `notifyQuartier()` de `lib/pushNotifications.ts` après un insert réussi — à la **création** seulement, jamais à l'édition. Anti-abus : chaque événement re-vérifie en base que l'appelant est l'auteur du contenu (ou un participant réel), et `gp_target_reached` recalcule le total serveur.
- `GET /api/keepalive` — ping anti-mise-en-pause de Supabase (voir plus bas).
- `POST /api/internal/send-email` — proxy email appelé par les Edge Functions, protégé par l'en-tête `x-internal-secret`.
- `DELETE /api/account/delete` — suppression de compte (service role, cascade).
- `GET /api/firebase-messaging-sw` — sert le Service Worker FCM avec la config injectée côté serveur (en-tête `Service-Worker-Allowed: /`).

### 3. Géolocalisation : la vue `listings_geo`
```ts
supabase.from('listings_geo').select('*')
// → toutes les colonnes de listings + lat_out, lng_out (expirées exclues)
```
Depuis la migration **032**, la carte lit la vue `listings_geo` (`security_invoker = true`, en `l.*`) : **une nouvelle colonne de `listings` remonte automatiquement**, plus de `RETURNS TABLE` à maintenir. Distance et tri par proximité se calculent côté client via `distanceMeters()` de **`lib/neighborhood.ts`** — qui centralise aussi le centre du quartier, le zoom et le rayon (surchargeables par `NEXT_PUBLIC_NEIGHBORHOOD_*`). Ne pas réintroduire de constante géo en dur dans un composant.
L'ancien RPC `listings_within_radius` n'est **plus appelé** ; il reste en base et sera droppé dans une migration future.
Seules les annonces avec `lat_out`/`lng_out` sont affichées sur la carte.
Insertion de position : WKT `POINT(lng lat)` — **longitude d'abord**, SRID 4326.

### 4. Leaflet et le SSR
Leaflet ne tourne pas côté serveur. Tout composant carte est chargé via `dynamic(..., { ssr: false })` — d'où les wrappers `*Dynamic.tsx` (`CarpoolMiniMapDynamic`, `EventMiniMapDynamic`).
`LeafletMap.tsx` gère son instance de façon **impérative via refs** : ne pas la réinitialiser au re-render, ne pas la convertir en composant déclaratif.

### 5. Auth
- Auth client-side via `supabase.auth` dans les composants.
- **`proxy.ts` à la racine** est le middleware (Next 16 a renommé `middleware.ts` → `proxy.ts`). Il rafraîchit les cookies de session via `getSession()` ; `protectedPaths` est **volontairement vide** — la protection des routes est faite dans les composants.
- Dans une page qui crée de la donnée : appeler `supabase.auth.getUser()` **après** avoir posé l'abonnement `onAuthStateChange`, sinon faux `null` juste après login.

#### Visibilité des données (migration 030)
La lecture de **`profiles`, `listings` et `events` est réservée aux comptes authentifiés** (`for select to authenticated`). Avant, ces tables étaient en `using (true)`, donc lisibles par le rôle `anon` — et la clé anon étant publique par conception, les adresses et coordonnées des foyers étaient accessibles sans compte.

> ⛔ **Le RLS est le seul verrou. L'UI n'est qu'un habillage.**
> Le voile sur la carte et les encarts « Réservé aux voisins » sont purement visuels — ils se contournent avec l'inspecteur ou en désactivant JS. Ils ne masquent rien : derrière, la base ne renvoie aucune ligne. Ne **jamais** afficher une donnée sensible en se reposant sur eux ; toute donnée se protège par une policy.

Conséquences à connaître :
- **`categories` reste volontairement en lecture publique** : `/api/keepalive` l'interroge avec la clé anon. Ne pas la fermer.
- Un Server Component qui lit `listings` / `profiles` / `events` doit poser `getUser()` **avant** son fetch et rediriger vers `/auth/login?redirect=…`, sinon la donnée est `null` et la page plante (le cas existait déjà sur `listings/[id]`). Même règle pour une page qui rend un formulaire d'écriture (cf. `evenements/new`).
- Les pages client restent navigables sans compte mais afficheraient une liste vide : elles utilisent **`components/layout/LoginRequiredNotice.tsx`** à la place. Toujours l'afficher derrière un flag « auth résolue » (et non `!isLoggedIn` seul), sinon l'encart clignote pour un utilisateur connecté.
- Sur `/map`, la carte reste rendue (sans marqueur) : elle est couverte par un **voile** (`.map-login-veil` dans `globals.css`, classe dédiée car `bg-white/80` échappe au bloc d'overrides dark). Sans lui, la vue mobile « Carte » n'afficherait aucune explication.
- **Limite assumée** : les buckets Storage `listings` et `events` restent publics (nécessaire pour `getPublicUrl`) — une image reste donc accessible par son URL directe, non devinable (`{userId}/{timestamp}.{ext}`). Passer aux signed URLs si ça devient un enjeu.
- L'inscription reste **ouverte** : il n'y a pas de notion de membre du lotissement (choix assumé, phase de lancement).

### 6. Migrations
- Source de vérité : `liquibase/changelog/` (**001 → 038** à ce jour) + `db.changelog-master.xml`.
- Ajouter une migration = créer `0NN-nom.sql` **et** l'enregistrer dans le master XML avec un commentaire descriptif.

#### ⚠️ Rétrocompatibilité obligatoire (2 bases : test + prod)
Le schéma et le code ne sont **jamais garantis synchrones** : une migration peut être passée sur test mais pas sur prod, et un déploiement Vercel peut précéder sa migration. Toute migration doit donc respecter le pattern **expand/contract** :
1. **Phase expand (la migration elle-même) : additive uniquement.** Nouvelles tables, colonnes (nullable ou avec default), vues, fonctions. Jamais de `DROP`/`RENAME`/changement de signature d'un objet encore référencé par du code déployé quelque part — l'ancien code doit tourner tel quel sur le nouveau schéma.
2. **Le nouveau code doit tolérer l'ancien schéma** : repli si le nouvel objet n'existe pas encore (exemple canonique : `MapView` retombe sur le RPC `listings_within_radius` tant que la vue `listings_geo` n'existe pas), ou dégradation silencieuse (les pages `/infos`, `/achats`, `/prestataires` s'affichent vides si leurs tables manquent).
3. **Phase contract (suppression) : dans une migration ultérieure**, une fois la précédente appliquée sur **les deux** bases et l'ancien code plus déployé nulle part — et retirer le repli côté code dans le même mouvement.
4. **Chaque changeset porte un `--rollback`** (cf. 031–036), pour que `npm run db:rollback <tag>` fonctionne. Poser un tag (`npm run db:tag`) avant chaque campagne de migrations.

Contre-exemple historique à ne pas reproduire : le `DROP FUNCTION` + `CREATE` du RPC (006→029) laissait la carte cassée pendant l'exécution et exigeait de re-synchroniser code et schéma au déploiement près.
- Les SQL de `supabase/` (`schema.sql`, `migration_*.sql`, `fix_rls_*.sql`) sont **de l'historique** — ne pas les utiliser comme référence courante.
- `liquibase/liquibase.properties` : copier depuis `.example`, ne jamais committer.

### 7. Edge Functions Supabase (`supabase/functions/`, Deno)
Exclues du `tsconfig.json` — les erreurs de type de l'éditeur y sont normales.
- `notify-new-listing` — webhook DB sur INSERT `listings` → email + push à tout le quartier (sauf l'auteur).
- `notify-new-message` — webhook DB sur INSERT `messages` → email + push aux autres participants.
- `expire-listings` — cron quotidien, passe en `termine` les annonces dont `expires_at` est dépassé.
- `_shared/fcm.ts` — signature JWT RS256 + FCM HTTP v1. Le code FCM est **dupliqué inline** dans les deux fonctions `notify-*` (contrainte de déploiement Deno) : toute correction doit être répliquée aux deux endroits.

---

## Modèle de données (essentiel)

**Tables** : `profiles`, `listings`, `categories`, `conversations`, `conversation_participants`, `messages`, `message_reactions`, `events`, `fcm_tokens`.

⚠️ La table de messagerie s'appelle **`messages`** en base, mais le type TS correspondant est **`DirectMessage`**. Le type `Message` de `lib/types.ts` est un legacy (messagerie par annonce) — ne pas l'utiliser pour du nouveau code.

**Tables** (suite, depuis 033–036) : `announcements` (infos ASL, écriture référents), `providers` (prestataires recommandés), `group_purchases` + `group_purchase_participants` (achats groupés, 1 participation/compte), `polls` / `poll_options` / `poll_votes` (sondages, création référents).

**Rôle référent** : `profiles.is_referent` (033) — un rôle, **pas** un contrôle d'inscription (celle-ci reste ouverte). Vérifié en base par la fonction `is_referent()` dans les policies, et côté UI par le hook `useCurrentUser()` de `lib/hooks.ts`. Premier référent à désigner à la main en SQL Editor.

**Modèle de droits (confirmé utilisateur, migrations 037-038)** : le **créateur** modifie et supprime SES contenus (annonce, événement, prestataire, achat groupé) ; un **référent** modifie et supprime TOUT — y compris les infos du lotissement et les sondages d'un autre référent, le statut des achats, et les images d'événements du bucket. Les updates conservent `author_id`/`created_by` (pas d'appropriation). Exception UI volontaire : les **options d'un sondage ne sont pas éditables** après création (des voisins ont pu voter) — seules question/description/clôture le sont. Un référent qui gère le contenu d'un autre voit des libellés suffixés « (référent) » (événements).

**RPC disponibles** : `contact_listing`, `validate_listing_response`, `cancel_listing_response`, `find_or_create_conversation`, `create_conversation`, `mark_conversation_read`, `is_conversation_participant`, `poll_results` (refuse les totaux tant qu'on n'a pas voté), `is_referent`. Vue : `listings_geo` (remplace `listings_within_radius`, obsolète mais encore en base).

**Sondages — règle appliquée en base** : `poll_votes` n'est lisible que par son auteur ; les totaux passent obligatoirement par `poll_results()`. Ne pas essayer de lire les votes des autres via PostgREST — c'est volontairement impossible.

**Cycle de vie d'une annonce** (piloté uniquement par RPC, jamais en `update` direct) :
```
disponible ──contact_listing──▶ en_cours ──validate_listing_response──▶ validee
     ◀──────────────── cancel_listing_response ────────────────────────────┘
```
`contact_listing` crée la conversation, pose `responder_id` + `conversation_id`. `validate`/`cancel` postent un message système (`is_system = true`).

**Buckets Storage** : `listings` et `events`, chemin `{userId}/{timestamp}.{ext}` ; l'URL publique est stockée dans `listings.image_url` / `events.image_urls[]`.

**Realtime activé** sur `messages` et `conversation_participants`. Canaux utilisés : `conv:{id}`, `typing:{id}` (broadcast), `messages_list_updates`, `navbar_unread`.

Détail complet des colonnes et de l'historique des migrations : [`memory/database.md`](./memory/database.md).

---

## Conventions de code

- **Valeurs métier en slugs français** : `ListingType` = `pret | don | echange | service | vente` · `ListingStatus` = `disponible | reserve | termine | en_cours | validee` · `ListingIntent` = `offre | demande`. Les labels et couleurs d'affichage sont des `Record<...>` exportés depuis `lib/types.ts` (`LISTING_TYPE_LABELS`, `LISTING_STATUS_COLORS`, `LISTING_TYPE_MARKER_COLORS`…) — ne pas redéfinir de mapping ailleurs.
- **Types partagés** : tout dans `lib/types.ts`.
- **Catégories** : source de vérité unique `lib/categories.ts` (`CATEGORY_LIST`, IDs stables 1–8, helpers `getCategoryEmoji`, `getCategoryCardClasses`, `getCategoryBorderOnlyClasses`, `FILTER_CATEGORIES`). Ne jamais coder en dur un emoji ou une couleur de catégorie.
- **Classes conditionnelles** : `cn()` de `lib/utils.ts` (clsx + tailwind-merge).
- **Palette** : `brand-*` (vert) pour les actions primaires — `brand-600` boutons, `brand-500` focus ring ; `warm-*` en accent secondaire. Éviter les hex en dur côté UI (exception assumée : couleurs de marqueurs Leaflet et templates email, qui ne passent pas par Tailwind).
- **Formatage** : helpers de `lib/utils.ts` (`formatDistance`, `formatDate`, `formatDateTime`, `formatChildcarePeriod`, `formatChildcareSlots`, `getAvatarStyle`) — locale `fr-FR`.
- **Recherche texte** : `normalizeSearch()` (insensible casse + accents), filtrage client-side.
- **Autocomplétion d'adresse** : `components/forms/AddressAutocomplete.tsx` utilise l'**API BAN** (`api-adresse.data.gouv.fr`) — Nominatim a été retiré. Retourne `ResolvedAddress { displayName, lat, lon, road, city }`. ⚠️ `memory/components.md` mentionne encore Nominatim.
- **Champs conditionnels du formulaire d'annonce** (par slug de catégorie) : `covoiturage` → adresses départ/arrivée + mini-carte (masque photo et adresse standard) ; `garde-enfant` → créneaux récurrents/ponctuels (`childcare_slots` JSONB, `day` 0=dimanche convention JS, heures `"HH:mm"`) et masque la photo ; `livre` → auteur / état / genre (`book_author`, `book_condition`, `book_genre` — tous optionnels) et **conserve la photo**, qui sert de couverture. `VENTE_EXCLUDED_SLUGS` interdit le type `vente` sur `covoiturage` et `garde-enfant` (mais pas sur `livre`).

### Dark mode
Classe `dark` sur `<html>`, posée par un script anti-FOUC inline dans `app/layout.tsx` + `ThemeProvider` (Context, `localStorage.theme` = `light | dark | system`).
Les overrides sombres sont un **gros bloc de surcharges `html.dark .bg-* { … !important }` dans `app/globals.css`**, pas des variantes `dark:` Tailwind. Conséquence : une nouvelle couleur Tailwind utilisée dans un composant n'aura **pas** de rendu sombre tant qu'elle n'est pas ajoutée à ce bloc.

**Tokens sémantiques (migration en cours)** : `globals.css` définit des variables (`--surface`, `--border`, `--text`…) exposées en utilitaires Tailwind — `bg-surface`, `bg-surface-raised/sunken`, `border-edge`, `border-edge-strong`, `text-content`, `text-content-soft/muted/faint`. Elles basculent seules en sombre : **tout nouveau composant doit les utiliser** (plus rien à déclarer dans le bloc `!important`). L'existant migre zone par zone ; le bloc de surcharges reste en place pour le non-migré. Pages déjà en tokens : `/infos`, `/achats`, `/prestataires`, `LoginRequiredNotice`, voile de la carte.

### CSP
`next.config.js` définit une CSP stricte et des en-têtes de sécurité. Tout nouveau domaine externe (API, CDN, tuiles) **doit être ajouté à la directive correspondante**, sinon la requête est bloquée en prod. Domaines autorisés aujourd'hui : Supabase (+ `wss://`), tuiles OSM, `unpkg.com` (images Leaflet), `api-adresse.data.gouv.fr`, `www.gstatic.com` (scripts Firebase du SW), `*.googleapis.com`, `*.firebase*.com`.

---

## Cartographie du code

```
app/
  page.tsx            # Landing publique
  accueil/            # Dashboard post-login (DashboardClient)
  map/                # Carte principale (MapView)
  recent/             # Derniers ajouts
  listings/           # new/ · [id]/ · [id]/edit/
  demandes/           # Mes demandes envoyées / reçues (DemandesClient)
  evenements/         # Liste · new/ · [id]/ · [id]/edit/
  messages/           # Liste · new/ · [id]/ conversation
  profile/            # Mon profil (ProfileClient, 880 lignes)
  profil/[id]/        # Profil public
  (quartier)/         # Route group (n'affecte pas les URLs) : layout commun avec onglets (QuartierTabs)
    infos/            # « Vie du quartier » : AnnouncementsSection + PollsSection (référents)
    achats/           # Achats groupés (quantité + seuil, participations)
    prestataires/     # Carnet de prestataires recommandés
  auth/               # login/ · register/
  api/                # notifications · internal/send-email · account/delete · firebase-messaging-sw
components/
  map/        # LeafletMap, MapView, FilterBar, Event*, *MiniMap(+Dynamic), MiniCalendar
  listings/   # ListingForm, ListingCard, ListingActions, ContactButton, StatusBadge, TypeBadge
  messages/   # MessageBubble, ConversationRow, TypingIndicator
  forms/      # AddressAutocomplete, EventForm
  layout/     # Navbar, QuartierTabs, LoginRequiredNotice, FirebaseSWRegister, PWAInstallBanner, PushNotificationBanner
  profile/ profil/ theme/
lib/          # supabase/{client,server}, types, categories, neighborhood, hooks, utils,
              # firebase, fcm-admin, pushNotifications, email-notifications
liquibase/    # changelog/001→036 + db.changelog-master.xml
supabase/     # functions/ (Deno, actives) + SQL legacy (référence seulement)
scripts/      # db-migrate.js (pilote Liquibase)
proxy.ts      # Middleware Next 16 (refresh cookies)
```

Fichiers les plus lourds (attention aux gros refactors) : `app/profile/ProfileClient.tsx` (879 l.), `components/listings/ListingForm.tsx` (~620 l.), `app/messages/[id]/page.tsx` (497 l.).

⚠️ **Formulaire d'annonce** : toute la logique vit dans **`components/listings/ListingForm.tsx`** (`mode="create" | "edit"`). `app/listings/new/page.tsx` et `app/listings/[id]/edit/page.tsx` ne sont plus que des coquilles qui chargent les données et posent les gardes. Ne pas dupliquer de champ dans une des deux pages — les deux modes doivent rester alignés (c'est précisément la divergence qui faisait perdre `childcare_mode` / `childcare_slots` à l'édition avant le 2026-08-03).

Détail des composants : [`memory/components.md`](./memory/components.md) · Architecture : [`memory/architecture.md`](./memory/architecture.md).

---

## Variables d'environnement (`.env.local`)

Client (`NEXT_PUBLIC_*`) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`, `FIREBASE_VAPID_KEY`. Optionnelles (défauts dans `lib/neighborhood.ts`) : `NEIGHBORHOOD_LAT`, `NEIGHBORHOOD_LNG`, `NEIGHBORHOOD_ZOOM`, `NEIGHBORHOOD_RADIUS_KM`.

Serveur : `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `INTERNAL_EMAIL_SECRET`, `FCM_SERVICE_ACCOUNT_JSON` (JSON brut ou base64).

Côté Edge Functions (secrets Supabase) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT_JSON`, `INTERNAL_EMAIL_SECRET`, `APP_URL`.

Les intégrations sont **dégradables** : email et push sont des no-op silencieux si leurs variables ne sont pas définies. Ne pas faire échouer un flux métier pour un envoi de notification.

---

## Keepalive Supabase (plan gratuit)

Un projet Supabase gratuit est mis en pause après **~7 jours sans activité**, et ce sont les **requêtes API entrantes** qui comptent : les jobs internes (pg_cron, cron de l'Edge Function `expire-listings`) ne suffisent pas de façon fiable.

Dispositif en place, à deux niveaux :

| Mécanisme | Fichier | Fréquence |
|---|---|---|
| Cron Vercel (principal) | `vercel.json` → `/api/keepalive` | quotidien, 06:00 UTC |
| GitHub Actions (filet) | `.github/workflows/supabase-keepalive.yml` | tous les 3 jours |

`app/api/keepalive/route.ts` fait une vraie lecture PostgREST (`categories`, 1 ligne, table en lecture publique), sans écriture ni donnée personnelle. `dynamic = 'force-dynamic'` : la route ne doit **jamais** être mise en cache, sinon elle ne touche plus la base. Renvoie 500 si Supabase répond en erreur, pour qu'un monitor alerte.

`.github/workflows/supabase-keepalive.yml` fait **deux** pings : la route Vercel ci-dessus, puis un appel PostgREST direct sur `categories` — celui-ci reste vert même si Vercel est en panne, ce qui est tout l'intérêt d'un filet. Le second step est conditionné par `if: ${{ env.SUPABASE_ANON_KEY != '' && env.SUPABASE_URL != '' }}`, alimenté par deux **secrets du dépôt GitHub** (`SUPABASE_URL`, `SUPABASE_ANON_KEY` — posés, workflow vert depuis le 2026-08-04). À saisir en valeur **nue** : le step normalise préfixe `VAR=`, guillemets, espaces et slash final, mais c'est un filet de rattrapage, pas la norme.

Durcissement optionnel : définir `CRON_SECRET` côté Vercel — la route l'exige alors en `Authorization: Bearer`, et le cron Vercel l'envoie automatiquement. ⚠️ Dans ce cas il faut **aussi** l'ajouter en secret du dépôt GitHub, sinon le premier step du workflow tombe en 401.

Rappels :
- Un keepalive **ne réveille pas** un projet déjà en pause — la restauration est manuelle depuis le dashboard Supabase.
- Plan Hobby Vercel : 2 crons max, fréquence quotidienne uniquement, déclenchement « best effort » dans l'heure.
- GitHub désactive les workflows planifiés après 60 jours d'inactivité du dépôt (mail d'avertissement, réactivation en un clic).

## Points de vigilance connus

- ✅ **`scripts/db-migrate.js` ne contient plus de secret** : il lit `SUPABASE_DB_PASSWORD` depuis `.env.local` (dotenv), déduit l'utilisateur du pooler depuis `NEXT_PUBLIC_SUPABASE_URL`, et redacte le mot de passe dans ses messages d'erreur. Surcharges possibles : `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_POOLER_HOST`.
- 🟡 **Alerte Advisor `spatial_ref_sys` : sujet clos, on vit avec.** La table appartient à `supabase_admin` et les quatre leviers sont tous testés et fermés : `ENABLE ROW LEVEL SECURITY` (027), `ALTER EXTENSION postgis SET SCHEMA` (026), `REVOKE SELECT` (031 — ne lève même pas d'erreur, juste un `WARNING`) , `SET ROLE supabase_admin` (`42501`) et `DROP EXTENSION` + recréation dans `extensions` (l'extension elle-même a `owner = supabase_admin` et `extrelocatable = false` — PostGIS est une *trusted extension*, donc installée « comme par un superuser » même quand c'est Liquibase qui la demande). **Ne pas rejouer ces pistes** : cinq migrations et deux tests SQL s'y sont déjà cassé les dents (023, 025, 026, 027, 031). Ne pas non plus basculer PostGIS depuis la page Extensions du dashboard sans préparation : la désactivation `cascade` emporterait `listings.location`, l'index GIST et les RPC géo. Le contenu de la table est le catalogue EPSG, public par nature — zéro donnée du quartier ; la vraie fermeture des données est la migration 030. Rouvrir le sujet = réinstaller PostGIS dans `extensions` via le dashboard (destructif) ou passer par le support Supabase. Détail dans [`memory/database.md`](./memory/database.md).
- **La base n'est pas joignable depuis la session agent** (`Connect timed out` sur le pooler 6543) : les commandes `db:status` / `db:migrate` sont à lancer par l'utilisateur.
- **GitHub Actions — le contexte `secrets` est interdit dans un `if:`**, au niveau job comme step. L'expression ne compile pas et c'est le **workflow entier** qui devient invalide : aucun job créé. Symptômes à reconnaître (vécus sur le keepalive) : « No jobs were run » côté UI, des runs créés sur `push` alors que le workflow n'écoute pas `push`, et un run nommé d'après le **chemin du fichier** au lieu de son `name:`. Contournement : recopier le secret dans un `env:` de **job** (où `secrets` est autorisé) et tester `env.*` dans le `if:`.
- **Diagnostiquer un run Actions depuis la session** : `gh` n'est pas installé et il n'y a aucun token GitHub — déclencher un `workflow_dispatch` ou écrire un secret sont des actions **manuelles**, comme les `db:*`. En lecture le dépôt (`Yarzou/neighborshare`) est public, donc l'API anonyme suffit et évite de faire copier-coller des logs : `…/actions/runs/<id>/jobs` donne la `conclusion` de **chaque step**, et `jobs.total_count: 0` signe un startup failure.
- **Ne jamais journaliser un secret, même normalisé** : GitHub ne masque que la chaîne exacte, donc une valeur transformée (trim, retrait de préfixe) ressortirait **en clair** dans les logs. Le seul signal publiable est sa **longueur** — c'est ce que fait le step PostgREST, et c'est ce qui a permis de diagnostiquer un préfixe resté collé.
- **Dette de lint** : 40 avertissements pré-existants, dont 16 `react-hooks/set-state-in-effect` (règle apparue avec eslint-plugin-react-hooks 7) volontairement rétrogradée en `warn` dans `eslint.config.mjs` — voir le commentaire du fichier. À traiter progressivement, pas en bloc (aucun test pour couvrir un refactor d'effets).
- Documentation partiellement obsolète : `README.md` et `.github/copilot-instructions.md` annoncent Next.js 14, `middleware.ts` et Nominatim. `memory/` a été réaligné le 2026-07-28 — le maintenir à jour en fin de session.
- `JAVA_HOME` doit pointer vers un JDK existant pour les commandes `db:*` (Liquibase est un outil Java).
- `.next/`, `node_modules/`, `tsconfig.tsbuildinfo` sont présents sur le disque : ne jamais les lire ni les indexer.

---

## Workflow attendu d'une session

1. Lire [`memory/`](./memory/) — évite de rescanner le projet.
2. Coder ; vérifier avec `npm run lint` (et `npx tsc --noEmit` si les types bougent).
3. Si le schéma change : nouvelle migration numérotée + entrée dans le master XML + mise à jour du RPC si une colonne doit remonter sur la carte.
4. Consigner ce qui a été fait dans [`memory/changelog.md`](./memory/changelog.md) (une section par date, fichier par fichier).
5. **S'arrêter là.** Pas de commit, pas de push — validation humaine.
