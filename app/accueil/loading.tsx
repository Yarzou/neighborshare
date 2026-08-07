import { SkeletonBlock, SkeletonCard } from '@/components/layout/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}
