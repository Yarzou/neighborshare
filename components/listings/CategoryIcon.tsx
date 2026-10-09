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

/**
 * Les mêmes icônes en SVG brut, pour les marqueurs Leaflet, construits en HTML hors
 * de React. Tracés recopiés de lucide-react (`__iconNode` de chaque icône) : à
 * garder alignés sur CATEGORY_ICONS si une icône change.
 */
const CATEGORY_ICON_MARKUP: Record<string, string> = {
  outils: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  services: '<path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/>',
  'garde-enfant': '<path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/>',
  covoiturage: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  dons: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  jardinage: '<path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/>',
  cuisine: '<path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/>',
  livre: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
}
const PIN_MARKUP = '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'

/** SVG de l'icône d'une catégorie, en chaîne, couleur `currentColor` (marqueurs de carte). */
export function categoryIconSvg(id: number | null): string {
  const inner = CATEGORY_ICON_MARKUP[getCategorySlug(id)] ?? PIN_MARKUP
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
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
