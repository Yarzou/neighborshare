# Historique des modifications (par session)

## 2026-08-03 (2) — Fermeture de la lecture aux authentifiés + ListingForm partagé

Suite à un audit demandé sur « ce qui peut être optimisé ». Deux des trois priorités
identifiées ont été traitées ; l'envoi d'emails (79 destinataires par annonce sur SMTP
Gmail, plafond ~500/jour) a été **volontairement laissé de côté** par l'utilisateur.

### 1. Visibilité des données

**`liquibase/changelog/030-restrict-read-to-authenticated.sql`** (nouveau)
- `profiles`, `listings`, `events` passaient par `using (true)` : la policy s'appliquant
  aussi au rôle `anon`, et la clé anon étant publique par conception (bundle JS), les
  adresses et coordonnées de tous les foyers étaient lisibles **sans compte**.
- Recréées en `for select to authenticated using (true)`. Choix de `to authenticated`
  plutôt que `using (auth.role() = 'authenticated')` : comportement identique, mais le
  rôle est évalué une fois par requête au lieu d'une fois par ligne, et ça ne dépend pas
  de `auth.role()` que Supabase déconseille.
- `revoke execute` du RPC `listings_within_radius` pour `anon` (défense en profondeur :
  le RPC étant `LANGUAGE sql STABLE` sans SECURITY DEFINER, il respectait déjà le RLS).
- **`categories` volontairement laissée publique** : `/api/keepalive` l'interroge avec la
  clé anon, la fermer casserait le ping anti-mise-en-pause.
- Choix produit assumé : **pas de notion de membre du lotissement**, l'inscription reste
  ouverte. Un système de code d'invitation / validation par un référent a été proposé et
  écarté pour l'instant (priorité à l'adoption sur le verrouillage).

**Effets de bord traités**
- `app/listings/[id]/page.tsx` : `notFound` était importé **mais jamais appelé** et
  `listingError` jamais testé — un id inexistant provoquait déjà un 500, et ç'aurait été
  le cas pour tout visiteur déconnecté. Ajout de `getUser()` **avant** le fetch +
  `redirect('/auth/login?redirect=/listings/{id}')` (le partage de lien renvoie donc au
  login puis à l'annonce), et `notFound()` si l'annonce est absente. Le bloc
  « Connectez-vous pour contacter » devenait inaccessible → supprimé, ainsi que l'import
  `MessageCircle` devenu mort.
- `app/profil/[id]/page.tsx` et `app/evenements/[id]/page.tsx` : répondaient 404 à un
  visiteur déconnecté (trompeur, et casse le partage de lien) → même redirection.
- **`components/layout/LoginRequiredNotice.tsx`** (nouveau) : les pages client `/map`,
  `/recent`, `/evenements` restent navigables sans compte mais afficheraient « 0 annonce ».
  Elles montrent désormais un encart « Réservé aux voisins » explicite. Branché dans
  `MapView`, `app/recent`, `app/evenements` et `EventsList`.
- Ajout d'un flag `authResolved` dans ces quatre composants : `isLoggedIn` / `currentUserId`
  démarrent à `false`/`null`, donc l'encart aurait clignoté pour un utilisateur connecté
  le temps que `getUser()` réponde.
- Limite assumée : les buckets Storage `listings` / `events` restent publics (nécessaire
  pour `getPublicUrl`) — une image est accessible par son URL directe, non devinable.

### 2. `ListingForm` partagé

**`components/listings/ListingForm.tsx`** (nouveau, ~620 l.) — `mode="create" | "edit"`.
Porte tout : state, catégories, champs conditionnels, validation, upload, insert/update,
redirect. L'initialisation se fait dans les initialiseurs `useState` (pas d'effet), ce qui
évite d'ajouter de la dette `set-state-in-effect`.

`app/listings/new/page.tsx` (597 l. → 72 l.) et `app/listings/[id]/edit/page.tsx`
(478 l. → 89 l.) ne sont plus que des coquilles : chargement des données et gardes
(auth, `notFound`, `unauthorized`).

**Bugs corrigés au passage** — l'édition avait divergé de la création et perdait :
- `childcare_mode` et `childcare_slots` → une annonce de garde en mode « offre » perdait
  ses créneaux dès qu'on l'éditait ;
- `listing_intent` → impossible de corriger une annonce publiée en « offre » au lieu de
  « demande » ;
