import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Clock, CalendarDays } from 'lucide-react'
import type { Listing } from '@/lib/types'
import { getCategoryCardClasses, getCategoryBorderOnlyClasses } from '@/lib/categories'
import { CategoryTile } from './CategoryIcon'
import { formatDate, formatChildcarePeriod, formatChildcareSlots, cn } from '@/lib/utils'
import { TypeBadge } from './TypeBadge'
import { StatusBadge } from './StatusBadge'

const CarpoolMiniMap = dynamic(() => import('@/components/map/CarpoolMiniMap'), { ssr: false })

interface Props {
  listing: Listing
  compact?: boolean
  onClick?: () => void
  active?: boolean
  outlineOnly?: boolean
}

export function ListingCard({ listing, compact = false, onClick, active, outlineOnly = false }: Props) {
  const content = (
    <div className={cn(
      'rounded-2xl border transition-all cursor-pointer',
      active
        ? 'bg-white border-brand-600 ring-1 ring-brand-600 shadow-sm'
        : outlineOnly
          ? getCategoryBorderOnlyClasses(listing.category_id)
          : getCategoryCardClasses(listing.category_id),
      compact ? 'flex gap-3 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : 'flex flex-col overflow-hidden shadow-sm'
    )} onClick={onClick}>

      {/* Image / Carte covoiturage / Garde d'enfant */}
      {listing.carpool_departure_lat && listing.carpool_arrival_lat ? (
        compact ? (
          <CategoryTile id={listing.category_id} type={listing.type} size="lg" />
        ) : (
          <div className="w-full h-44 max-h-[35vh] overflow-hidden rounded-t-2xl flex-shrink-0">
            <CarpoolMiniMap
              departureLat={listing.carpool_departure_lat}
              departureLng={listing.carpool_departure_lng!}
              departureLabel={listing.carpool_departure_address ?? 'Départ'}
              arrivalLat={listing.carpool_arrival_lat}
              arrivalLng={listing.carpool_arrival_lng!}
              arrivalLabel={listing.carpool_arrival_address ?? 'Arrivée'}
              className="w-full h-full"
            />
          </div>
        )
      ) : listing.childcare_slots && listing.childcare_slots.length > 0 ? (
        compact ? (
          <CategoryTile id={listing.category_id} type={listing.type} size="lg" />
        ) : (
          <div className="w-full h-44 max-h-[35vh] overflow-hidden rounded-t-2xl flex-shrink-0 bg-gray-100 flex flex-col items-center justify-center gap-2 px-4">
            <CalendarDays size={28} className="text-brand-600" />
            <div className="text-center text-sm font-medium text-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Disponibilités</div>
              <div>{formatChildcareSlots(listing.childcare_slots)}</div>
            </div>
          </div>
        )
      ) : listing.childcare_start_at && listing.childcare_end_at ? (
        compact ? (
          <CategoryTile id={listing.category_id} type={listing.type} size="lg" />
        ) : (() => {
          const { startLabel, endLabel, sameDay } = formatChildcarePeriod(listing.childcare_start_at, listing.childcare_end_at)
          return (
            <div className="w-full h-44 max-h-[35vh] overflow-hidden rounded-t-2xl flex-shrink-0 bg-gray-100 flex flex-col items-center justify-center gap-2 px-4">
              <CalendarDays size={28} className="text-brand-600" />
              <div className="text-center text-sm font-medium text-gray-800">
                <div>{startLabel}</div>
                {sameDay ? (
                  <div className="text-gray-500">→ {endLabel}</div>
                ) : (
                  <div className="text-gray-500">→ {endLabel}</div>
                )}
              </div>
            </div>
          )
        })()
      ) : listing.image_url ? (
        <div className={cn('relative flex-shrink-0 bg-gray-100 overflow-hidden', compact ? 'w-16 h-16 rounded-xl' : 'w-full h-44 max-h-[35vh]')}>
          {/* Sans `sizes`, `fill` fait supposer 100vw à Next, qui sert alors une
              image de pleine largeur d'écran dans une vignette de 64 px. */}
          <Image
            src={listing.image_url}
            alt={listing.title}
            fill
            sizes={compact ? '64px' : '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw'}
            className={cn('rounded-xl', compact ? 'object-cover' : 'object-contain')}
          />
        </div>
      ) : compact ? (
        <CategoryTile id={listing.category_id} type={listing.type} size="lg" />
      ) : (
        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
          <CategoryTile id={listing.category_id} type={listing.type} size="lg" />
        </div>
      )}

      {/* Content */}
      <div className={cn('flex flex-col gap-1 min-w-0', compact ? 'flex-1' : 'p-4')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold text-gray-900 truncate', compact ? 'text-sm' : 'text-base')}>
            {listing.title}
          </h3>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <StatusBadge status={listing.status} />
            {listing.listing_intent === 'demande' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-[7px] ring-1 ring-inset ring-current text-brand-700">
                Recherche
              </span>
            )}
            <TypeBadge type={listing.type} />
            {listing.type === 'vente' && listing.price != null && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-[7px] bg-gray-100 text-gray-900">
                {listing.price % 1 === 0
                  ? `${listing.price} €`
                  : `${Number(listing.price).toFixed(2).replace('.', ',')} €`}
              </span>
            )}
          </div>
        </div>

        {listing.book_author && (
          <p className="text-xs text-gray-500 italic truncate">{listing.book_author}</p>
        )}

        {!compact && listing.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{listing.description}</p>
        )}

        <div className="flex items-center gap-3 mt-auto pt-1">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={11} /> {formatDate(listing.created_at)}
          </span>
        </div>
      </div>
    </div>
  )

  if (onClick) return content
  return <Link href={`/listings/${listing.id}`}>{content}</Link>
}
