# NeighborShare — Copilot Instructions

NeighborShare is a French-language, geolocation-based neighborhood sharing platform built with **Next.js 14 App Router**, **Supabase** (PostgreSQL + PostGIS), **Leaflet/OpenStreetMap**, and **Tailwind CSS**.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (next lint)

# Database migrations (Liquibase)
npm run db:status    # Show pending migrations
npm run db:migrate   # Apply pending migrations
npm run db:rollback  # Roll back last migration
npm run db:validate  # Validate changelog
npm run db:tag       # Tag current state
```

There is no test suite.

## Architecture

### Supabase client split
- `lib/supabase/client.ts` — `createBrowserClient` for `'use client'` components
- `lib/supabase/server.ts` — `createServerClient` for Server Components and Server Actions (reads cookies from `next/headers`)
- Always import from the correct file; mixing them causes cookie/session issues.

### Data access pattern
All data is fetched **client-side** via the Supabase JS client. There are no Next.js API routes or Server Actions. Geospatial listing queries always go through the PostGIS RPC:

```ts
supabase.rpc('listings_within_radius', { lat, lng, radius_km })
```

This returns `distance_m`, `lat_out`, `lng_out` alongside listing fields — these are the coordinates used by the map. Only listings with `lat_out`/`lng_out` are rendered on the map.

### Leaflet / SSR
Leaflet cannot run server-side. All map components must be loaded with `dynamic(..., { ssr: false })`. The `LeafletMap` component manages its own Leaflet instance imperatively via refs; do **not** re-initialize the map on re-renders.

### Authentication
- Auth is managed client-side via `supabase.auth` in components.
- `middleware.ts` refreshes session cookies on every request but `protectedPaths` is intentionally empty — route protection is handled in the components themselves.
- In pages that create data (e.g., new listing), call `supabase.auth.getUser()` after an `onAuthStateChange` subscription is set up to avoid false nulls immediately after login.

### Category-driven conditional fields
The `listings/new` form shows different fields based on the selected category slug:
- `covoiturage` → carpool departure/arrival addresses (hides photo and standard address)
- `garde-enfant` → childcare datetime range (hides photo)

Category IDs are stable integers (1–6); their slugs are the canonical key used in code.

### Database migrations
Migrations use **Liquibase** with SQL changesets in `liquibase/changelog/`. The master file is `db.changelog-master.xml`. To add a migration, create a numbered `.sql` file and register it in the XML. Copy `liquibase/liquibase.properties.example` → `liquibase/liquibase.properties` and fill in the DB password (never commit this file).

The legacy raw SQL files in `supabase/` (e.g., `schema.sql`) are kept for reference but the Liquibase changelog is the source of truth for migrations.

## Key Conventions

### Tailwind color palette
The custom `brand` color (green scale, `brand-50` → `brand-900`) is used for all primary actions and active states. Use `brand-600` for buttons and `brand-500` for focus rings. `warm` is used for secondary accents. Avoid hardcoding hex values.

### `cn()` utility
Use `cn()` from `lib/utils.ts` (wraps `clsx` + `tailwind-merge`) for conditional class names.

### Types
All shared types live in `lib/types.ts`. Status and type values use French slugs (`'disponible'`, `'pret'`, `'don'`, etc.). The display labels and badge colors are exported as record constants from the same file (`LISTING_TYPE_LABELS`, `LISTING_STATUS_COLORS`, etc.).

### Geography storage
Locations are stored as PostGIS `geography(Point, 4326)` in WGS84. When inserting, pass the raw WKT string: `POINT(lng lat)` (longitude first, latitude second — standard GeoJSON order).

### Address autocomplete
Address search uses the Nominatim (OpenStreetMap) API via the `AddressAutocomplete` component. The resolved address provides `lat`, `lon`, `road`, `city`, and `displayName`.

### Image storage
Listing images are uploaded to the `listings` Supabase Storage bucket under `{userId}/{timestamp}.{ext}`. The public URL is then stored in `listings.image_url`.
