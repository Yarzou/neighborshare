# Composants clés

> Dernière vérification : 2026-07-28 (lecture complète du dépôt).

## Carte — `components/map/`

### `LeafletMap.tsx`
Composant Leaflet impératif (refs uniquement, pas de re-init).  
Props : `userPosition, listings, onSelectListing, selectedId, searchedLocation, visible`

Marqueurs :
- **Annonces** : `.custom-marker` (emoji catégorie, border-color selon type), clustered via `MarkerClusterGroup`
- **Utilisateur** : `.user-location-dot` (point bleu + animation `user-pulse` CSS)
- **Adresse recherchée** : marqueur rouge "épingle"

Contrôles Leaflet natifs (`topleft`) :
- +/− zoom (natif Leaflet)
- **Bouton "Recentrer"** (custom `L.Control.extend`) — caché jusqu'à la première position GPS, puis visible ; ne re-centre **jamais** automatiquement, seulement au clic

Cluster : hover → spiderfy, mouseleave delayed → unspiderfy (200ms timer)

### `MapView.tsx`
Page carte complète. Gère :
- Géolocalisation live : `navigator.geolocation.watchPosition` (`enableHighAccuracy`, cleanup `clearWatch`)
- Fetch annonces via RPC `listings_within_radius`
- Sidebar liste + carte Leaflet
- Toggle mobile Liste/Carte
- FAB mobile "Publier une annonce" (connecté seulement)
- Filtre catégorie + recherche texte (client-side, normalisé sans accents)

### `FilterBar.tsx`
Filtres catégorie (depuis `FILTER_CATEGORIES`) + compteur + champ recherche.  
Props : `category, onCategoryChange, count, loading, search, onSearchChange`

### `CarpoolMiniMap.tsx` / `CarpoolMiniMapDynamic.tsx`
Mini-carte des points de départ/arrivée covoiturage. Chargement SSR-safe via le wrapper `*Dynamic`.

### `EventMiniMap.tsx` / `EventMiniMapDynamic.tsx`
Mini-carte pour les événements. Même pattern.

