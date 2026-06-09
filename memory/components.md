# Composants clés

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
- **Bouton "Recentrer"** (custom `L.Control.extend`) — visible dès que `userPosition` disponible, repositionne la carte sur la position GPS

Cluster : hover → spiderfy, mouseleave delayed → unspiderfy (200ms timer)

### `MapView.tsx`
Page carte complète. Gère :
- Géolocalisation live : `navigator.geolocation.watchPosition` (cleanup `clearWatch`)
- Fetch annonces via RPC `listings_within_radius`
- Sidebar liste + carte Leaflet
- Toggle mobile Liste/Carte
- FAB mobile "Publier une annonce" (connecté seulement)
- Filtre catégorie + recherche texte (client-side, normalisé sans accents)

### `FilterBar.tsx`
Barre de filtres catégorie + compteur + champ recherche.

### `CarpoolMiniMap.tsx` / `CarpoolMiniMapDynamic.tsx`
Mini-carte pour visualiser les points de départ/arrivée covoiturage.  
Chargement SSR-safe via dynamic wrapper.

### `EventMiniMap.tsx` / `EventMiniMapDynamic.tsx`
Mini-carte pour les événements. Même pattern.

### `EventCard.tsx`, `EventDetailClient.tsx`, `EventDetailPopup.tsx`, `EventsList.tsx`, `MiniCalendar.tsx`
Composants liés aux événements de quartier.

---

## Formulaires — `components/forms/`

### `AddressAutocomplete.tsx`
Autocomplétion via API **Nominatim** (OpenStreetMap).  
Retourne `ResolvedAddress` : `{ lat, lon, road, city, displayName }`.

### `EventForm.tsx`
Formulaire création/édition d'événement.

---

## Layout — `components/layout/`

### `Navbar.tsx`
Barre de navigation principale.

### `FirebaseSWRegister.tsx`
Enregistre le service worker Firebase pour les push notifications.

### `PWAInstallBanner.tsx`
Bannière d'installation PWA (beforeinstallprompt).

### `PushNotificationBanner.tsx`
Demande de permission notifications push.

---

## Listings — `components/listings/`

### `ListingCard.tsx`
Carte d'annonce. Props notables : `compact`, `outlineOnly`, `onClick`, `active`.  
Affiche emoji catégorie, badge type/statut, distance, image.

---

## Accueil — `app/accueil/`

### `DashboardClient.tsx`
Dashboard post-login : annonces récentes, raccourcis catégories, événements à venir.

---

## Conventions CSS

### Tailwind palette custom
- `brand-*` (vert) : actions primaires, boutons, focus rings
  - `brand-600` pour boutons, `brand-500` pour focus
- `warm-*` : accents secondaires

### Classes CSS globales (`app/globals.css`)
- `.custom-marker` : marqueurs annonces Leaflet
- `.custom-marker--demande` : fond orange pour les demandes
- `.cluster-bubble` : bulles de cluster
- `.user-location-dot` : point bleu utilisateur avec `::after` pulsant
- `@keyframes user-pulse` : animation anneau pulsant
- `@keyframes typing-dot` : indicateur de frappe messagerie
- `.typing-dot` + `:nth-child` delays

### `cn()` utility
```ts
import { cn } from '@/lib/utils'
// = clsx + tailwind-merge
```

---

## Catégories (source : `lib/categories.ts`)
| ID | Slug | Label | Emoji |
|---|---|---|---|
| 1 | `outils` | Outils | 🔧 |
| 2 | `services` | Services | 🤝 |
| 3 | `garde-enfant` | Garde d'enfant | 👶 |
| 4 | `covoiturage` | Covoiturage | 🚗 |
| 5 | `dons` | Dons / Objets | 📦 |
| 6 | `jardinage` | Jardinage | 🌿 |
| 7 | `cuisine` | Cuisine | 🍳 |

`VENTE_EXCLUDED_SLUGS = ['covoiturage', 'garde-enfant']`

### Champs conditionnels dans `listings/new`
- `covoiturage` → adresses départ/arrivée + CarpoolMiniMap (cache photo + adresse standard)
- `garde-enfant` → plage datetime garde + slots récurrents/ponctuels (cache photo)

---

## Couleurs marqueurs Leaflet par type (`LISTING_TYPE_MARKER_COLORS`)
| Type | Couleur hex |
|---|---|
| pret | `#0284c7` bleu |
| don | `#0d9488` teal |
| echange | `#7c3aed` violet |
| service | `#d97706` amber |
| vente | `#e11d48` rose |