- `expires_at` → impossible de prolonger ou retirer une date d'expiration.
Ces trois champs sont désormais éditables. Pour les annonces antérieures à la colonne,
`childcareMode` retombe sur `'offre'` si des créneaux existent, sinon `'demande'`.

Effet mesurable : la dette lint passe de **40 à 33 avertissements** (7 avertissements
supprimés par la déduplication).

### Vérifications
`npm run lint` (0 erreur, 33 avertissements), `npm run typecheck`, `npm run build` passent.

⚠️ **Migration 030 non appliquée** : les ports PostgreSQL de Supabase (5432/6543) sont
toujours injoignables depuis ce réseau. `npm run db:migrate` à lancer ailleurs — et c'est
la migration qui compte le plus ici, le code seul ne ferme rien.

Les autres pistes de l'audit (achats groupés, canal officiel de l'ASL, sondages, inventaire
du matériel commun, alertes de voisinage, annuaire, prestataires recommandés, modération)
sont conservées pour une prochaine session à la demande de l'utilisateur.

### 3. Parcours du visiteur non connecté (choix « voile »)

Après audit route par route de ce que voit un anonyme, deux incohérences restaient : la
landing poussait « Explorer les annonces » vers un mur, et `/map` affichait la carte du
quartier **sans aucun marqueur** — message « il n'y a rien ici » au lieu de « connectez-vous »,
et en vue mobile « Carte » aucune explication n'était visible.

Option retenue : garder les pages ouvertes et **voiler la carte** (plutôt que rediriger).

- **`app/globals.css`** : classe `.map-login-veil` + variante `html.dark`. Classe dédiée
  volontairement : `bg-white/80` génère `.bg-white\/80`, que le bloc d'overrides dark (qui
  cible `.bg-white`) ne rattrape pas — le voile serait resté blanc en thème sombre.
- **`components/map/MapView.tsx`** : overlay `z-[1150]` sur la zone carte quand
  `authResolved && !isLoggedIn`, portant `LoginRequiredNotice`.
- **`LoginRequiredNotice`** : nouvelle prop `compact` (masque les boutons). Sur `/map`
  l'encart apparaît à deux endroits (liste + voile) ; la liste passe en `compact={!isMobile}`
  pour ne pas répéter le même appel à l'action côte à côte en desktop.
- **`app/page.tsx`** : « Explorer les annonces » → « La carte du quartier », « Voir les
  événements » → « Les événements » (ces libellés promettaient un contenu désormais fermé),
  « Se connecter » devient le CTA primaire, et une phrase annonce que le contenu est réservé
  aux habitants. Suppression de l'import mort `CATEGORY_LIST`.

**`/evenements/new`** : la page affichait le formulaire en entier à un visiteur déconnecté et
ne le renvoyait au login qu'**à la soumission**, sans `?redirect=` — saisie perdue. Ajout
d'une garde serveur (`getUser()` + `redirect`), la route passe donc de statique à dynamique.
`EventForm` conserve un filet de sécurité si la session expire pendant la saisie, désormais
avec le bon `?redirect=` (page d'édition ou de création selon `isEdit`).

⛔ Règle inscrite dans `CLAUDE.md` : **le RLS est le seul verrou, l'UI n'est qu'un habillage.**
Le voile et les encarts se contournent avec l'inspecteur ; ils ne masquent rien puisque la
base ne renvoie aucune ligne. Le risque n'est pas technique mais humain — croire plus tard
que le voile protège quelque chose.

## 2026-08-03 — Catégorie « Livres » (8e catégorie) + annonce dédiée

Objectif : rendre le prêt/échange de livres filtrable sur la carte (il fallait le ranger dans
« Dons / Objets ») et permettre de saisir auteur / état / genre à la publication.

### Base de données
**`liquibase/changelog/028-livre-category.sql`** (nouveau)
- Seed de la catégorie `livre` / « Livres » / 📚. L'**ID 8 est posé explicitement** (et non laissé au
  `nextval` du serial) parce que `lib/categories.ts` code les IDs en dur ; `setval` derrière pour
  resynchroniser la séquence.
- Colonnes `book_author`, `book_condition`, `book_genre` sur `listings` — `text` libre, comme
  `childcare_mode` / `listing_intent` (la contrainte de valeurs est portée par TS).

**`liquibase/changelog/029-rpc-book-fields.sql`** (nouveau)
- Redéfinition (`DROP` + `CREATE`, `splitStatements:false`) de `listings_within_radius` avec les trois
  colonnes livre.
