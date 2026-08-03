'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import type { Event } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUser } from '@/lib/hooks'
import { deleteEventWithImages } from '@/lib/events'

interface Props {
  event: Pick<Event, 'id' | 'user_id' | 'image_urls'>
  /** Appelé après une suppression réussie : navigation ou retrait de liste, au choix du parent */
  onDeleted: (eventId: string) => void
  /**
   * `stacked` : boutons pleine largeur empilés (page détail, popup).
   * `row` : barre horizontale scindée Modifier | Supprimer (lignes du profil).
   */
  variant: 'stacked' | 'row'
}

/**
 * LE bloc d'actions d'un événement — Modifier + Supprimer, pour le créateur ou
 * un référent (policy 037), avec confirmation en deux temps.
 *
 * ⚠️ Seul endroit du code où ces actions existent. Trois écrans le consomment :
 * la page détail (`EventDetailClient`), le popup de la liste (`EventDetailPopup`)
 * et le profil (`ProfileClient`). Ne jamais rajouter un bouton d'action
 * directement dans l'un d'eux — c'est cette duplication qui a causé deux bugs
 * de divergence (popup sans suppression, édition en retard sur la création).
 *
 * Rend `null` si l'utilisateur n'a aucun droit : les parents n'ont pas de
 * condition de rôle à porter.
 */
export function EventActions({ event, onDeleted, variant }: Props) {
  const { userId, isReferent } = useCurrentUser()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = userId === event.user_id
  // Cas nominal : le créateur. En plus, le référent (modération, policy 037).
  const canManage = isOwner || isReferent

  if (!canManage) return null

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    // RLS arbitre (créateur ou référent) ; false = 0 ligne supprimée
    // (droits insuffisants ou base pas encore migrée en 037) — cf. lib/events.ts
    const ok = await deleteEventWithImages(createClient(), event)

    if (!ok) {
      setError('Suppression impossible. Réessayez.')
      setDeleting(false)
      setConfirmDelete(false)
      return
    }

    onDeleted(event.id)
  }

  const editHref = `/evenements/${event.id}/edit`
  const editLabel = isOwner ? 'Modifier l\'événement' : 'Modifier (référent)'
  const deleteLabel = isOwner ? 'Supprimer l\'événement' : 'Supprimer (référent)'

  if (variant === 'row') {
    return (
      <div className="border-t border-gray-100 flex flex-col">
        {error && (
          <p className="flex items-center justify-center gap-2 text-xs text-red-500 bg-red-50 px-4 py-2">
            <AlertCircle size={13} /> {error}
          </p>
        )}
        {confirmDelete ? (
          <div className="flex items-center justify-center gap-3 py-2.5 bg-red-50">
            <button onClick={() => setConfirmDelete(false)} disabled={deleting}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium">
              Annuler
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Confirmer
            </button>
          </div>
        ) : (
          <div className="flex">
            <Link href={editHref}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors border-r border-gray-100">
              <Pencil size={14} /> {isOwner ? 'Modifier' : 'Modifier (référent)'}
            </Link>
            <button onClick={() => setConfirmDelete(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> {isOwner ? 'Supprimer' : 'Supprimer (référent)'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // variant === 'stacked'
  return (
    <>
      <div className="border-t border-gray-100" />

      <Link href={editHref}
        className="w-full py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2">
        <Pencil size={14} /> {editLabel}
      </Link>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      {confirmDelete ? (
        <div className="flex items-center justify-center gap-3 py-1">
          <span className="text-sm text-gray-600">Supprimer définitivement ?</span>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Confirmer
          </button>
          <button onClick={() => setConfirmDelete(false)} disabled={deleting}
            className="text-sm text-gray-500 hover:text-gray-700">
            Annuler
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)}
          className="w-full py-3 text-center text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-sm flex items-center justify-center gap-2">
          <Trash2 size={14} /> {deleteLabel}
        </button>
      )}
    </>
  )
}
