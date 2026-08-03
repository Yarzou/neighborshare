'use client'

import { useState } from 'react'
import { X, CalendarDays, MapPin, ChevronLeft, ChevronRight, Clock, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import type { Event } from '@/lib/types'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks'
import { deleteEventWithImages } from '@/lib/events'
import Link from 'next/link'

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
  /** Appelé après une suppression réussie, pour que la liste parente se mette à jour */
  onDeleted?: (eventId: string) => void
}

export function EventDetailPopup({ event, onClose, onDeleted }: EventDetailPopupProps) {
  const { userId, isReferent } = useCurrentUser()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const photos = event.image_urls ?? []
  const isPast = new Date(event.event_date) < new Date()

  const isOwner = userId === event.user_id
  // Cas nominal : le créateur. En plus, le référent (modération, policy 037).
  const canManage = isOwner || isReferent

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)

    // RLS arbitre ; false = 0 ligne (droits insuffisants ou base non migrée en 037)
    const ok = await deleteEventWithImages(createClient(), event)

    if (!ok) {
      setDeleteError('Suppression impossible. Réessayez.')
      setDeleting(false)
      setConfirmDelete(false)
      return
    }

    onDeleted?.(event.id)
    onClose()
  }

  const startTime = formatTime(event.event_date)
  const hasStartTime = startTime !== '00:00'
  const endTime = event.event_end_date ? formatTime(event.event_end_date) : null
  const hasEndTime = endTime && endTime !== '00:00'

  return (
    <>
      {/* Backdrop — couvre uniquement la zone des cards (absolute dans EventsList) */}
      <div
        className="absolute inset-0 z-[999] bg-black/10 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — centré dans la zone floutée (cards area)
          Zone cards : de top=7rem à bottom=100vh → centre Y = 50vh+3.5rem
          Horizontal desktop : 50vw - 9rem (w-72 = 18rem → décalé du panneau droit) */}
      <div
        className="fixed z-[1000]
                   top-[calc(50vh+3.5rem)] -translate-y-1/2
                   left-1/2 -translate-x-1/2
                   md:left-[calc(50%-9rem)]
                   w-[calc(100vw-2rem)] max-w-2xl
                   max-h-[calc(100vh-9rem)]
                   flex flex-col rounded-2xl shadow-2xl bg-white border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button — toujours visible, hors du scroll */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow-md border border-gray-200 z-10"
        >
          <X size={14} />
        </button>

        {/* Photo gallery — hauteur fixe, ne scroll pas */}
        {photos.length > 0 ? (
          <div className="relative w-full h-52 bg-gray-100 overflow-hidden rounded-t-2xl flex-shrink-0">
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
          <div className="w-full h-24 bg-gradient-to-br from-brand-50 to-brand-100 rounded-t-2xl flex items-center justify-center">
            <CalendarDays size={32} className="text-brand-400" />
          </div>
        )}

        {/* Content — scrollable */}
        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-4">
          {/* Title + badge */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold text-lg text-gray-900 leading-snug">{event.title}</h2>
            <span className={cn(
              'shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full',
              isPast ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-700'
            )}>
              {isPast ? 'Passé' : 'À venir'}
            </span>
          </div>

          {/* Date & time */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDays size={15} className="text-brand-500 shrink-0" />
              <span>{formatFullDate(event.event_date)}</span>
            </div>
            {(hasStartTime || hasEndTime) && (
              <div className="flex items-center gap-2 text-sm text-brand-600 font-medium pl-[23px]">
                <Clock size={13} className="shrink-0" />
                <span>
                  {hasStartTime && startTime}
                  {hasStartTime && hasEndTime && ` → ${endTime}`}
                  {!hasStartTime && hasEndTime && `jusqu'à ${endTime}`}
                </span>
              </div>
            )}
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

          {/* Actions : modifier et supprimer — créateur, ou référent (modération) */}
          {canManage && (
            <>
              <div className="border-t border-gray-100" />
              <Link
                href={`/evenements/${event.id}/edit`}
                className="w-full py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> {isOwner ? 'Modifier l\'événement' : 'Modifier (référent)'}
              </Link>

              {deleteError && (
                <p className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle size={14} /> {deleteError}
                </p>
              )}
              {confirmDelete ? (
                <div className="flex items-center justify-center gap-3 py-1">
                  <span className="text-sm text-gray-600">Supprimer définitivement ?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Confirmer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-3 text-center text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  {isOwner ? 'Supprimer l\'événement' : 'Supprimer (référent)'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
