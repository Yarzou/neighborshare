/**
 * Source de vérité unique pour les catégories d'annonces.
 * Toutes les références aux catégories dans l'app doivent importer d'ici.
 */

export interface CategoryDef {
  /** ID stable en base (serial, 1–7) */
  id: number
  slug: string
  /** Label complet affiché sur la page d'accueil et dans les formulaires */
  label: string
  /** Label court pour les filtres (carte, derniers ajouts) */
  filterLabel: string
  icon: string
  /** Classes Tailwind pour les tuiles de la page d'accueil */
  color: string
}

export const CATEGORY_LIST: CategoryDef[] = [
  { id: 1, slug: 'outils',       label: 'Outils',          filterLabel: 'Outils',   icon: '🔧', color: 'bg-blue-50 border-blue-200' },
  { id: 2, slug: 'services',     label: 'Services',         filterLabel: 'Services', icon: '🤝', color: 'bg-green-50 border-green-200' },
  { id: 3, slug: 'garde-enfant', label: "Garde d'enfant",   filterLabel: 'Enfants',  icon: '👶', color: 'bg-pink-50 border-pink-200' },
  { id: 4, slug: 'covoiturage',  label: 'Covoiturage',      filterLabel: 'Trajet',   icon: '🚗', color: 'bg-yellow-50 border-yellow-200' },
  { id: 5, slug: 'dons',         label: 'Dons / Objets',    filterLabel: 'Dons',     icon: '📦', color: 'bg-purple-50 border-purple-200' },
  { id: 6, slug: 'jardinage',    label: 'Jardinage',        filterLabel: 'Jardin',   icon: '🌿', color: 'bg-emerald-50 border-emerald-200' },
  { id: 7, slug: 'cuisine',      label: 'Cuisine',          filterLabel: 'Cuisine',  icon: '🍳', color: 'bg-orange-50 border-orange-200' },
]

/** Slugs de catégories incompatibles avec le type "vente" */
export const VENTE_EXCLUDED_SLUGS = ['covoiturage', 'garde-enfant'] as const

/**
 * Retourne l'emoji correspondant à l'ID de catégorie.
 * Utilisé dans ListingCard, ProfileClient, LeafletMap.
 */
export function getCategoryEmoji(id: number | null): string {
  const cat = CATEGORY_LIST.find(c => c.id === id)
  return cat?.icon ?? '📍'
}

/** Liste pour les barres de filtres — inclut "Tout" en tête */
export const FILTER_CATEGORIES = [
  { slug: '', label: 'Tout', icon: '🗺️' },
  ...CATEGORY_LIST.map(c => ({ slug: c.slug, label: c.filterLabel, icon: c.icon })),
]
