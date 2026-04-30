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
  /** Classes Tailwind pour les tuiles de la page d'accueil et les cartes d'annonces */
  color: string
  /** Classes Tailwind pour le survol des cartes d'annonces (légèrement plus foncé) */
  hoverColor: string
  /** Classes Tailwind pour le mode contour seul (fond blanc + bordure colorée) */
  borderOnly: string
}

export const CATEGORY_LIST: CategoryDef[] = [
  { id: 1, slug: 'outils',       label: 'Outils',          filterLabel: 'Outils',   icon: '🔧', color: 'bg-blue-50 border-blue-200',       hoverColor: 'hover:bg-blue-100 hover:border-blue-300',     borderOnly: 'bg-white border-blue-300 hover:border-blue-400' },
  { id: 2, slug: 'services',     label: 'Services',         filterLabel: 'Services', icon: '🤝', color: 'bg-green-50 border-green-200',     hoverColor: 'hover:bg-green-100 hover:border-green-300',   borderOnly: 'bg-white border-green-300 hover:border-green-400' },
  { id: 3, slug: 'garde-enfant', label: "Garde d'enfant",   filterLabel: 'Enfants',  icon: '👶', color: 'bg-pink-50 border-pink-200',       hoverColor: 'hover:bg-pink-100 hover:border-pink-300',     borderOnly: 'bg-white border-pink-300 hover:border-pink-400' },
  { id: 4, slug: 'covoiturage',  label: 'Covoiturage',      filterLabel: 'Trajet',   icon: '🚗', color: 'bg-yellow-50 border-yellow-200',   hoverColor: 'hover:bg-yellow-100 hover:border-yellow-300', borderOnly: 'bg-white border-yellow-400 hover:border-yellow-500' },
  { id: 5, slug: 'dons',         label: 'Dons / Objets',    filterLabel: 'Dons',     icon: '📦', color: 'bg-purple-50 border-purple-200',   hoverColor: 'hover:bg-purple-100 hover:border-purple-300', borderOnly: 'bg-white border-purple-300 hover:border-purple-400' },
  { id: 6, slug: 'jardinage',    label: 'Jardinage',        filterLabel: 'Jardin',   icon: '🌿', color: 'bg-emerald-50 border-emerald-200', hoverColor: 'hover:bg-emerald-100 hover:border-emerald-300', borderOnly: 'bg-white border-emerald-300 hover:border-emerald-400' },
  { id: 7, slug: 'cuisine',      label: 'Cuisine',          filterLabel: 'Cuisine',  icon: '🍳', color: 'bg-orange-50 border-orange-200',   hoverColor: 'hover:bg-orange-100 hover:border-orange-300', borderOnly: 'bg-white border-orange-300 hover:border-orange-400' },
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

/**
 * Retourne les classes Tailwind de fond/bordure pour une carte d'annonce,
 * avec variante hover légèrement plus foncée.
 * Fallback sur blanc si la catégorie est inconnue.
 */
export function getCategoryCardClasses(id: number | null): string {
  const cat = CATEGORY_LIST.find(c => c.id === id)
  if (!cat) return 'bg-white border-gray-200 hover:border-brand-300 hover:shadow-sm'
  return `${cat.color} ${cat.hoverColor} hover:shadow-sm`
}

/**
 * Retourne les classes Tailwind de contour seul (fond blanc + bordure colorée)
 * pour le mode carte (map page) où le fond coloré serait trop chargé visuellement.
 */
export function getCategoryBorderOnlyClasses(id: number | null): string {
  const cat = CATEGORY_LIST.find(c => c.id === id)
  if (!cat) return 'bg-white border-gray-300 hover:border-brand-400 hover:shadow-sm'
  return `${cat.borderOnly} hover:shadow-sm`
}

/** Liste pour les barres de filtres — inclut "Tout" en tête */
export const FILTER_CATEGORIES = [
  { slug: '', label: 'Tout', icon: '🗺️', color: '', hoverColor: '' },
  ...CATEGORY_LIST.map(c => ({ slug: c.slug, label: c.filterLabel, icon: c.icon, color: c.color, hoverColor: c.hoverColor })),
]
