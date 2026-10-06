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
    // Contrôle segmenté façon iOS : fond gris, l'onglet choisi en blanc (refonte 2026-10-06).
    <nav className="grid grid-cols-4 gap-0.5 rounded-xl bg-gray-200 p-0.5">
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
              'rounded-[10px] px-1 py-2 text-center text-xs leading-tight transition-colors',
              active
                ? 'bg-white text-gray-900 font-semibold shadow-sm'
                : 'text-gray-700 font-medium hover:text-gray-900'
            )}
          >
            <Icon size={16} className={cn('shrink-0', active && 'text-brand-600')} />
            <span>{tab.short}</span>
          </Link>
        )
      })}
    </nav>
  )
}
