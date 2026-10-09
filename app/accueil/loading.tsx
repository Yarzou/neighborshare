import { SkeletonBlock } from '@/components/layout/Skeleton'

/**
 * Squelette calqué sur l'Accueil : « Résumé ASL » sur mobile (salutation, info de
 * l'ASL, « À suivre »), grille de widgets sur desktop (cf. DesktopWidgets).
 */
export default function Loading() {
  return (
    <>
      <div className="md:hidden max-w-2xl mx-auto px-4 pt-6 pb-6 flex flex-col gap-6">
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

      <div className="hidden md:block px-8 pt-8 pb-10">
        <div className="max-w-[1120px] mx-auto">
          <div className="mb-6 flex flex-col gap-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-9 w-56" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[188px] gap-4">
            <SkeletonBlock className="col-span-2 row-span-2 rounded-[24px]" />
            <SkeletonBlock className="col-span-2 rounded-[24px]" />
            <SkeletonBlock className="rounded-[24px]" />
            <SkeletonBlock className="rounded-[24px]" />
            <SkeletonBlock className="col-span-2 rounded-[24px]" />
            <SkeletonBlock className="rounded-[24px]" />
            <SkeletonBlock className="rounded-[24px]" />
          </div>
        </div>
      </div>
    </>
  )
}
