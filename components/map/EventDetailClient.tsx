'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Event } from '@/lib/types'
import { cn } from '@/lib/utils'
import EventMiniMap from '@/components/map/EventMiniMapDynamic'

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  event: Event
}

export default function EventDetailClient({ event }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = event.image_urls ?? []
  const isPast = new Date(event.event_date) < new Date()
  const hasCoords = event.location_lat != null && event.location_lng != null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/evenements"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={16} /> Retour à la liste des événements
      </Link>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Photo gallery */}
        {photos.length > 0 ? (
          <div className="relative w-full h-56 bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIndex]}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex(i => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow"
                  aria-label="Photo précédente"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setPhotoIndex(i => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 shadow"
                  aria-label="Photo suivante"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-all',
                        i === photoIndex ? 'bg-white scale-125' : 'bg-white/60'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
            <CalendarDays size={40} className="text-brand-400" />
          </div>
        )}

        <div className="p-6 flex flex-col gap-4">
          {/* Titre + badge */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{event.title}</h1>
            <span className={cn(
              'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
              isPast ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-700'
            )}>
              {isPast ? 'Passé' : 'À venir'}
            </span>
          </div>

          {/* Date et heure */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDays size={15} className="text-brand-500 shrink-0" />
              <span>{formatFullDate(event.event_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-brand-600 font-medium pl-[23px]">
              <Clock size={13} className="shrink-0" />
              <span>
                {formatTime(event.event_date)}
                {event.event_end_date && ` → ${formatTime(event.event_end_date)}`}
              </span>
            </div>
          </div>

          {/* Adresse + carte interactive */}
          {(event.location_text || hasCoords) && (
            <div className="flex flex-col gap-2">
              {event.location_text && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>{event.location_text}</span>
                </div>
              )}
              {hasCoords && (
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                  <EventMiniMap
                    lat={event.location_lat!}
                    lng={event.location_lng!}
                    label={event.location_text ?? event.title}
                    className="w-full h-52"
                    zoom={18}
                    interactive={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <>
              <div className="border-t border-gray-100" />
              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                {event.description}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
