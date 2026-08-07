import { SkeletonBlock } from '@/components/layout/Skeleton'

/** Largeurs variables : un fil de messages n'est pas un tableau régulier. */
const BUBBLES = [
  { w: 'w-2/3', me: false },
  { w: 'w-1/2', me: true },
  { w: 'w-3/4', me: false },
  { w: 'w-2/5', me: true },
  { w: 'w-3/5', me: false },
]

export default function Loading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-w-5xl mx-auto w-full">
      {/* En-tête de conversation */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-edge bg-surface flex-shrink-0">
        <SkeletonBlock className="h-5 w-5" />
        <SkeletonBlock className="h-9 w-9 rounded-full" />
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonBlock className="h-3.5 w-40" />
          <SkeletonBlock className="h-3 w-24" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col gap-3">
        {BUBBLES.map((b, i) => (
          <div key={i} className={b.me ? 'flex justify-end' : 'flex'}>
            <SkeletonBlock className={`h-10 ${b.w}`} />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-edge bg-surface flex-shrink-0">
        <SkeletonBlock className="h-10 w-full rounded-full" />
      </div>
    </div>
  )
}
