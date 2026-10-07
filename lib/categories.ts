/**
 * Source de vérité unique pour les catégories d'annonces.
 * Toutes les références aux catégories dans l'app doivent importer d'ici.
 */

export interface CategoryDef {
  /** ID stable en base (serial, 1–8) */
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
  /**
   * Fond de la pastille d'icône (icône blanche dessus, cf. `CategoryTile`).
   * Une nuance de vert par catégorie : elle donne du relief à une liste de cartes
   * blanches, mais n'est jamais la seule information — l'icône et le libellé le sont.
   */
  tile: string
}

// Refonte « Verre et Cèdre » (2026-10-06) : les cartes d'annonce sont blanches,
// quelle que soit la catégorie. La couleur ne vit plus que dans la pastille d'icône.
const WHITE_CARD = 'bg-white border-gray-200'
const WHITE_HOVER = 'hover:border-gray-300'
const WHITE_OUTLINE = 'bg-white border-gray-200 hover:border-gray-300'

export const CATEGORY_LIST: CategoryDef[] = [
  { id: 1, slug: 'outils',       label: 'Outils',          filterLabel: 'Outils',   icon: '🔧', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 2, slug: 'services',     label: 'Services',         filterLabel: 'Services', icon: '🤝', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 3, slug: 'garde-enfant', label: "Garde d'enfant",   filterLabel: 'Enfants',  icon: '👶', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 4, slug: 'covoiturage',  label: 'Covoiturage',      filterLabel: 'Trajet',   icon: '🚗', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 5, slug: 'dons',         label: 'Dons / Objets',    filterLabel: 'Dons',     icon: '📦', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 6, slug: 'jardinage',    label: 'Jardinage',        filterLabel: 'Jardin',   icon: '🌿', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 7, slug: 'cuisine',      label: 'Cuisine',          filterLabel: 'Cuisine',  icon: '🍳', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
  { id: 8, slug: 'livre',        label: 'Livres',           filterLabel: 'Livres',   icon: '📚', color: WHITE_CARD, hoverColor: WHITE_HOVER, borderOnly: WHITE_OUTLINE, tile: 'bg-brand-600' },
]

/** Slug d'une catégorie à partir de son ID ('' si inconnue). */
export function getCategorySlug(id: number | null): string {
  return CATEGORY_LIST.find(c => c.id === id)?.slug ?? ''
}

/** Fond de la pastille d'icône d'une catégorie (vert Cèdre si inconnue). */
export function getCategoryTileClass(id: number | null): string {
  return CATEGORY_LIST.find(c => c.id === id)?.tile ?? 'bg-brand-600'
}

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
