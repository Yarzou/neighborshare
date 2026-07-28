# Architecture & Stack

> Dernière vérification : 2026-07-28 (lecture complète du dépôt).

## Tech Stack
- **Framework** : Next.js 16.2.4 (App Router, `app/`) — ⚠️ le `README.md` annonce encore « Next.js 14 »
- **React** : 19
- **TypeScript** : 5, `strict: true`, alias `@/*` → racine du projet
- **Base de données** : Supabase (PostgreSQL + PostGIS)
- **Carte** : Leaflet 1.9.4 + leaflet.markercluster + tuiles OpenStreetMap
- **Styles** : Tailwind CSS 3 (`darkMode: 'class'`) + `cn()` (clsx + tailwind-merge)
- **Icônes** : `lucide-react`
- **Auth** : Supabase Auth via `@supabase/ssr` (client-side)
- **Notifications** : Firebase Cloud Messaging (FCM) + Nodemailer (SMTP Gmail)
- **Fonts** : Geist Sans / Geist Mono (paquet `geist`)
- **State** : useState/useEffect + React Context (`ThemeProvider`). **Zustand est installé mais non utilisé.**
- **Package manager** : **npm** (`package-lock.json` présent) — le champ `packageManager: yarn@1.22.22` du `package.json` est une incohérence non résolue
- **Tests** : aucun. Pas de `npm test`. Vérifications : `npm run lint` + `npm run typecheck` + `npm run build`
- **Lint** : `eslint.config.mjs` (flat config ESLint 9, `eslint-config-next/core-web-vitals`). `next lint` supprimé dans Next 16, `.eslintrc.json` supprimé (plus lu par ESLint 9). Base : 0 erreur / 40 avertissements pré-existants. `react-hooks/set-state-in-effect` rétrogradée en `warn` (16 occurrences de code pré-existant)
- **Déploiement** : Vercel — domaine de production **`voisinsducedre.vercel.app`**. `neighborshare-liard.vercel.app` est un ancien alias qui redirige en 307 (encore utilisé comme valeur par défaut d'`APP_URL` dans les Edge Functions)

Nom public de l'app : **« Les voisins du Cèdre »** (nom technique du dépôt : `neighborshare`). PWA installable (`public/manifest.json`, thème `#16a34a`).

## Commandes
```bash
npm run dev          # Dev server http://localhost:3000
npm run build        # Build prod
npm run lint         # ESLint 9 flat config (eslint .)
npm run lint:fix     # ESLint --fix
npm run typecheck    # tsc --noEmit

npm run db:status    # Migrations en attente
npm run db:migrate   # Applique les migrations
npm run db:rollback  # → node scripts/db-migrate.js rollback <tag>
npm run db:validate  # Valide le changelog
npm run db:tag       # Pose un tag (point de rollback)
```

Les commandes `db:*` nécessitent un **JDK fonctionnel** (Liquibase est un outil Java) : si `JAVA_HOME` pointe vers un JDK inexistant, elles échouent avant même de se connecter.

## Structure des dossiers
```
app/
  page.tsx          # Landing publique
  accueil/          # Dashboard post-login (DashboardClient.tsx)
  map/              # Carte principale (MapView)
  recent/           # Derniers ajouts
  listings/         # new/ · [id]/ · [id]/edit/
  demandes/         # Mes demandes envoyées / reçues (DemandesClient.tsx)
  evenements/       # Liste · new/ · [id]/ · [id]/edit/
  messages/         # Liste (MessagesClient) · new/ · [id]/ conversation
  profile/          # Mon profil (ProfileClient.tsx, 879 l.)
  profil/[id]/      # Profil public
  auth/             # login/ (LoginClient) · register/
  api/              # notifications · internal/send-email · account/delete · firebase-messaging-sw
components/
  layout/           # Navbar, FirebaseSWRegister, PWAInstallBanner, PushNotificationBanner
  map/              # LeafletMap, MapView, FilterBar, Event*, *MiniMap(+Dynamic), MiniCalendar
  listings/         # ListingCard, ListingActions, ContactButton, StatusBadge, TypeBadge
  messages/         # MessageBubble, ConversationRow, TypingIndicator
  forms/            # AddressAutocomplete, EventForm
  profil/           # PublicProfileAccordion
  profile/          # NotificationSettings
  theme/            # ThemeProvider
lib/
  supabase/         # client.ts (navigateur) | server.ts (Server Components, async)
  types.ts          # Tous les types partagés + labels/couleurs
  categories.ts     # Source de vérité des catégories
  utils.ts          # cn(), normalizeSearch(), format*(), avatar helpers
  firebase.ts       # Firebase client + enregistrement SW + token FCM
  fcm-admin.ts      # firebase-admin (push serveur), nettoie les tokens invalides
  pushNotifications.ts   # activate/deactivate push (écrit fcm_tokens + profiles)
  email-notifications.ts # Nodemailer + templates HTML des emails
liquibase/
  changelog/        # SQL numérotés 001 → 027
  db.changelog-master.xml
supabase/
  functions/        # Edge Functions Deno (actives)
  *.sql             # SQL historique — référence seulement, PAS la source de vérité
scripts/db-migrate.js  # Pilote Liquibase (lit .env.local)
proxy.ts               # Middleware Next 16 (ex-middleware.ts)
```

Fichiers les plus lourds (prudence sur les refactors) : `app/profile/ProfileClient.tsx` (879 l.), `app/listings/new/page.tsx` (597 l.), `app/messages/[id]/page.tsx` (497 l.), `app/listings/[id]/edit/page.tsx` (478 l.), `app/demandes/DemandesClient.tsx` (387 l.), `components/forms/EventForm.tsx` (383 l.).

## Clients Supabase — Règle critique
| Contexte | Import |
|---|---|
| Composants `'use client'` | `import { createClient } from '@/lib/supabase/client'` |
| Server Components / Route Handlers | `import { createClient } from '@/lib/supabase/server'` (async) |

Mélanger les deux cause des erreurs de cookies/session.

## Pattern de données
- **Lectures/écritures métier côté client** via le client navigateur. Pas de Server Actions. Quelques Server Components font du fetch de lecture (`app/accueil/page.tsx`, `app/listings/[id]/page.tsx`, `app/profil/[id]/page.tsx`).
- Les annonces géolocalisées passent toujours par le RPC PostGIS :
  ```ts
  supabase.rpc('listings_within_radius', { lat, lng, radius_km })
  // Retourne : distance_m, lat_out, lng_out + champs listing
  // Seules les annonces avec lat_out/lng_out sont affichées sur la carte
  ```
  ⚠️ Une nouvelle colonne de `listings` à afficher sur la carte doit être ajoutée au `RETURNS TABLE` du RPC via une migration (cf. 006, 008).

## Routes API — uniquement ce qui exige un secret serveur
| Route | Rôle |
|---|---|
| `POST /api/notifications` | Push + email sur `new_request` \| `accepted` \| `refused` \| `cancelled`. Vérifie la session, puis service role pour lire listing/profil/email |
| `POST /api/internal/send-email` | Proxy email appelé par les Edge Functions, protégé par l'en-tête `x-internal-secret` |
| `DELETE /api/account/delete` | Suppression de compte : remet à `null` les `responder_id` pointant l'utilisateur, puis `auth.admin.deleteUser` (cascade) |
| `GET /api/firebase-messaging-sw` | Sert le Service Worker FCM avec la config injectée côté serveur (`Service-Worker-Allowed: /`) |
| `GET /api/keepalive` | Ping anti-mise-en-pause Supabase (voir section dédiée) |

## Keepalive Supabase (plan gratuit)
Un projet Supabase gratuit est mis en pause après **~7 jours sans activité**, et l'activité mesurée
est celle des **requêtes API entrantes** : les jobs internes (pg_cron, cron de `expire-listings`) ne
suffisent pas de façon fiable.

| Mécanisme | Fichier | Fréquence |
|---|---|---|
| Cron Vercel (principal) | `vercel.json` → `/api/keepalive` | quotidien, 06:00 UTC |
| GitHub Actions (filet) | `.github/workflows/supabase-keepalive.yml` | tous les 3 jours, 07:00 UTC |

`app/api/keepalive/route.ts` : lecture PostgREST réelle (`categories`, 1 ligne, RLS `select using (true)`),
sans écriture. `dynamic = 'force-dynamic'` + `revalidate = 0` — la route ne doit **jamais** être mise
en cache, sinon elle cesse de toucher la base. Renvoie 500 en cas d'erreur Supabase (pour alerter).
`CRON_SECRET` (optionnel, côté Vercel) : si défini, la route exige `Authorization: Bearer` ; le cron
Vercel l'envoie automatiquement.

Limites à connaître :
- Un keepalive **ne réveille pas** un projet déjà en pause → restauration manuelle au dashboard.
- Vercel Hobby : 2 crons max, quotidiens uniquement, déclenchement « best effort » dans l'heure.
- GitHub désactive les workflows planifiés après 60 jours d'inactivité du dépôt.

## Edge Functions Supabase (`supabase/functions/`, Deno)
Exclues du `tsconfig.json` — les erreurs de type de l'éditeur y sont normales.
- `notify-new-listing` — webhook DB sur INSERT `listings` → email + push à tous les voisins sauf l'auteur
- `notify-new-message` — webhook DB sur INSERT `messages` → email + push aux autres participants
- `expire-listings` — cron quotidien, passe en `termine` les annonces dont `expires_at` est dépassé
- `_shared/fcm.ts` — OAuth2 JWT RS256 + FCM HTTP v1. ⚠️ Ce code est **dupliqué inline** dans les deux `notify-*` : toute correction doit être répliquée aux deux endroits.

## Auth
- Auth client-side via `supabase.auth`
- **`proxy.ts` à la racine** est le middleware (Next 16 a renommé `middleware.ts` → `proxy.ts`). Il rafraîchit les cookies via `getSession()` (volontairement, pas `getUser()` : pas d'appel réseau, donc pas de faux logout). `protectedPaths` est **vide** — la protection est faite dans les composants.
- Dans les pages créant de la data : appeler `supabase.auth.getUser()` **après** `onAuthStateChange` pour éviter les faux nulls

## Leaflet / SSR
- Leaflet ne peut pas tourner côté serveur
- Tous les composants map chargés avec `dynamic(..., { ssr: false })` — d'où les wrappers `*Dynamic.tsx`
- `LeafletMap` gère son instance Leaflet de façon impérative via refs (ne pas réinitialiser au re-render, ne pas « déclarativiser »)

## Dark mode
- Classe `dark` sur `<html>`, posée par un script anti-FOUC inline dans `app/layout.tsx`
- Géré par `ThemeProvider` (**React Context**, pas Zustand) — `localStorage.theme` = `light | dark | system`, écoute `prefers-color-scheme`
- Les surcharges sombres sont un **gros bloc `html.dark .bg-* { … !important }` dans `app/globals.css`**, et non des variantes `dark:` Tailwind
- ⚠️ Conséquence : une couleur Tailwind nouvellement utilisée n'a **aucun** rendu sombre tant qu'elle n'est pas ajoutée à ce bloc

## Sécurité / en-têtes (`next.config.js`)
CSP stricte + `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (géoloc `self` uniquement).
Tout nouveau domaine externe doit être ajouté à la directive CSP correspondante, sinon il est bloqué en prod.
Autorisés aujourd'hui : Supabase (+ `wss://`), tuiles OSM, `unpkg.com` (images Leaflet), `api-adresse.data.gouv.fr`, `www.gstatic.com`, `*.googleapis.com`, `*.firebase*.com`.
`images.remotePatterns` n'autorise que `**.supabase.co`.

## Variables d'environnement
Client (`NEXT_PUBLIC_*`) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`, `FIREBASE_VAPID_KEY`.

Serveur : `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `INTERNAL_EMAIL_SECRET`, `FCM_SERVICE_ACCOUNT_JSON` (JSON brut ou base64).

Edge Functions (secrets Supabase) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT_JSON`, `INTERNAL_EMAIL_SECRET`, `APP_URL`.

Email et push sont **dégradables** : no-op silencieux si leurs variables manquent. Ne jamais faire échouer un flux métier pour un envoi de notification.
