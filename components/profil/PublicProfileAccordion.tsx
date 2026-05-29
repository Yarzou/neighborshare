'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LISTING_TYPE_LABELS, LISTING_TYPE_COLORS } from '@/lib/types'

interface Listing {
  id: string
  title: string
  description: string | null
  type: string
  listing_intent: string | null
  image_url: string | null
}

interface Event {
  id: string
  title: string
  description: string | null
  event_date: string
  image_urls: string[]
}

interface Props {
  listings: Listing[]
  events: Event[]
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function PublicProfileAccordion({ listings, events }: Props) {
  const [listingsOpen, setListingsOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(true)

  return (
    <div className="flex flex-col gap-3">
      {/* Annonces actives */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setListingsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-800">
            Annonces actives{listings.length > 0 ? ` · ${listings.length}` : ''}
          </span>
          <ChevronDown
            size={16}
            className={cn('text-gray-400 transition-transform', listingsOpen && 'rotate-180')}
          />
        </button>

        {listingsOpen && (
          <div className="border-t border-gray-100">
            {listings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune annonce active pour le moment.</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50">
                {listings.map(listing => (
                  <Link key={listing.id} href={`/listings/${listing.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors group">
                    {listing.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">📦</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        {listing.listing_intent === 'demande' && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Recherche</span>
                        )}
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', LISTING_TYPE_COLORS[listing.type as keyof typeof LISTING_TYPE_COLORS])}>
                          {LISTING_TYPE_LABELS[listing.type as keyof typeof LISTING_TYPE_LABELS]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{listing.title}</p>
                      {listing.description && (
                        <p className="text-xs text-gray-400 line-clamp-1">{listing.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 group-hover:text-gray-400 transition-colors">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Événements */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setEventsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-800">
            Événements{events.length > 0 ? ` · ${events.length}` : ''}
          </span>
          <ChevronDown
            size={16}
            className={cn('text-gray-400 transition-transform', eventsOpen && 'rotate-180')}
          />
        </button>

        {eventsOpen && (
          <div className="border-t border-gray-100">
            {events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucun événement pour le moment.</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-50">
                {events.map(event => (
                  <Link key={event.id} href={`/evenements/${event.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors group">
                    {event.image_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_urls[0]} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                        <CalendarDays size={20} className="text-brand-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatEventDate(event.event_date)}</p>
                      {event.description && (
                        <p className="text-xs text-gray-400 line-clamp-1">{event.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 group-hover:text-gray-400 transition-colors">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
