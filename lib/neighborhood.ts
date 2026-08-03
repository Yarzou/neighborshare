/**
 * Configuration géographique du quartier.
 *
 * Le centre était dupliqué en dur dans `MapView.tsx` et `LeafletMap.tsx`, et le
 * rayon de recherche écrit en dur dans l'appel de données. Tout est centralisé ici.
 *
 * Les valeurs sont surchargeables par variables d'environnement pour pouvoir
 * déployer l'application sur un autre lotissement sans toucher au code.
 */

/** Latitude/longitude du centre du quartier (Les voisins du Cèdre par défaut) */
export const NEIGHBORHOOD_CENTER: [number, number] = [
  Number(process.env.NEXT_PUBLIC_NEIGHBORHOOD_LAT ?? 47.300837),
  Number(process.env.NEXT_PUBLIC_NEIGHBORHOOD_LNG ?? -1.560131),
]

/**
 * Zoom initial de la carte — au niveau du lotissement (rues + numéros), pas de
 * la ville : l'utilisateur ne doit pas avoir à rezoomer à chaque ouverture.
 * Max Leaflet/OSM du projet : 19. Ajustable sans code via NEXT_PUBLIC_NEIGHBORHOOD_ZOOM.
 */
export const NEIGHBORHOOD_DEFAULT_ZOOM = Number(
  process.env.NEXT_PUBLIC_NEIGHBORHOOD_ZOOM ?? 17
)

/**
 * Rayon de recherche des annonces, en kilomètres.
 *
 * Valeur historique conservée (50 km) : à l'échelle d'un lotissement toutes les
 * annonces sont de toute façon dans le périmètre, ce filtre n'écarte donc en
 * pratique qu'une annonce dont l'adresse aurait été saisie très loin.
 */
export const NEIGHBORHOOD_RADIUS_KM = Number(
  process.env.NEXT_PUBLIC_NEIGHBORHOOD_RADIUS_KM ?? 50
)

const EARTH_RADIUS_M = 6_371_000

/**
 * Distance en mètres entre deux points (formule de haversine).
 *
 * Remplace le `st_distance` que faisait le RPC `listings_within_radius` : la vue
 * `listings_geo` qui lui succède ne renvoie que les coordonnées, la distance et
 * le tri par proximité se calculent donc côté client. À l'échelle du quartier,
 * c'est quelques dizaines de lignes à trier — le coût est négligeable.
 */
export function distanceMeters(
  [lat1, lng1]: [number, number],
  [lat2, lng2]: [number, number]
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}
