'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Megaphone, ShoppingCart, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

// `short` est le libellé mobile : les trois libellés complets demandent ~410 px,
// soit plus que les 328 px disponibles sur un écran de 360 px. L'icône lève
// l'ambiguïté de l'abréviation.
const TABS = [
  { href: '/infos', label: 'Vie du quartier', short: 'Quartier', icon: Megaphone },
  { href: '/achats', label: 'Achats groupés', short: 'Achats', icon: ShoppingCart },
  { href: '/prestataires', label: 'Prestataires', short: 'Prestataires', icon: Wrench },
] as const

/**
 * Onglets communs aux trois pages « Quartier » (/infos, /achats, /prestataires),
 * rendus par le layout du route group `app/(quartier)/`.
 *
 * Contrôle segmenté en `grid-cols-3` : chaque onglet occupe un tiers de la
 * largeur, donc la barre ne peut pas déborder — pas de défilement horizontal,
 * les trois destinations restent visibles d'un coup d'œil. Sur mobile l'icône
 * passe au-dessus du libellé pour libérer de la largeur.
 */
export function QuartierTabs() {
  const pathname = usePathname()

  return (
    <nav className="grid grid-cols-3 gap-1 rounded-2xl border border-edge bg-surface-sunken p-1">
      {TABS.map(tab => {
        const active = pathname?.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2',
              // padding mobile réduit au minimum : « Prestataires » est le
              // libellé le plus long et doit tenir sans césure sur un 320 px.
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
