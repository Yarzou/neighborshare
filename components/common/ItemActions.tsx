'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Passe la carte en mode édition. Omis = seul le bouton supprimer est rendu. */
  onEdit?: () => void
  /**
   * Suppression réelle. Doit renvoyer `false` quand rien n'a été supprimé.
   *
   * ⚠️ Un `delete` refusé par une policy RLS **ne renvoie pas d'erreur**, juste
   * zéro ligne : l'appelant doit faire son `.select('id')` et compter les lignes,
   * sinon l'écran affiche un succès alors que la donnée est toujours là.
   */
  onDelete: () => Promise<boolean>
  /** Appelé quand `onDelete` a renvoyé `false` — à l'appelant d'afficher le message. */
  onFailure?: () => void
  /** Marges négatives propres à l'appelant (`-my-3 -mr-3`, `-mb-3 -mr-3`…). */
  className?: string
  /** Suffixé « (référent) » quand l'utilisateur gère le contenu d'un autre. */
  editLabel?: string
  deleteLabel?: string
}

/**
 * Groupe d'actions « modifier / supprimer » d'une carte, avec **confirmation en
 * deux temps** — le pendant de `EventActions` pour les écrans du quartier
 * (informations, sondages, prestataires, achats groupés).
 *
 * Pourquoi centraliser : depuis la migration 038, un référent peut supprimer le
 * contenu d'un autre référent. Ces quatre écrans supprimaient au premier clic,
 * sans confirmation ni détection du refus RLS.
 *
 * ⚠️ Le mode confirmation remplace les deux boutons au lieu de s'ajouter à eux :
 * l'encombrement reste de 2 × 44 px, donc **aucun décalage de mise en page**. La
 * géométrie (cibles de 44 × 44 px, zéro recouvrement entre les deux boutons parce
 * que « supprimer » est destructif) a été mesurée dans le navigateur, ne pas la
 * réduire.
 */
export function ItemActions({
  onEdit,
  onDelete,
  onFailure,
  className,
  editLabel = 'Modifier',
  deleteLabel = 'Supprimer',
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const iconButton = 'w-11 h-11 flex items-center justify-center rounded-xl transition-colors disabled:opacity-60'

  const handleDelete = async () => {
    setDeleting(true)
    const ok = await onDelete()
    setDeleting(false)
    setConfirming(false)
    if (!ok) onFailure?.()
  }

  if (confirming) {
    return (
      <span className={cn('flex items-center shrink-0', className)}>
        <button onClick={handleDelete} disabled={deleting}
          className={cn(iconButton, 'text-red-600 hover:bg-red-50')}
          aria-label={`Confirmer : ${deleteLabel.toLowerCase()}`}>
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
        </button>
        <button onClick={() => setConfirming(false)} disabled={deleting}
          className={cn(iconButton, 'text-content-faint hover:text-content-soft hover:bg-surface-sunken')}
          aria-label="Annuler la suppression">
          <X size={16} />
        </button>
      </span>
    )
  }

  return (
    <span className={cn('flex items-center shrink-0', className)}>
      {onEdit && (
        <button onClick={onEdit}
          className={cn(iconButton, 'text-content-faint hover:text-brand-600 hover:bg-surface-sunken')}
          aria-label={editLabel}>
          <Pencil size={15} />
        </button>
      )}
      <button onClick={() => setConfirming(true)}
        className={cn(iconButton, 'text-content-faint hover:text-red-500 hover:bg-surface-sunken')}
        aria-label={deleteLabel}>
        <Trash2 size={15} />
      </button>
    </span>
  )
}
