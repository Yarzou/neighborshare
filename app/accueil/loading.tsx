import { SkeletonBlock } from '@/components/layout/Skeleton'

/** Squelette calqué sur l'Accueil « Résumé ASL » : salutation, info de l'ASL, liste « À suivre ». */
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-6 md:pt-10 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
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
  )
}
