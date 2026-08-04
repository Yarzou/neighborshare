# Historique des modifications (par session)

## 2026-08-04 (1) — Fix workflow GitHub Actions keepalive (startup failure)

Le workflow `.github/workflows/supabase-keepalive.yml` échouait à **chaque push** avec
« No jobs were run », depuis sa mise en place. Diagnostic via l'API publique
(`/actions/runs/<id>/jobs` → `total_count: 0`, `check_runs: 0`, et `name` du run = le chemin du
fichier au lieu de `Supabase keepalive`) : **startup failure**, GitHub n'arrivait pas à compiler
le YAML, donc zéro job. D'où aussi les runs sur l'événement `push` alors que le workflow
n'écoute que `schedule` / `workflow_dispatch` — un run de signalement d'erreur est créé sur le
push quel que soit le `on:`. Le keepalive GitHub (filet de sécurité) n'a donc jamais ping quoi
que ce soit ; seul le cron Vercel tournait.

Cause : `if: ${{ secrets.SUPABASE_ANON_KEY != '' }}` sur le step « Ping direct PostgREST ».
Le contexte **`secrets` est interdit dans un `if:`** (job comme step) →
`Unrecognized named-value: 'secrets'`, ce qui invalide le workflow **entier**, pas seulement le
step.

- `.github/workflows/supabase-keepalive.yml` : les deux secrets remontés en `env` de **job**
  (`secrets` y est autorisé), et le `if:` du step passé à
  `env.SUPABASE_ANON_KEY != '' && env.SUPABASE_URL != ''` (`env` est lisible depuis un `if:` de
  step). Le `env:` du step, devenu redondant, est supprimé. Commentaire ajouté pour ne pas
  reproduire le piège.

