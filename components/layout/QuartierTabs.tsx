'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, ShoppingCart, Wrench, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Les quatre sections « Quartier », source unique pour les onglets mobiles
 * (`QuartierTabs`) et le volet desktop (`QuartierSidebar`).
 *
 * `short` est le libellé mobile : les libellés complets ne tiennent pas dans les
 * 328 px disponibles sur un écran de 360 px. L'icône lève l'ambiguïté de
 * l'abréviation. `description` n'est affichée que dans le volet desktop.
 */
export const QUARTIER_SECTIONS = [
  { href: '/infos', label: 'Vie du quartier', short: 'Quartier', description: 'Infos officielles et sondages', icon: Megaphone },
  { href: '/achats', label: 'Achats groupés', short: 'Achats', description: 'Commander à plusieurs', icon: ShoppingCart },
  { href: '/prestataires', label: 'Prestataires', short: 'Presta.', description: 'Les artisans recommandés', icon: Wrench },
  { href: '/documents', label: 'Documents ASL', short: 'Docs ASL', description: 'Ordres du jour et PV des AG', icon: FileText },
] as const

/**
 * Onglets des pages « Quartier » — **mobile uniquement** : à partir de md le
 * layout du route group `app/(quartier)/` les remplace par `QuartierSidebar`.
 *
 * Contrôle segmenté en `grid-cols-4` : chaque onglet occupe un quart de la
 * largeur, donc la barre ne peut pas déborder — pas de défilement horizontal,
 * les quatre destinations restent visibles d'un coup d'œil. L'icône passe
 * au-dessus du libellé pour libérer de la largeur.
 */
export function QuartierTabs() {
  const pathname = usePathname()

  return (
    <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-edge bg-surface-sunken p-1">
      {QUARTIER_SECTIONS.map(tab => {
        const active = pathname?.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            title={tab.label}
            className={cn(
              'flex flex-col items-center justify-center gap-1',
              'rounded-xl px-1 py-2 text-center text-xs font-medium leading-tight transition-colors',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-content-muted hover:bg-surface hover:text-brand-700'
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span>{tab.short}</span>
          </Link>
        )
      })}
    </nav>
  )
}
