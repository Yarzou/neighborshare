'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Event, Profile } from '@/lib/types'
import { cn, getAvatarStyle } from '@/lib/utils'
import { EventActions } from '@/components/map/EventActions'
import EventMiniMap from '@/components/map/EventMiniMapDynamic'
import { createClient } from '@/lib/supabase/client'

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
  const router = useRouter()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [creator, setCreator] = useState<Profile | null>(null)
  const photos = event.image_urls ?? []
  const isPast = new Date(event.event_date) < new Date()
  const hasCoords = event.location_lat != null && event.location_lng != null

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_color')
      .eq('id', event.user_id)
      .single()
      .then(({ data }) => { if (data) setCreator(data as Profile) })
  }, [event.user_id])

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
              <span>
                {formatFullDate(event.event_date)}
                {event.event_end_date && new Date(event.event_date).toDateString() !== new Date(event.event_end_date).toDateString() && (
                  <> → {formatFullDate(event.event_end_date)}</>
                )}
              </span>
            </div>
            {(() => {
              const startTime = formatTime(event.event_date)
              const hasStartTime = startTime !== '00:00'
              const endTime = event.event_end_date ? formatTime(event.event_end_date) : null
              const hasEndTime = endTime && endTime !== '00:00'
              if (!hasStartTime && !hasEndTime) return null
              return (
                <div className="flex items-center gap-2 text-sm text-brand-600 font-medium pl-[23px]">
                  <Clock size={13} className="shrink-0" />
                  <span>
                    {hasStartTime && startTime}
                    {hasStartTime && hasEndTime && ` → ${endTime}`}
                    {!hasStartTime && hasEndTime && `jusqu'à ${endTime}`}
                  </span>
                </div>
              )
            })()}
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

          {/* Créateur */}
          {creator && (
            <>
              <div className="border-t border-gray-100" />
              <Link
                href={`/profil/${creator.id}`}
                className="flex items-center gap-2.5 group w-fit"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={getAvatarStyle(creator.avatar_color ?? undefined)}
                >
                  {(creator.full_name || creator.username || 'V').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-600 group-hover:text-brand-600 transition-colors">
                  Créé par <span className="font-semibold">{creator.full_name || creator.username || 'Voisin'}</span>
                </span>
              </Link>
            </>
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

          {/* Actions modifier/supprimer : UN SEUL composant, partagé avec le popup
              et le profil — ne rien rajouter en dur ici (cf. EventActions) */}
          <EventActions
            variant="stacked"
            event={event}
            onDeleted={() => router.push('/evenements')}
          />
        </div>
      </div>
    </div>
  )
}
