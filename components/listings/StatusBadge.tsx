import { Check, Clock, Bookmark, Minus, ArrowLeftRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LISTING_STATUS_COLORS, LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/types'

/**
 * Icône de chaque statut : avec la forme de la pastille (pleine, contour, grise)
 * et le libellé, c'est elle qui distingue les statuts, tous dans les verts.
 */
const STATUS_ICONS: Record<ListingStatus, LucideIcon> = {
  disponible: Check,
  en_cours: Clock,
  reserve: Bookmark,
  validee: ArrowLeftRight,
  termine: Minus,
}

interface Props {
  status: ListingStatus
  /** Afficher tous les statuts, y compris "disponible" (utile sur la page détail). Par défaut false. */
  showAll?: boolean
  className?: string
}

export function StatusBadge({ status, showAll = false, className }: Props) {
  if (status === 'disponible' && !showAll) return null
  const Icon = STATUS_ICONS[status]

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-semibold pl-1.5 pr-2 py-0.5 rounded-[7px]',
      LISTING_STATUS_COLORS[status],
      className,
    )}>
      <Icon size={12} strokeWidth={2.8} aria-hidden="true" />
      {LISTING_STATUS_LABELS[status]}
    </span>
  )
}
