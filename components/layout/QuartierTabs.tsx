'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, ShoppingCart, Wrench, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// `short` est le libellé mobile : les libellés complets ne tiennent pas dans les
// 328 px disponibles sur un écran de 360 px. L'icône lève l'ambiguïté de
// l'abréviation.
const TABS = [
  { href: '/infos', label: 'Vie du quartier', short: 'Quartier', icon: Megaphone },
  { href: '/achats', label: 'Achats groupés', short: 'Achats', icon: ShoppingCart },
  { href: '/prestataires', label: 'Prestataires', short: 'Presta.', icon: Wrench },
  { href: '/documents', label: 'Documents ASL', short: 'Docs ASL', icon: FileText },
] as const

/**
 * Onglets communs aux quatre pages « Quartier » (/infos, /achats, /prestataires,
 * /documents), rendus par le layout du route group `app/(quartier)/`.
 *
 * Contrôle segmenté en `grid-cols-4` : chaque onglet occupe un quart de la
 * largeur, donc la barre ne peut pas déborder — pas de défilement horizontal,
 * les quatre destinations restent visibles d'un coup d'œil. Sur mobile l'icône
 * passe au-dessus du libellé pour libérer de la largeur ; « Prestataires » est
 * abrégé parce qu'il ne tient plus dans un quart de 320 px.
 */
export function QuartierTabs() {
  const pathname = usePathname()

  return (
    <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-edge bg-surface-sunken p-1">
      {TABS.map(tab => {
        const active = pathname?.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            title={tab.label}
            className={cn(
              'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2',
              'rounded-xl px-1 sm:px-3 py-2 text-center text-xs sm:text-sm font-medium leading-tight transition-colors',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-content-muted hover:bg-surface hover:text-brand-700'
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
