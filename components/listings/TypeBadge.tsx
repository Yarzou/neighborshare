import { cn } from '@/lib/utils'
import { LISTING_TYPE_COLORS, LISTING_TYPE_LABELS, type ListingType } from '@/lib/types'

interface Props {
  type: ListingType
  className?: string
}

export function TypeBadge({ type, className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
      LISTING_TYPE_COLORS[type],
      className,
    )}>
      {LISTING_TYPE_LABELS[type]}
    </span>
  )
}