### Événements de quartier
- `EventsList.tsx` (313 l.) — liste ou grille d'événements, calendrier repliable, filtres de dates, scroll piloté de l'extérieur. Props notables : `layout: 'list' | 'grid'`, `externalActiveDate`, `scrollTrigger: { date, seq }`, `filterFrom` / `filterTo`, callbacks `onActiveDateChange` / `onMarkedDatesReady` / `onEventSelect`
- `MiniCalendar.tsx` — calendrier mensuel ; `markedDates: Set<'YYYY-MM-DD'>` pour les jours avec événements, `activeDate`, `onDateClick`, `onDateHover`
- `EventCard.tsx` — carte d'événement ; badge « Passé » en overlay sur l'image, bouton ✏️ visible uniquement pour le créateur
- `EventDetailPopup.tsx` — popup de détail (carrousel d'images, lien édition si créateur)
- `EventDetailClient.tsx` — page de détail complète, bouton « Modifier l'événement » en bas pour le créateur

---

## Formulaires — `components/forms/`

### `AddressAutocomplete.tsx`
Autocomplétion via l'**API BAN** (`api-adresse.data.gouv.fr`) — ⚠️ Nominatim a été **retiré** (commit `6b7acc5`).  
Retourne `ResolvedAddress` : `{ displayName, lat, lon, road, city }` (le type interne `BanFeature` donne `coordinates: [lon, lat]`).  
Comportements : debounce, fermeture au clic extérieur, état « verrouillé » via `lockedValue` (mode édition), bouton de géolocalisation.

### `EventForm.tsx`
Création/édition d'événement. Date et heure **séparées** (champs `date` + `time`) ; l'heure de fin est désactivée tant qu'aucune date de fin n'est saisie.

---

## Layout — `components/layout/`

### `Navbar.tsx`
Navigation principale. Liens : `/map` (Carte), `/evenements` (Événements). Logo → `/accueil` si connecté, `/` sinon.  
Badge de messages non lus alimenté en Realtime (canal `navbar_unread`). « Publier » est masqué du menu burger.

### `FirebaseSWRegister.tsx`
Enregistre le Service Worker FCM servi par `/api/firebase-messaging-sw`.

### `PWAInstallBanner.tsx`
Bannière d'installation PWA — gère `beforeinstallprompt` (Android) **et** les instructions manuelles iOS (`Platform = 'android' | 'ios' | null`).

### `PushNotificationBanner.tsx`
Demande de permission notifications push.

---

## Listings — `components/listings/`

- `ListingCard.tsx` — carte d'annonce. Props notables : `compact`, `outlineOnly`, `onClick`, `active`. Affiche emoji catégorie, badges type/statut, distance, image.
- `ListingActions.tsx` — actions du cycle de vie sur la page détail. Appelle les RPC `validate_listing_response` / `cancel_listing_response`, puis notifie `/api/notifications` en fire-and-forget et fait un `router.refresh()`. Retourne `null` si `status === 'disponible'`.
- `ContactButton.tsx` — appelle le RPC `contact_listing`, redirige vers la conversation créée. Props : `listingId, receiverId, listingStatus`.
- `StatusBadge.tsx` — rend `LISTING_STATUS_LABELS/COLORS` ; **n'affiche rien pour `disponible`** sauf `showAll`.
- `TypeBadge.tsx` — rend `LISTING_TYPE_LABELS/COLORS`.

---

## Messagerie — `components/messages/`

- `MessageBubble.tsx` (298 l.) — bulle de message, réactions emoji (`MESSAGE_EMOJIS`), suppression, avatar coloré, gestion des messages système. Type manipulé : `DirectMessage`.
- `ConversationRow.tsx` — ligne de conversation (dernier message, non-lus, suppression). Type : `ConversationWithDetails`.
- `TypingIndicator.tsx` — trois `.typing-dot` animés ; en groupe, affiche « X, Y écrivent… ».

---

## Profil

- `components/profil/PublicProfileAccordion.tsx` — accordéon annonces + événements du profil public.
- `components/profile/NotificationSettings.tsx` — bascules email / push ; s'appuie sur `isPushSupported`, `activatePushNotifications`, `deactivatePushNotifications` de `lib/pushNotifications.ts`.
- `app/profile/ProfileClient.tsx` (879 l.) — mon profil : infos, adresse par défaut, couleur d'avatar, mes annonces, mes événements, préférences de notification, suppression de compte.

---

## Accueil — `app/accueil/`

### `DashboardClient.tsx`
Dashboard post-login : annonces récentes, raccourcis catégories, événements à venir, accès « Explorer les annonces ».

---

## Conventions CSS

### Tailwind palette custom
- `brand-*` (vert) : actions primaires, boutons, focus rings — `brand-600` boutons, `brand-500` focus
- `warm-*` : accents secondaires
- `borderRadius` étendu : `2xl` = 1rem, `3xl` = 1.5rem

### Classes CSS globales (`app/globals.css`)
- `.custom-marker` / `.custom-marker--demande` (fond orange pour les demandes) : marqueurs annonces
- `.cluster-bubble` : bulles de cluster
- `.user-location-dot` + `@keyframes user-pulse` : point bleu utilisateur avec anneau pulsant
- `.typing-dot` (+ délais `:nth-child`) + `@keyframes typing-dot` : indicateur de frappe
- Surcharges Leaflet : `.leaflet-popup-content-wrapper`, `.leaflet-popup-tip`
- **Bloc `html.dark …`** : toutes les surcharges dark mode, en `!important`. Classes de carte concernées : `.main-map`, `.carpool-mini-map` (filtre sur le `leaflet-tile-pane`).
  ⚠️ Toute nouvelle couleur Tailwind utilisée dans un composant doit y être ajoutée, sinon pas de rendu sombre.

### `cn()` utility
```ts
import { cn } from '@/lib/utils'
// = clsx + tailwind-merge
```

---

## Catégories (source : `lib/categories.ts`)
| ID | Slug | Label | Label filtre | Emoji |
|---|---|---|---|---|
| 1 | `outils` | Outils | Outils | 🔧 |
| 2 | `services` | Services | Services | 🤝 |
| 3 | `garde-enfant` | Garde d'enfant | Enfants | 👶 |
| 4 | `covoiturage` | Covoiturage | Trajet | 🚗 |
| 5 | `dons` | Dons / Objets | Dons | 📦 |
| 6 | `jardinage` | Jardinage | Jardin | 🌿 |
| 7 | `cuisine` | Cuisine | Cuisine | 🍳 |

Helpers : `getCategoryEmoji(id)`, `getCategoryCardClasses(id)`, `getCategoryBorderOnlyClasses(id)` (fond blanc + bordure, utilisé sur la carte), `FILTER_CATEGORIES` (avec « Tout » 🗺️ en tête).  
`VENTE_EXCLUDED_SLUGS = ['covoiturage', 'garde-enfant']`

### Champs conditionnels dans `listings/new`
- `covoiturage` → adresses départ/arrivée + CarpoolMiniMap (cache photo + adresse standard)
- `garde-enfant` → plage datetime garde + slots récurrents/ponctuels `childcare_slots` (cache photo).  
  `day` : 0 = dimanche … 6 = samedi (convention JS) ; heures au format `"HH:mm"`

---

## Couleurs marqueurs Leaflet par type (`LISTING_TYPE_MARKER_COLORS`)
| Type | Couleur hex |
|---|---|
| pret | `#0284c7` bleu |
| don | `#0d9488` teal |
| echange | `#7c3aed` violet |
| service | `#d97706` amber |
| vente | `#e11d48` rose |