À faire côté GitHub après le commit : vérifier qu'un `workflow_dispatch` manuel passe au vert,
et que le run porte bien le nom « Supabase keepalive ». Le step PostgREST reste sauté tant que
les secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` ne sont pas définis sur le dépôt (comportement
voulu).

## 2026-08-03 (7) — Notifications push « vie du quartier »

Six points d'envoi choisis par l'utilisateur (A→F tous retenus) :
diffusion au quartier pour **info ASL**, **sondage**, **événement** (trou historique : rien
n'était envoyé), **achat groupé** ; ciblées pour **nouvelle participation** (→ créateur) et
**objectif atteint** (→ créateur + participants).

**Mécanisme** : route `POST /api/notifications/quartier` (et non des Edge Functions — aurait
exigé une 3e duplication inline du code FCM Deno + config webhooks au dashboard), appelée
fire-and-forget via `notifyQuartier()` (ajouté à `lib/pushNotifications.ts`) après insert
réussi. **Push uniquement, aucun email** — le plafond SMTP Gmail (chantier écarté) n'est pas
aggravé.

- `lib/fcm-admin.ts` refactoré : cœur `sendToTokens()` (multicast par lots de 500 + nettoyage
  des tokens invalides, partagé), + `sendPushToUsers(ids)` (respecte
  `push_notifications_enabled`, null = activé comme les Edge Functions) et
  `sendPushToAll(excludeUserId)`. `sendPushToUser` inchangé en surface (ne vérifie toujours pas
  la préférence — c'est /api/notifications qui le fait, comportement historique conservé).
- **Anti-abus** : la route re-vérifie en base que l'appelant est l'auteur du contenu notifié
  (broadcast) ou un participant réel (ciblées) ; `gp_target_reached` recalcule le total en base
  au lieu de croire le client. Sans ça, n'importe quel compte pouvait spammer le quartier en
  postant des ids arbitraires.
- Émetteurs : `AnnouncementsSection` (création seulement — inserts passés en `.select('id')`),
  `PollsSection.handleCreate`, page achats (`handleCreate` + `participate` : franchissement
  d'objectif détecté sur l'état local, re-vérifié serveur), `EventForm` (création seulement).
- Écarté volontairement : notifs cron (deadlines, clôtures — chantier séparé), prestataires et
  réactions (bruit).

Aucune migration. Vérifs : lint 0 erreur / 33 warnings, typecheck, build OK.
Test réel : deux comptes, push activé sur le second (bannière ou réglages profil), publier une
info ASL avec le premier.

## 2026-08-03 (6) — Modèle de droits complet : créateur + référent sur tous les contenus

Confirmation demandée par l'utilisateur (« le créateur modifie/supprime ses contenus, le
référent modifie/supprime tout, y compris infos et sondages ») — l'audit a montré deux écarts :
les policies limitaient le référent à SES annonces/sondages (`author_id AND is_referent()`),
et **aucune UI d'édition n'existait** pour prestataires, achats, infos et sondages (seulement
création + suppression, + statut pour les achats).

### Migration `038-referent-full-rights.sql` (fichier séparé : 033-036 déjà appliquées)
- `providers_update`, `group_purchases_update` : créateur **ou** référent.
- `announcements_update/delete`, `polls_update/delete`, `poll_options_insert/delete` :
  **tout** référent (plus d'exigence d'être l'auteur).
- `--rollback` restaurant les policies 033-036 à l'identique. Élargissement pur → rétrocompatible.

### UI d'édition (pattern commun : le formulaire de création passe en mode édition)
`editingId` + `startEdit(item)` (pré-remplissage) + `closeForm()` ; submit branche update/insert ;
l'update conserve `author_id`/`created_by` (pas d'appropriation) et pose `updated_at`.
- **Infos** (`AnnouncementsSection`) : crayon + corbeille pour tout référent (plus seulement l'auteur).
- **Sondages** (`PollsSection`) : idem ; l'édition ne porte que question/description/clôture —
  **les options sont volontairement non éditables** (des voisins ont pu voter), message explicite
  dans le formulaire, builder d'options masqué en mode édition.
- **Prestataires** : crayon pour créateur ou référent.
- **Achats groupés** : crayon (titre/description/unité/objectif/prix/date limite) pour créateur ou
  référent ; les boutons de statut (clôturer/annuler/rouvrir) passent de `isOwner` à `canManage`.

Modèle de droits résumé dans `CLAUDE.md` (section Modèle de données). Vérifs : lint 0 erreur /
33 warnings, typecheck, build OK. **`npm run db:migrate` (038) à lancer** — avant ça, les
nouveaux crayons référent sur le contenu d'autrui échoueront proprement (« impossible »).

## 2026-08-03 (5) — Événements : modifier/supprimer (créateur + référent) · zoom carte quartier

Précision utilisateur en cours de route : le cas nominal (seul le créateur modifie et supprime
son événement) reste inchangé ; **en plus**, le référent peut **modifier et supprimer** n'importe
quel événement. Le volet « modifier » a donc été ajouté après coup :
- changeset `037-events-update-referent` **ajouté** au fichier 037 (ajouter un changeset ne casse
  pas les checksums des existants, même sur une base déjà migrée) : `events_update_own` →
  `events_update` (créateur ou référent).
- `app/evenements/[id]/edit/page.tsx` : le fetch ne filtre plus sur `user_id` (404 pour le
  référent sinon) — contrôle owner-ou-référent côté serveur.
- `EventForm` (update) : `.eq('user_id')` retiré (RLS arbitre) + `.select('id')` et contrôle
  0-ligne → « Modification impossible » sur base non migrée. Le payload ne contient pas
  `user_id` : pas d'appropriation par le référent.
- `EventDetailClient` : « Modifier (référent) » visible aussi pour le référent (`canManage`).

### Refactor : `EventActions`, composant unique (demandé par l'utilisateur après le bug du popup)
Les actions modifier/supprimer étaient dupliquées en 3 exemplaires (page détail, popup, profil).
**`components/map/EventActions.tsx`** (nouveau) les centralise : `useCurrentUser` + `canManage`
en interne (rend `null` sans droits), libellés « (référent) », confirmation deux temps,
`deleteEventWithImages()`, prop `onDeleted(id)` laissée au parent (navigation / filtre de liste),
deux variantes `stacked` (page + popup) et `row` (barre scindée du profil, styles repris à
l'identique). Les trois écrans sont réduits à un appel ; `ProfileClient` perd `handleDeleteEvent`
et ses 3 états — sa copie faisait images-d'abord + `.eq('user_id')` sans contrôle 0-ligne, elle
hérite du bon ordre et de la détection d'échec via le helper. L'erreur de suppression s'affiche
désormais dans la ligne concernée (bloc global retiré). Hors périmètre assumé : le corps
informatif page vs popup (aperçu volontairement allégé) et les actions des annonces (déjà
centralisées via `ListingActions`/`ListingForm`).

### Correctif : le popup de la liste n'avait pas les boutons (remonté par l'utilisateur)
« Je peux modifier mais pas supprimer » : l'utilisateur était sur **`EventDetailPopup`** (panneau
ouvert depuis la liste `/evenements` en desktop), un **troisième écran** d'événement oublié — il
n'avait que « Modifier » (créateur). Correctifs :
- **`lib/events.ts`** (nouveau) : `deleteEventWithImages()` — suppression + nettoyage bucket +
  contrôle 0-ligne, partagé entre `EventDetailClient` et `EventDetailPopup` (la 3e copie de cette
  logique, dans `ProfileClient`, est antérieure et laissée telle quelle).
- `EventDetailPopup` : modifier + supprimer pour créateur/référent (mêmes libellés que la page
  détail), prop `onDeleted` → `EventsList` retire l'événement de sa liste sans rechargement.
  Les pastilles du mini-calendrier peuvent rester une session en retard après suppression
  (re-chargées au prochain affichage) — assumé.
- Rappel des 3 écrans d'événement : page détail (`EventDetailClient`), popup liste
  (`EventDetailPopup`), profil (`ProfileClient`) — toute évolution des actions doit couvrir les
  trois.

### Suppression d'événement
La suppression de ses propres événements n'existait que depuis `/profile` — rien sur la page de
l'événement. Et le référent ne pouvait rien supprimer (policy `events_delete_own` stricte).
- **`liquibase/changelog/037-events-referent-delete.sql`** : `events_delete_own` → `events_delete`
  (`user_id = auth.uid() OR is_referent()`), même élargissement pour `events_storage_delete`
  (images du bucket). `--rollback` restaurant les policies d'origine. Rétrocompatible :
  élargissement de droits pur.
- **`components/map/EventDetailClient.tsx`** : bouton « Supprimer » (créateur ou référent,
  confirmation en deux temps), `useCurrentUser()` remplace le `getUser()` manuel. Delete sans
  `.eq('user_id')` (RLS arbitre) + **`.select('id')` pour détecter le 0-ligne** (un delete refusé
  par RLS ne renvoie pas d'erreur !) → « Suppression impossible » sur base non migrée. Ligne
  supprimée d'abord, images ensuite.

### Zoom carte (demande : « centrée sur le quartier, quasi zoomé au max »)
- `NEIGHBORHOOD_DEFAULT_ZOOM` : **15 → 17** (niveau rues/numéros du lotissement au lieu de la
  ville entière ; estimé depuis les captures fournies ; max 19). Ajustable sans code via
  `NEXT_PUBLIC_NEIGHBORHOOD_ZOOM` (ex. 18 si encore trop large).
- Bouton « recentrer » de `LeafletMap` aligné sur la même constante (était 16 en dur).
- Le `setView(searchedLocation, 14)` de la recherche d'adresse est volontairement conservé
  (une adresse cherchée peut être hors quartier).

### À faire côté utilisateur
`npm run db:migrate` (037) sur test puis prod. Avant migration, le bouton référent sur
l'événement d'autrui affiche « Suppression impossible » (comportement prévu).

## 2026-08-03 (4) — Évolutions : vue geo, tokens dark, canal ASL, sondages, prestataires, achats groupés

Périmètre demandé : évolutions n°1-2-3-4 de l'audit (achats groupés, canal ASL, sondages,
prestataires) + trois dettes techniques (vue à la place du RPC, config quartier, tokens dark).
Décisions produit : achats groupés en **quantité + seuil** ; sondages **réservés aux référents,
choix unique, résultats après vote** ; premier référent désigné **par SQL manuel** ; dark mode
en **migration progressive** (pas de refonte).

### Fondations techniques
- **`lib/neighborhood.ts`** (nouveau) : centre/zoom/rayon du quartier (surchargeables par
  `NEXT_PUBLIC_NEIGHBORHOOD_*`) + `distanceMeters()` (haversine). Supprime les constantes géo
  dupliquées de `MapView.tsx` et `LeafletMap.tsx`.
- **`liquibase/changelog/032-listings-geo-view.sql`** : vue `listings_geo` en `l.*` avec
  **`security_invoker = true`** (sans quoi la vue contournerait le RLS de 030 — c'est LE point
  critique de cette migration ; requiert PG 15+). `MapView` lit la vue ; distance et tri par
  proximité recalculés côté client (`distance_m` n'était affiché nulle part — vérifié). L'ancien
  RPC `listings_within_radius` n'est plus appelé mais **reste en base** (fenêtre
  migration/déploiement) — à dropper plus tard.
- **Tokens dark mode** : variables `--surface/--border/--text…` dans `globals.css` (valeurs
  alignées sur le bloc `!important` existant → rendu identique), exposées par
  `tailwind.config.ts` en `bg-surface`, `border-edge`, `text-content-*`. Le bloc de surcharges
  reste pour le non-migré. Vérifié dans le bundle CSS compilé. Migré : les 3 nouvelles pages,
  `LoginRequiredNotice`, le voile carte.

### Migrations 033 → 036
- **033** : `profiles.is_referent` (rôle, PAS un contrôle d'inscription — celle-ci reste ouverte)
  + fonction `is_referent()` + table `announcements` (lecture authentifiée, écriture référents).
- **034** : `providers` — CRUD par l'auteur, delete aussi par référent.
- **035** : `group_purchases` + `group_purchase_participants` (PK composite = 1 participation par
  compte, `quantity > 0`, unité libre, statut text `ouvert|cloture|annule`).
- **036** : `polls` / `poll_options` / `poll_votes` + RPC `poll_results()`. « Résultats après
  vote » appliqué **en base** : votes lisibles uniquement par leur auteur, totaux via le RPC qui
  refuse avant vote (sauf sondage clos ou auteur) → pas de dépouillement nominatif via l'API.

### Écrans
- **`lib/hooks.ts`** : `useCurrentUser()` — session + `is_referent` + flag `resolved`.
- **`app/infos/`** (« Vie du quartier », lien « Quartier » dans la Navbar) : annonces officielles
  (épinglage, suppression par l'auteur) + sondages (vote = upsert, barres de résultats).
- **`app/achats/`** : progression quantité/objectif, participation modifiable, retrait,
  clôture/annulation/réouverture, gestion de la date limite échue (« Échu »).
- **`app/prestataires/`** : fiches avec tél/email/site cliquables, retour d'expérience, recherche.
- **`/accueil`** : 3 tuiles ajoutées (8 au total) ; le centrage de la dernière tuile ne
  s'applique plus que si le compte est impair.

### Pièges rencontrés
- La règle `react-hooks/set-state-in-effect` trace les `setState` d'une fonction async appelée
  depuis un effet même après `await` (faux positif) : directives ciblées sur la ligne du `load()`
  avec justification, et suppression d'un `setLoading(false)` réellement synchrone mais inutile
  (le rendu court-circuite sur `!userId` avant de consulter `loading`).
- **Carte vide avant migration** (remonté par l'utilisateur en dev) : `MapView` lisait
  `listings_geo` alors que la 032 n'était pas appliquée → requête en erreur avalée en silence,
  zéro pin. Correctif : **repli automatique sur l'ancien RPC** quand la vue est indisponible
  (+ `console.warn`), l'app fonctionne donc avant et après la migration. Le repli sera retiré
  quand le RPC sera droppé. Leçon : un remplacement de source de données doit toujours couvrir
  la fenêtre migration/déploiement côté client, pas seulement côté base.
- `npm run build` lancé pendant que le `npm run dev` de l'utilisateur tournait → fichiers générés
  `.next/dev/types/*` corrompus (écritures concurrentes), faux échec de typecheck. Supprimés
  (régénérés par le dev server). Éviter de builder pendant qu'un dev server tourne.

### Onglets « Quartier » (retour utilisateur : pages non découvrables hors dashboard)
Les trois pages sont déplacées dans le route group **`app/(quartier)/`** (URLs inchangées) dont le
`layout.tsx` porte le conteneur commun + **`QuartierTabs`** (Vie du quartier / Achats groupés /
Prestataires). Conteneurs `max-w-2xl px-4` retirés des pages (fournis par le layout). Navbar :
« Quartier » actif sur les trois routes (`matches` + `isNavLinkActive`). Piège rencontré : après
déplacement de dossiers, `.next/types/validator.ts` référence les anciens chemins → faux échec de
typecheck jusqu'au rebuild.

### Rétrocompatibilité (exigence posée après l'incident carte vide)
L'utilisateur a **deux bases (test + prod)** : schéma et code jamais garantis synchrones.
Règle expand/contract formalisée dans `CLAUDE.md` §6 : migrations additives uniquement, le
nouveau code tolère l'ancien schéma (repli `MapView` = exemple canonique ; `/infos`, `/achats`,
`/prestataires` se dégradent en listes vides si leurs tables manquent), suppression d'objets
seulement dans une migration ultérieure une fois les deux bases à niveau. Audit des migrations
en attente : 032–036 sont toutes additives, conformes. **`--rollback` ajoutés sur chaque
changeset de 032 à 036** (encore modifiables : appliquées nulle part ; 028–031 déjà appliquées,
donc intouchables). `npm run db:tag` recommandé avant chaque campagne.

### À faire côté utilisateur
1. `npm run db:migrate` (032 → 036).
2. Désigner le premier référent (SQL Editor) :
   `update public.profiles set is_referent = true where id = (select id from auth.users where email = 'SON_EMAIL');`
3. Vérifier `/map` (vue au lieu du RPC), `/infos`, `/achats`, `/prestataires` — connecté,
   déconnecté, et en thème sombre.

Vérifications : lint 0 erreur / 33 avertissements (base inchangée), typecheck OK, build OK.
Rappel : les notifications (email par annonce, plafond Gmail) restent le prérequis écarté —
aucune des nouvelles tables ne déclenche d'envoi pour l'instant.

## 2026-08-03 (3) — Alerte Advisor `spatial_ref_sys` : piste épuisée, alerte non levée

Demande : « cette issue Supabase que tu ne règles jamais » →
`Table public.spatial_ref_sys is public, but RLS has not been enabled.`

**Pourquoi les 4 tentatives précédentes ont échoué.** `spatial_ref_sys` est créée par PostGIS
(installé dans `public` en 001) et appartient à `supabase_admin` : le rôle applicatif
(`postgres.<ref>`) ne peut ni l'`ALTER`, ni y créer une policy, ni faire
`alter extension postgis set schema extensions`. Donc 023 (no-op), 026 (`RAISE NOTICE`) et 027
(`insufficient_privilege` avalé en `NOTICE`) n'ont rien fait, et **025 a re-grant le SELECT à
`anon`/`authenticated`** — c'est-à-dire exactement la condition qui déclenche l'alerte.

**Ce qui débloque.** Lecture du SQL réel du lint (`supabase/splinter`,
`0013_rls_disabled_in_public`) : son `WHERE` ne teste pas que `not relrowsecurity`, il exige aussi
`has_table_privilege('anon', …, 'SELECT') or has_table_privilege('authenticated', …, 'SELECT')`.
Retirer le SELECT suffit donc à faire tomber l'alerte — sans activer un RLS interdit. Bénéfice
réel au passage : la table cesse d'être interrogeable avec la clé anon publique (même esprit que
030).

**`liquibase/changelog/031-spatial-ref-sys-revoke-select.sql`** (nouveau)
- `revoke select … from anon, authenticated` **et `from public`** : sans le revoke sur le
  pseudo-rôle `PUBLIC`, `has_table_privilege('anon', …)` resterait vrai par héritage.
- Changeset de contrôle `031-verify-revoke` : `RAISE EXCEPTION` si le privilège est encore là
  après le revoke. En PostgreSQL un REVOKE sans droit suffisant n'échoue pas, il émet un simple
  `WARNING` — sans cette vérification on reproduirait le faux positif de 027. La migration doit
  échouer bruyamment plutôt que laisser croire que c'est fait.
- `--rollback grant select … to anon, authenticated` pour `npm run db:rollback`.
- `pg_notify('pgrst', 'reload schema')` en fin de fichier (comme 030).
- Innocuité vérifiée sur tout le changelog : aucun `st_transform`, uniquement `st_dwithin` /
  `st_distance` sur `geography`, `st_makepoint`, `st_x`/`st_y` ; `listings.location` est en
  `geography(Point, 4326)` et PostGIS court-circuite la lecture du catalogue pour ce SRID.
- `db.changelog-master.xml` : `<include>` de 031.

**❌ Résultat de l'exécution : le REVOKE est sans effet.** Le changeset de contrôle a levé son
exception (`le role courant (postgres) n'a pas le grant option`). Le SELECT n'a pas été accordé par
`postgres` mais par `supabase_admin` / le script d'installation PostGIS : sans grant option,
`postgres` ne peut pas le retirer, et PostgreSQL se contente d'un `WARNING`. Les trois leviers du
lint (RLS, schéma de l'extension, droits) sont donc **tous** hors de portée d'une migration.

**Correctif du correctif** : le changeset `031-verify-revoke` (EXCEPTION) a été remplacé par
`031-report-privileges` (WARNING). Un changeset en échec bloque toutes les migrations suivantes —
inacceptable pour un simple constat. Le changeset `031-revoke-select-spatial-ref-sys`, lui, est
déjà enregistré en base : il n'a pas été touché (checksum) et reste inoffensif — il retire bien
les grants qui, eux, appartiennent à `postgres`.

**Dernier test, en SQL Editor** : `set role supabase_admin;` → `42501 permission denied to set
role "supabase_admin"`. Le contournement par emprunt de rôle est donc fermé aussi.

**Et la piste « recréer l'extension ailleurs »** (une seule installation d'une extension par base,
donc drop + create dans `extensions`) : `pg_extension` donne `owner = supabase_admin` et
`extrelocatable = false`. Explication de fond : PostGIS est une **trusted extension**, or
PostgreSQL installe une extension « trusted » demandée par un non-superuser *comme si* elle l'était
par un superuser — l'extension et tous ses objets appartiennent au superuser d'amorçage. Le
`create extension` de 001, lancé par Liquibase en `postgres`, ne pouvait donc pas en donner la
propriété au projet. Rien de tout ça n'était rattrapable côté dépôt.

**Décision : on vit avec l'alerte.** Les quatre leviers du lint sont testés et tous hors de portée.
Le contenu de `spatial_ref_sys` est le catalogue EPSG, public par nature — aucune donnée du
quartier n'est exposée, et la vraie fermeture des données reste la migration 030. Rouvrir le sujet
supposerait de réinstaller PostGIS dans le schéma `extensions` via la page Extensions du dashboard
(destructif : sauvegarde lat/lng, suppression de `listings.location` + tous les RPC dépendants,
recréation en `extensions.geography`) ou de passer par le support Supabase. Constat verrouillé dans
`CLAUDE.md` et `memory/database.md` pour ne pas retenter ces pistes une sixième fois.

⚠️ Migrations **non applicables par l'agent** : pas d'accès réseau à la base depuis la session
(`Connect timed out` sur le pooler 6543). `npm run db:migrate` est lancé par l'utilisateur.

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