- **Correction d'un trou existant** : `price`, ajouté en 014, n'avait jamais été mis au `RETURNS TABLE`
  → le badge prix de `ListingCard` ne s'affichait pas sur la page carte alors qu'il s'affichait
  partout ailleurs (les autres pages font `select('*')`). Il remonte maintenant.
- `grant execute … to authenticated, anon` reposé : il est perdu par le `DROP` et n'avait plus été
  réappliqué depuis 002.

**`db.changelog-master.xml`** : deux `<include>` commentés.

⚠️ **Migrations écrites mais NON appliquées** : les ports PostgreSQL de Supabase (5432 / 6543) sont
injoignables depuis le réseau de dev (l'API en 443 répond, donc le projet n'est pas en pause).
À lancer depuis un réseau non filtré : `npm run db:migrate`, puis vérifier que la catégorie a bien
l'ID 8 — sinon aligner `CATEGORY_LIST` sur la valeur réelle. `JAVA_HOME` doit aussi être corrigé
(il pointe vers `~/.jdks/jbr-21.0.7`, absent ; `~/.jdks/ms-21.0.10` existe).

### Code
- **`lib/categories.ts`** : entrée id 8 `livre` en teinte **ambre**. Non ajoutée à
  `VENTE_EXCLUDED_SLUGS` (vendre un livre est pertinent). Tout le reste se propage tout seul :
  filtres carte et `/recent`, marqueurs Leaflet, couleur des cartes, `<select>` des formulaires.
- **`lib/types.ts`** : `BookCondition`, `BOOK_CONDITION_LABELS`, `BOOK_GENRES` (13 genres) +
  `book_author` / `book_condition` / `book_genre` sur `Listing`.
- **`app/globals.css`** : 3 overrides dark mode manquants (`bg-amber-50`, `border-amber-200`,
  `hover:bg-amber-100`) — sans eux la tuile n'a aucun rendu sombre.
- **`components/map/FilterBar.tsx`** : grille `grid-cols-4` → **`grid-cols-3`** (9 tuiles = 3 lignes
  pleines, au lieu d'une tuile orpheline sur une 3e ligne).
- **`app/listings/new/page.tsx`** : `BOOK_SLUG` + `isBook` sur le pattern `isCarpool`/`isChildcare` ;
  les 3 champs dans l'objet `form` (donc `handleChange` générique) ; bloc ambre placé **entre la
  catégorie et la photo** (les blocs covoiturage/garde-enfant sont après la photo parce qu'ils la
  remplacent — ici la couverture est utile, `hidePhoto` reste inchangé) ; 3 colonnes dans l'insert
  avec le ternaire `isBook ? … : null`. Aucune validation ajoutée : les 3 champs sont optionnels.
- **`app/listings/[id]/edit/page.tsx`** : même chose, dupliquée — il n'existe aucun composant de
  formulaire partagé entre `new` et `edit`, et l'extraire aurait été un refactor des deux plus gros
  fichiers sans test pour le couvrir. Hydratation depuis le `select('*')` existant.
- **`app/listings/[id]/page.tsx`** : fiche `<dl>` ambre sous la description, affichée seulement si au
  moins un champ est renseigné. La chaîne de ternaires du visuel de tête n'a **pas** été touchée : sa
  branche `image_url` affiche déjà la couverture.
- **`components/listings/ListingCard.tsx`** : auteur en italique sous le titre (modes compact et
  grille). Rien dans la chaîne de ternaires du visuel — une branche avant `image_url` masquerait la
  couverture.

### Vérifications
`npm run lint` (0 erreur / 40 avertissements = base inchangée), `npm run typecheck`, `npm run build`
passent. Le test fonctionnel reste à faire après application des migrations.

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

Domaine de production réel : **`voisinsducedre.vercel.app`** (vérifié : `neighborshare-liard.vercel.app`
renvoie un 307 vers lui). C'est cette URL qui sert de défaut au workflow GitHub.

⚠️ **Reste à faire (humain)** :
1. Restaurer le projet depuis le dashboard Supabase — un keepalive ne réveille pas un projet en pause.
2. Pousser sur `main` : le cron Vercel est enregistré au déploiement **production**, et le trigger
   `schedule` de GitHub Actions n'est actif que depuis la branche par défaut.
3. Vérifier : onglet Cron Jobs du projet Vercel + un run manuel du workflow (`workflow_dispatch`).

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
