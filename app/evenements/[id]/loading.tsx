import { SkeletonBlock } from '@/components/layout/Skeleton'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
      <SkeletonBlock className="h-4 w-48" />
      <div className="rounded-3xl border border-edge bg-surface overflow-hidden">
        <SkeletonBlock className="h-56 w-full rounded-none" />
        <div className="p-5 flex flex-col gap-3">
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-4 w-52" />
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-4/5" />
        </div>
      </div>
    </div>
  )
}
