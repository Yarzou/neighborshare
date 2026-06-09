# Architecture & Stack

## Tech Stack
- **Framework** : Next.js 16.2.4 (App Router, `app/` directory)
- **Base de données** : Supabase (PostgreSQL + PostGIS)
- **Carte** : Leaflet 1.9.4 + leaflet.markercluster + OpenStreetMap
- **Styles** : Tailwind CSS 3 + `cn()` (clsx + tailwind-merge)
- **Auth** : Supabase Auth (client-side uniquement)
- **Notifications** : Firebase Cloud Messaging (FCM) + Nodemailer (email)
- **Fonts** : Geist Sans / Geist Mono
- **State** : useState/useEffect React natif + Zustand (dispo mais peu utilisé)
- **Package manager** : yarn 1.22

## Commandes
```bash
npm run dev          # Dev server http://localhost:3000
npm run build        # Build prod
npm run lint         # ESLint
npm run db:migrate   # Applique migrations Liquibase
npm run db:status    # Migrations en attente
npm run db:rollback  # Rollback dernière migration
npm run db:validate  # Valide le changelog
npm run db:tag       # Tag l'état actuel
```

## Structure des dossiers
```
app/              # Pages Next.js App Router
  accueil/        # Dashboard post-login (DashboardClient.tsx)
  listings/       # [id]/ detail  new/ création
  map/            # Page carte principale (MapView)
  messages/       # Messagerie + [id]/ conversation
  evenements/     # Événements + [id]/ + new/
  profil/[id]/    # Profil public
  profile/        # Mon profil
  auth/           # login / register
  api/            # Routes API : notifications, firebase-sw, account/delete, internal/send-email
components/
  layout/         # Navbar, FirebaseSWRegister, PWAInstallBanner, PushNotificationBanner
  map/            # LeafletMap, MapView, FilterBar, EventCard, CarpoolMiniMap, EventMiniMap...
  listings/       # ListingCard
  forms/          # AddressAutocomplete, EventForm
  messages/
  profil/
  theme/          # ThemeProvider
lib/
  supabase/       # client.ts (browser) | server.ts (Server Components)
  types.ts        # Tous les types partagés
  categories.ts   # Source de vérité des catégories
  utils.ts        # cn(), normalizeSearch(), formatDate(), avatar helpers...
  firebase.ts     # Firebase init
  fcm-admin.ts    # Firebase Admin (push serveur)
  pushNotifications.ts
  email-notifications.ts
liquibase/        # Migrations DB
  changelog/      # Fichiers SQL numérotés (001→024)
  db.changelog-master.xml
```

## Clients Supabase — Règle critique
| Contexte | Import |
|---|---|
| Composants `'use client'` | `import { createClient } from '@/lib/supabase/client'` |
| Server Components / Server Actions | `import { createClient } from '@/lib/supabase/server'` |
Mélanger les deux cause des erreurs de cookies/session.

## Pattern de données
- **Tout est client-side** : pas d'API routes ni Server Actions pour la data
- Les annonces géolocalisées passent toujours par le RPC PostGIS :
  ```ts
  supabase.rpc('listings_within_radius', { lat, lng, radius_km })
  // Retourne : distance_m, lat_out, lng_out + champs listing
  // Seules les annonces avec lat_out/lng_out sont affichées sur la carte
  ```

## Auth
- Auth client-side via `supabase.auth`
- `middleware.ts` refresh les cookies mais `protectedPaths` est vide — protection dans les composants
- Dans les pages créant de la data : appeler `supabase.auth.getUser()` **après** `onAuthStateChange` pour éviter les faux nulls

## Leaflet / SSR
- Leaflet ne peut pas tourner côté serveur
- Tous les composants map chargés avec `dynamic(..., { ssr: false })`
- `LeafletMap` gère son instance Leaflet de façon impérative via refs (ne pas réinitialiser au re-render)

## Dark mode
- Classe `dark` ajoutée sur `<html>` (script anti-FOUC dans `app/layout.tsx`)
- Overrides dark dans `app/globals.css` sous `html.dark`
- Géré par `ThemeProvider` (Zustand)
