import { SkeletonBlock } from '@/components/layout/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-64 w-full rounded-2xl" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-6 w-20 rounded-full" />
        <SkeletonBlock className="h-6 w-24 rounded-full" />
      </div>
      <SkeletonBlock className="h-8 w-3/4" />
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-2/3" />
      </div>
      <SkeletonBlock className="h-12 w-full rounded-xl" />
    </div>
  )
}
