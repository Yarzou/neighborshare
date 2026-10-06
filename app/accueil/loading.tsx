import { SkeletonBlock } from '@/components/layout/Skeleton'

/** Squelette calqué sur l'Accueil : salutation, deux actions, rangée d'annonces. */
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 md:pt-10 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-28 rounded-[18px]" />
        <SkeletonBlock className="h-28 rounded-[18px]" />
      </div>
      <SkeletonBlock className="h-6 w-44" />
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-40 w-[150px] shrink-0 rounded-[18px]" />)}
      </div>
    </div>
  )
}
