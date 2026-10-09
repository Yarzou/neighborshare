'use client'

import { usePathname } from 'next/navigation'
import { cn, SIDE_PANE_WIDTH } from '@/lib/utils'
import { QuartierTabs } from './QuartierTabs'
import { QuartierSidebar } from './QuartierSidebar'

/** La visionneuse d'un document : `/documents/<id>` (et rien d'autre dessous) */
const VIEWER_PATH = /^\/documents\/[^/]+$/

/**
 * Cadre des pages « Quartier », rendu par le layout du route group `app/(quartier)/`.
 *
 * Mobile : colonne de lecture (max-w-2xl) avec la barre d'onglets en tête.
 * Desktop (md+) : même cadre que Messages et Événements — volet gauche fixe
 * (`QuartierSidebar`, largeur commune `SIDE_PANE_WIDTH`), contenu pleine largeur
 * à droite avec son propre défilement, hauteur `var(--app-h)` (sous la barre du haut).
 *
 * Cas particulier, la **visionneuse** (`/documents/[id]`) : elle remplace la page
 * Documents ASL dans le volet de droite — le volet gauche reste visible — et se
 * rend **sans** la colonne de lecture ni les onglets, pour que le rendu mobile
 * reste celui d'une page plein écran, comme avant son entrée dans le groupe.
 *
 * Composant client uniquement pour `usePathname` : le layout, lui, reste serveur.
 */
export function QuartierFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isViewer = VIEWER_PATH.test(pathname ?? '')

  return (
    <div className="md:flex md:h-[var(--app-h)]">
      <aside className={cn('hidden md:flex md:shrink-0 md:flex-col md:bg-surface-pane md:border-r md:border-edge md:overflow-y-auto', SIDE_PANE_WIDTH)}>
        <QuartierSidebar />
      </aside>
      <div className="md:flex-1 md:min-w-0 md:overflow-y-auto">
        {isViewer ? children : (
          <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:max-w-none md:mx-0 md:px-8 md:pt-2 md:pb-10">
            <div className="md:hidden">
              <QuartierTabs />
            </div>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
