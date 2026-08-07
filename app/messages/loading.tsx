import { SkeletonBlock, SkeletonRow } from '@/components/layout/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-10 w-10 rounded-full sm:w-48 sm:rounded-xl" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
