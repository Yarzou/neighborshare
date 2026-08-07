import { SkeletonBlock } from '@/components/layout/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <SkeletonBlock className="h-20 w-20 rounded-full flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
      </div>
      <SkeletonBlock className="h-16 w-full" />
      {Array.from({ length: 2 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  )
}
