# Historique des modifications (par session)

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
