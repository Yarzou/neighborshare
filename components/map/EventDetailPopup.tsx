'use client'

import { useState } from 'react'
import { X, CalendarDays, MapPin, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import type { Event } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

interface EventDetailPopupProps {
  event: Event
  onClose: () => void
}

export function EventDetailPopup({ event, onClose }: EventDetailPopupProps) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = event.image_urls ?? []
  const isPast = new Date(event.event_date) < new Date()

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[1000] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl shadow-2xl bg-white border border-gray-200"
      onClick={e => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 z-10"
      >
        <X size={14} />
      </button>

      {/* Photo gallery */}
      {photos.length > 0 ? (
        <div className="relative w-full h-44 bg-gray-100 overflow-hidden rounded-t-2xl flex-shrink-0">
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
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPhotoIndex(i => (i + 1) % photos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow"
              >
                <ChevronRight size={16} />
              </button>
              {/* Dot indicators */}
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
              {/* Thumbnail strip */}
              {photos.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 hidden" />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="w-full h-20 bg-gradient-to-br from-brand-50 to-brand-100 rounded-t-2xl flex items-center justify-center">
          <CalendarDays size={32} className="text-brand-400" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Title + badge */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-base text-gray-900 leading-snug">{event.title}</h2>
          <span className={cn(
            'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            isPast ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-700'
          )}>
            {isPast ? 'Passé' : 'À venir'}
          </span>
        </div>

        {/* Date & time */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDays size={14} className="text-brand-500 shrink-0" />
            <span>{formatFullDate(event.event_date)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-brand-600 font-medium pl-5">
            <Clock size={13} className="shrink-0" />
            <span>
              {formatTime(event.event_date)}
              {event.event_end_date && ` → ${formatTime(event.event_end_date)}`}
            </span>
          </div>
        </div>

        {/* Location */}
        {event.location_text && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <span>{event.location_text}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        )}
      </div>
    </div>
  )
}
