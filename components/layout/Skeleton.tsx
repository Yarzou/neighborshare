import { cn } from '@/lib/utils'

/**
 * Blocs de remplissage pour les `loading.tsx`.
 *
 * Un squelette et non un rond qui tourne : il occupe la place de ce qui arrive,
 * donc la page ne se réorganise pas sous le curseur quand la donnée atterrit.
 * Tokens sémantiques (`bg-surface-sunken`, `border-edge`) : ils basculent seuls
 * en thème sombre, sans passer par le bloc de surcharges `!important` de
 * `globals.css`.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-sunken', className)} />
}

/** Carte générique : une image, un titre, deux lignes de texte. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-edge bg-surface p-4 flex flex-col gap-3', className)}>
      <SkeletonBlock className="h-32 w-full" />
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3 w-1/3" />
    </div>
  )
}

/** Ligne de liste : pastille ronde + deux lignes. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3', className)}>
      <SkeletonBlock className="h-11 w-11 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <SkeletonBlock className="h-3.5 w-1/3" />
        <SkeletonBlock className="h-3 w-2/3" />
      </div>
    </div>
  )
}
