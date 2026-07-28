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

Déploiement : Vercel (`neighborshare-liard.vercel.app`).

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
- `GET /api/keepalive` — ping anti-mise-en-pause de Supabase (voir plus bas).
- `POST /api/internal/send-email` — proxy email appelé par les Edge Functions, protégé par l'en-tête `x-internal-secret`.
- `DELETE /api/account/delete` — suppression de compte (service role, cascade).
- `GET /api/firebase-messaging-sw` — sert le Service Worker FCM avec la config injectée côté serveur (en-tête `Service-Worker-Allowed: /`).

### 3. Géolocalisation : toujours via le RPC PostGIS
```ts
supabase.rpc('listings_within_radius', { lat, lng, radius_km })
// → champs listing + distance_m, lat_out, lng_out
```
Seules les annonces avec `lat_out`/`lng_out` sont affichées sur la carte.
Insertion de position : WKT `POINT(lng lat)` — **longitude d'abord**, SRID 4326.
⚠️ Toute nouvelle colonne de `listings` à afficher sur la carte doit être **ajoutée au `RETURNS TABLE` du RPC** dans une nouvelle migration (cf. 006, 008).

### 4. Leaflet et le SSR
Leaflet ne tourne pas côté serveur. Tout composant carte est chargé via `dynamic(..., { ssr: false })` — d'où les wrappers `*Dynamic.tsx` (`CarpoolMiniMapDynamic`, `EventMiniMapDynamic`).
`LeafletMap.tsx` gère son instance de façon **impérative via refs** : ne pas la réinitialiser au re-render, ne pas la convertir en composant déclaratif.

### 5. Auth
- Auth client-side via `supabase.auth` dans les composants.
- **`proxy.ts` à la racine** est le middleware (Next 16 a renommé `middleware.ts` → `proxy.ts`). Il rafraîchit les cookies de session via `getSession()` ; `protectedPaths` est **volontairement vide** — la protection des routes est faite dans les composants.
- Dans une page qui crée de la donnée : appeler `supabase.auth.getUser()` **après** avoir posé l'abonnement `onAuthStateChange`, sinon faux `null` juste après login.

### 6. Migrations
- Source de vérité : `liquibase/changelog/` (**001 → 027** à ce jour) + `db.changelog-master.xml`.
- Ajouter une migration = créer `0NN-nom.sql` **et** l'enregistrer dans le master XML avec un commentaire descriptif.
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

**RPC disponibles** : `listings_within_radius`, `contact_listing`, `validate_listing_response`, `cancel_listing_response`, `find_or_create_conversation`, `create_conversation`, `mark_conversation_read`, `is_conversation_participant`.

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
- **Catégories** : source de vérité unique `lib/categories.ts` (`CATEGORY_LIST`, IDs stables 1–7, helpers `getCategoryEmoji`, `getCategoryCardClasses`, `getCategoryBorderOnlyClasses`, `FILTER_CATEGORIES`). Ne jamais coder en dur un emoji ou une couleur de catégorie.
- **Classes conditionnelles** : `cn()` de `lib/utils.ts` (clsx + tailwind-merge).
- **Palette** : `brand-*` (vert) pour les actions primaires — `brand-600` boutons, `brand-500` focus ring ; `warm-*` en accent secondaire. Éviter les hex en dur côté UI (exception assumée : couleurs de marqueurs Leaflet et templates email, qui ne passent pas par Tailwind).
- **Formatage** : helpers de `lib/utils.ts` (`formatDistance`, `formatDate`, `formatDateTime`, `formatChildcarePeriod`, `formatChildcareSlots`, `getAvatarStyle`) — locale `fr-FR`.
- **Recherche texte** : `normalizeSearch()` (insensible casse + accents), filtrage client-side.
- **Autocomplétion d'adresse** : `components/forms/AddressAutocomplete.tsx` utilise l'**API BAN** (`api-adresse.data.gouv.fr`) — Nominatim a été retiré. Retourne `ResolvedAddress { displayName, lat, lon, road, city }`. ⚠️ `memory/components.md` mentionne encore Nominatim.
- **Champs conditionnels du formulaire d'annonce** (par slug de catégorie) : `covoiturage` → adresses départ/arrivée + mini-carte (masque photo et adresse standard) ; `garde-enfant` → créneaux récurrents/ponctuels (`childcare_slots` JSONB, `day` 0=dimanche convention JS, heures `"HH:mm"`) et masque la photo. `VENTE_EXCLUDED_SLUGS` interdit le type `vente` sur `covoiturage` et `garde-enfant`.

### Dark mode
Classe `dark` sur `<html>`, posée par un script anti-FOUC inline dans `app/layout.tsx` + `ThemeProvider` (Context, `localStorage.theme` = `light | dark | system`).
Les overrides sombres sont un **gros bloc de surcharges `html.dark .bg-* { … !important }` dans `app/globals.css`**, pas des variantes `dark:` Tailwind. Conséquence : une nouvelle couleur Tailwind utilisée dans un composant n'aura **pas** de rendu sombre tant qu'elle n'est pas ajoutée à ce bloc.

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
  auth/               # login/ · register/
  api/                # notifications · internal/send-email · account/delete · firebase-messaging-sw
components/
  map/        # LeafletMap, MapView, FilterBar, Event*, *MiniMap(+Dynamic), MiniCalendar
  listings/   # ListingCard, ListingActions, ContactButton, StatusBadge, TypeBadge
  messages/   # MessageBubble, ConversationRow, TypingIndicator
  forms/      # AddressAutocomplete, EventForm
  layout/     # Navbar, FirebaseSWRegister, PWAInstallBanner, PushNotificationBanner
  profile/ profil/ theme/
lib/          # supabase/{client,server}, types, categories, utils, firebase, fcm-admin,
              # pushNotifications, email-notifications
liquibase/    # changelog/001→027 + db.changelog-master.xml
supabase/     # functions/ (Deno, actives) + SQL legacy (référence seulement)
scripts/      # db-migrate.js (pilote Liquibase)
proxy.ts      # Middleware Next 16 (refresh cookies)
```

Fichiers les plus lourds (attention aux gros refactors) : `app/profile/ProfileClient.tsx` (879 l.), `app/listings/new/page.tsx` (597 l.), `app/messages/[id]/page.tsx` (497 l.), `app/listings/[id]/edit/page.tsx` (478 l.).

Détail des composants : [`memory/components.md`](./memory/components.md) · Architecture : [`memory/architecture.md`](./memory/architecture.md).

---

## Variables d'environnement (`.env.local`)

Client (`NEXT_PUBLIC_*`) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`, `FIREBASE_VAPID_KEY`.

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

Durcissement optionnel : définir `CRON_SECRET` côté Vercel — la route l'exige alors en `Authorization: Bearer`, et le cron Vercel l'envoie automatiquement.

Rappels :
- Un keepalive **ne réveille pas** un projet déjà en pause — la restauration est manuelle depuis le dashboard Supabase.
- Plan Hobby Vercel : 2 crons max, fréquence quotidienne uniquement, déclenchement « best effort » dans l'heure.
- GitHub désactive les workflows planifiés après 60 jours d'inactivité du dépôt (mail d'avertissement, réactivation en un clic).

## Points de vigilance connus

- 🔴 **`scripts/db-migrate.js` contient un mot de passe de base en dur** (et l'URL du pooler + l'identifiant du projet Supabase), alors que le script prétend lire `SUPABASE_DB_PASSWORD`. À basculer sur la variable d'environnement. En attendant : **ne pas dupliquer ce secret ailleurs, ne pas l'afficher dans une réponse, ne pas le committer dans un autre fichier.**
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
