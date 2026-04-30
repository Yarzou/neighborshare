import { cn } from '@/lib/utils'
import { LISTING_STATUS_COLORS, LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/types'

interface Props {
  status: ListingStatus
  /** Afficher tous les statuts, y compris "disponible" (utile sur la page détail). Par défaut false. */
  showAll?: boolean
  className?: string
}

export function StatusBadge({ status, showAll = false, className }: Props) {
  if (status === 'disponible' && !showAll) return null

  return (
    <span className={cn(
      'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
      LISTING_STATUS_COLORS[status],
      className,
    )}>
      {LISTING_STATUS_LABELS[status]}
    </span>
  )
}
