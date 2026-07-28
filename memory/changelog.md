# Historique des modifications (par session)

## 2026-07-28 — Documentation & secrets Liquibase

### Enrichissement de `CLAUDE.md`
Passage de 15 à ~230 lignes après lecture complète du dépôt : identité du projet, stack réelle
(Next.js **16.2.4** + React 19, pas Next 14), rôle des 4 routes API, Edge Functions, modèle de
données, cycle de vie d'une annonce, conventions, pièges (dark mode `!important`, CSP), variables
d'environnement, workflow de session.

### Suppression des secrets versionnés
**`scripts/db-migrate.js`**
- Le mot de passe de la base était **en dur** (`const dbPassword = '…'`), rendant inutile le test
  `if (!dbPassword)` qui suivait. Idem pour l'URL du pooler et l'identifiant du projet.
- Charge maintenant `.env.local` via `dotenv` et lit `SUPABASE_DB_PASSWORD`.
- L'utilisateur du pooler est **déduit** de `NEXT_PUBLIC_SUPABASE_URL` (`postgres.<project_ref>`) ;
  surcharges possibles : `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_POOLER_HOST`.
- Ajout d'un `redact()` sur les erreurs : `node-liquibase` inclut la commande complète — donc le
  mot de passe en clair — dans ses messages d'échec.
- Vérifié : la commande générée est identique à l'ancienne (même url/username/password).

**`liquibase/liquibase.properties.example`**
- Le template **versionné** contenait lui aussi le vrai mot de passe et l'URL du projet.
- Réduit à `driver` / `changeLogFile` / `outputDefaultSchema` ; `url`/`username`/`password` sont
  commentés avec des placeholders, pour le cas où l'on appelle la CLI Liquibase directement.

⚠️ **Reste à faire (humain)** : le mot de passe est dans l'historique git → le **roter** dans le
dashboard Supabase, puis mettre à jour `.env.local` et `liquibase/liquibase.properties`.

### Mise à jour de `memory/`
`architecture.md`, `components.md`, `database.md` réalignés sur le code : `proxy.ts` (et non
`middleware.ts`, renommage Next 16), API **BAN** (et non Nominatim), migrations jusqu'à **027**,
table `messages` ↔ type `DirectMessage` (`Message` = legacy), `ThemeProvider` en React Context (et
non Zustand), npm (et non yarn), aucune suite de tests, buckets `listings` + `events`, liste des
RPC et cycle de vie des annonces, CSP et bloc dark mode `!important`.

