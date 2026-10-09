import { SkeletonBlock } from '@/components/layout/Skeleton'
import { cn, SIDE_PANE_WIDTH } from '@/lib/utils'

/**
 * Squelette calqué sur l'Accueil « Résumé ASL » : salutation, info de l'ASL, liste
 * « À suivre ». Desktop : même cadre que la page (volet gauche + contenu).
 */
export default function Loading() {
  return (
    <div className="md:flex md:h-[var(--app-h)]">
      <aside className={cn('hidden md:flex md:shrink-0 md:flex-col md:gap-6 md:px-5 md:py-6 md:bg-surface-pane md:border-r md:border-edge', SIDE_PANE_WIDTH)}>
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-9 w-56" />
        </div>
        <SkeletonBlock className="h-32 rounded-2xl" />
      </aside>
      <div className="md:flex-1 md:min-w-0">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-6 flex flex-col gap-6 md:max-w-none md:mx-0 md:px-8 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-2 md:hidden">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-9 w-56" />
          </div>
          <div className="flex flex-col gap-2.5">
            <SkeletonBlock className="h-6 w-36" />
            <SkeletonBlock className="h-28 rounded-2xl" />
          </div>
          <div className="flex flex-col gap-2.5">
            <SkeletonBlock className="h-6 w-28" />
            <SkeletonBlock className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
