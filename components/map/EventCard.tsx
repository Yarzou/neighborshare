'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Pencil } from 'lucide-react'
import type { Event } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatEventDate(event: Event): string {
  const start = new Date(event.event_date)
  const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const hasStartTime = timeStr !== '00:00'

  if (event.event_end_date) {
    const end = new Date(event.event_end_date)
    const endTimeStr = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const hasEndTime = endTimeStr !== '00:00'
    const sameDay = start.toDateString() === end.toDateString()

    if (sameDay) {
      if (hasStartTime && hasEndTime) return `${dateStr} · ${timeStr} – ${endTimeStr}`
      if (hasStartTime) return `${dateStr} · ${timeStr}`
      return dateStr
    } else {
      const endDateStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      if (hasStartTime && hasEndTime) return `${dateStr} ${timeStr} → ${endDateStr} ${endTimeStr}`
      return `${dateStr} → ${endDateStr}`
    }
  }

  if (hasStartTime) return `${dateStr} · ${timeStr}`
  return dateStr
}

interface EventCardProps {
  event: Event
  compact?: boolean
  onClick?: () => void
  selected?: boolean
  currentUserId?: string | null
}

export function EventCard({ event, compact = false, onClick, selected, currentUserId }: EventCardProps) {
  const router = useRouter()
  const isPast = new Date(event.event_date) < new Date()
  const firstImage = event.image_urls?.[0]
  const isOwner = !!currentUserId && event.user_id === currentUserId

  return (
    <div
      className={cn(
        'bg-white border rounded-2xl overflow-hidden transition-all',
        onClick && 'cursor-pointer',
        selected
          ? 'border-brand-500 shadow-md shadow-brand-100'
          : 'border-gray-200 hover:border-brand-300',
        isPast && !selected && 'opacity-60',
        compact ? 'flex gap-3 p-3 items-start' : 'flex flex-col'
      )}
      data-event-date={event.event_date.slice(0, 10)}
      onClick={onClick}
    >
      {/* Image */}
      {firstImage && (
        <div className={cn(
          'overflow-hidden flex-shrink-0 bg-gray-100',
          compact ? 'w-20 h-20 rounded-xl' : 'w-full h-40'
        )}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={firstImage} alt={event.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className={cn('flex flex-col gap-1', compact ? 'flex-1 min-w-0' : 'p-4')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold text-gray-900 leading-tight', compact ? 'text-sm' : 'text-base')}>
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <button
                onClick={e => { e.stopPropagation(); router.push(`/evenements/${event.id}/edit`) }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                aria-label="Modifier l'événement"
              >
                <Pencil size={13} />
              </button>
            )}
            {isPast && (
              <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Passé
              </span>
            )}
          </div>
        </div>

        <div className={cn('flex items-center gap-1 text-brand-600', compact ? 'text-xs' : 'text-sm')}>
          <CalendarDays size={compact ? 12 : 14} className="shrink-0" />
          <span className="truncate">{formatEventDate(event)}</span>
        </div>

        {event.location_text && (
          <div className={cn('flex items-center gap-1 text-gray-500 truncate', compact ? 'text-xs' : 'text-sm')}>
            <MapPin size={compact ? 12 : 14} className="shrink-0" />
            <span className="truncate">{event.location_text}</span>
          </div>
        )}

        {!compact && event.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{event.description}</p>
        )}

        {!compact && event.image_urls && event.image_urls.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {event.image_urls.slice(1).map((url, i) => (
              <div key={i} className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
