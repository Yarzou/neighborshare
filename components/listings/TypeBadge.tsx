import { cn } from '@/lib/utils'
import { LISTING_TYPE_COLORS, LISTING_TYPE_LABELS, LISTING_TYPE_SHORT, type ListingType } from '@/lib/types'

interface Props {
  type: ListingType
  className?: string
}

/** Pastille neutre ; la lettre du type, sur fond vert, est la même que sur la carte. */
export function TypeBadge({ type, className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-xs font-semibold pl-0.5 pr-2 py-0.5 rounded-[7px]',
      LISTING_TYPE_COLORS[type],
      className,
    )}>
      <span aria-hidden="true" className="w-4 h-4 rounded-[5px] bg-brand-600 text-white text-[10px] font-bold leading-none flex items-center justify-center">
        {LISTING_TYPE_SHORT[type]}
      </span>
      {LISTING_TYPE_LABELS[type]}
    </span>
  )
}