### Keepalive Supabase (projet mis en pause pour inactivité)
Cause : plan gratuit → pause après ~7 jours sans **requête API**. Les jobs internes (pg_cron, cron de
l'Edge Function `expire-listings`) ne comptent pas de façon fiable.

**`app/api/keepalive/route.ts`** (nouveau)
- `GET` → lecture PostgREST réelle : `categories` limit 1 (RLS `select using (true)`), aucune écriture.
- `dynamic = 'force-dynamic'` + `revalidate = 0` : sans ça, la route serait mise en cache et ne
  toucherait plus la base — le keepalive deviendrait silencieusement inopérant.
- Renvoie 500 sur erreur Supabase pour qu'un monitor externe alerte.
- Durcissement optionnel : si `CRON_SECRET` est défini, exige `Authorization: Bearer` (envoyé
  automatiquement par le cron Vercel).

**`vercel.json`** (nouveau) — cron quotidien `0 6 * * *` sur `/api/keepalive`. Mécanisme principal.

**`.github/workflows/supabase-keepalive.yml`** (nouveau) — filet tous les 3 jours, au cas où le cron
Vercel serait désactivé sans bruit. Étape 1 : ping de la route (aucun secret requis, URL surchargeable
via la variable `KEEPALIVE_URL`). Étape 2 (optionnelle) : ping PostgREST direct si les secrets
`SUPABASE_URL` / `SUPABASE_ANON_KEY` existent — indépendant de Vercel.

Vérifié : `npx tsc --noEmit` OK, `npm run build` OK (`/api/keepalive` listée en route dynamique `ƒ`).

⚠️ **Reste à faire (humain)** : restaurer le projet depuis le dashboard Supabase — un keepalive ne
réveille pas un projet déjà en pause. Puis déployer pour que le cron Vercel soit enregistré.

### Remise en service du lint (ESLint 9 flat config)
Diagnostic : `npm run lint` → `next lint` supprimé dans Next 16 (« Invalid project directory
provided, no such directory: …\lint »), et `npx eslint` → ESLint 9 exige `eslint.config.js` alors
que le projet avait un `.eslintrc.json`. Plus aucun lint ne tournait.

**`eslint.config.mjs`** (nouveau) — `eslint-config-next@16.2.4` exporte déjà des tableaux de flat
configs, donc `...nextCoreWebVitals` suffit. `ignores` : `.next`, `out`, `build`, `public`, `.idea`,
`next-env.d.ts`, `supabase/functions` (Deno, déjà hors tsconfig).

**`.eslintrc.json`** — supprimé (plus lu par ESLint 9, source de confusion).

**`package.json`** — `lint: "eslint ."`, + `lint:fix` et `typecheck` (`tsc --noEmit`).

Premier passage : 19 erreurs / 25 avertissements. Traitement :
- `react-hooks/immutability` ×2 dans **`app/accueil/DashboardClient.tsx`** — l'effet référençait
  `fetchUnread` / `fetchPendingRequests` déclarés plus bas (lecture en zone morte). Effet déplacé
  **après** les deux fonctions. Corrigé.
- `react/no-unescaped-entities` ×1 — apostrophe échappée en `&apos;` (même fichier). Corrigé.
- `react-hooks/set-state-in-effect` ×16 — règle apparue avec eslint-plugin-react-hooks 7 (React
  Compiler). Code pré-existant, essentiellement de l'init d'état côté client (localStorage,
  navigator, session Supabase) inévaluable au rendu serveur. **Rétrogradée en `warn`** dans
  `eslint.config.mjs`, commentaire explicatif inclus : base verte, régressions visibles, et pas de
  refactor de 16 effets dans un projet sans aucun test.

Résultat : `npm run lint` → **0 erreur, 40 avertissements**, exit 0. `npm run typecheck` OK,
`npm run build` OK.

Dette restante à traiter progressivement : 23 `react-hooks/exhaustive-deps`,
16 `react-hooks/set-state-in-effect`, 1 `@next/next/no-img-element`
(`app/listings/new/page.tsx:388`).

### Constaté, non corrigé
- `JAVA_HOME` pointe vers un JDK inexistant (`~/.jdks/jbr-21.0.7`) → les commandes `npm run db:*`
  échouent avant toute connexion.
- `README.md` et `.github/copilot-instructions.md` annoncent encore Next 14 / `middleware.ts` /
  Nominatim.
- `package.json` déclare `packageManager: yarn@1.22.22` alors que le dépôt utilise npm.

---

## 2026-06-09 — Session initiale

### Suivi de position GPS en temps réel
**`components/map/MapView.tsx`**
- `getCurrentPosition` → `watchPosition` avec `enableHighAccuracy: true`
- Cleanup via `clearWatch` dans le return du `useEffect`

**`app/globals.css`**
- Ajout `@keyframes user-pulse` + classe `.user-location-dot` pour le marqueur animé

**`components/map/LeafletMap.tsx`**
- Marqueur utilisateur avec animation pulsante (`.user-location-dot`)
- Bouton "Recentrer sur ma position" : contrôle Leaflet natif (`L.Control.extend`, position `topleft`) sous les boutons +/−
  - Refs : `recenterBtnRef` (DOM button) + `userPositionRef` (position courante)
  - Caché (`display:none`) jusqu'à première position GPS, puis `display:flex`
  - Ne re-centre **pas** automatiquement — seulement au clic utilisateur
