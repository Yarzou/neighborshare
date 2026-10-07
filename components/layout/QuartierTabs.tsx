'use client'

import { usePathname } from 'next/navigation'
import { Megaphone, ShoppingCart, Wrench, FileText } from 'lucide-react'
import Segmented from '@/components/ui/Segmented'

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
 * Contrôle segmenté iOS 26 (`Segmented`, repris de Fridge) dont chaque segment
 * est un lien : la bulle glisse vers l'onglet touché sans attendre la page, et
 * suit le doigt si on le fait glisser (2026-10-07). Quatre cases égales : la
 * barre ne peut pas déborder, les quatre destinations restent visibles d'un coup
 * d'œil. L'icône passe au-dessus du libellé pour libérer de la largeur.
 */
export function QuartierTabs() {
  const pathname = usePathname() ?? ''
  const current = QUARTIER_SECTIONS.find(tab => pathname.startsWith(tab.href))?.href ?? ''

  return (
    <nav aria-label="Rubriques du quartier">
      <Segmented
        label="Rubriques du quartier"
        value={current}
        options={QUARTIER_SECTIONS.map(tab => ({
          value: tab.href,
          href: tab.href,
          label: tab.short,
          icon: tab.icon,
        }))}
        itemClassName="py-2 text-xs leading-tight"
      />
    </nav>
  )
}
