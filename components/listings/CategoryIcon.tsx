import { Wrench, HeartHandshake, Baby, Car, Package, Sprout, CookingPot, BookOpen, MapPin, LayoutGrid, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCategorySlug, getCategoryTileClass } from '@/lib/categories'
import { LISTING_TYPE_MARKER_COLORS, type ListingType } from '@/lib/types'

/**
 * Icônes des catégories, par slug (IDs stables dans lib/categories.ts).
 * Remplacent les émojis dans l'interface ; les marqueurs Leaflet, construits en
 * HTML brut, gardent l'émoji de `CategoryDef.icon`.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  outils: Wrench,
  services: HeartHandshake,
  'garde-enfant': Baby,
  covoiturage: Car,
  dons: Package,
  jardinage: Sprout,
  cuisine: CookingPot,
  livre: BookOpen,
}

/** Icône d'une catégorie, par slug ('' = « Tout ») ou par ID. */
export function CategoryIcon({ slug, id, size = 18, className }: {
  slug?: string
  id?: number | null
  size?: number
  className?: string
}) {
  const key = slug ?? getCategorySlug(id ?? null)
  const Icon = key === '' && slug === '' ? LayoutGrid : CATEGORY_ICONS[key] ?? MapPin
  return <Icon size={size} className={className} aria-hidden="true" />
}

const TILE_SIZES = {
  sm: { box: 'w-9 h-9 rounded-[10px]', icon: 19 },
  md: { box: 'w-11 h-11 rounded-xl', icon: 22 },
  lg: { box: 'w-16 h-16 rounded-2xl', icon: 30 },
} as const

/**
 * Pastille d'icône : l'icône dit la catégorie, le fond dit le type d'annonce
 * (`type`, couleurs de LISTING_TYPE_MARKER_COLORS). Sans type, le fond prend la
 * nuance de vert de la catégorie.
 */
export function CategoryTile({ id, type, size = 'md', className }: {
  id: number | null
  type?: ListingType
  size?: keyof typeof TILE_SIZES
  className?: string
}) {
  const s = TILE_SIZES[size]
  return (
    <span
      className={cn('flex items-center justify-center shrink-0 text-white', s.box, !type && getCategoryTileClass(id), className)}
      style={type ? { backgroundColor: LISTING_TYPE_MARKER_COLORS[type] } : undefined}
    >
      <CategoryIcon id={id} size={s.icon} />
    </span>
  )
}
