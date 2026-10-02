'use client'

import { CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly, AssemblyDocumentKind } from '@/lib/types'
import { deleteAssembly, findDocument, formatHeldOn, hasMinutes } from '@/lib/documents'
import { ItemActions } from '@/components/common/ItemActions'
import { DocumentSlot } from './DocumentSlot'
import { cn } from '@/lib/utils'

interface Props {
  assembly: Assembly
  userId: string
  isReferent: boolean
  onChanged: () => Promise<void> | void
  onEdit: (assembly: Assembly) => void
  onError: (message: string) => void
}

/**
 * Carte d'une assemblée générale.
 *
 * À venir (pas encore de PV) : ordre du jour + présentation, et pour un référent
 * l'emplacement du PV. Archivée (PV publié) : le PV seul — l'ordre du jour et la
 * présentation ont été effacés à sa publication (règle « seul le PV reste »).
 */
export function AssemblyCard({ assembly, userId, isReferent, onChanged, onEdit, onError }: Props) {
  const supabase = createClient()
  const archived = hasMinutes(assembly)

  const kinds: AssemblyDocumentKind[] = archived
    ? ['minutes']
    : isReferent ? ['agenda', 'presentation', 'minutes'] : ['agenda', 'presentation']

  return (
    <article className={cn(
      'bg-surface border rounded-2xl p-4 flex flex-col gap-3',
      archived ? 'border-edge' : 'border-brand-300',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-content">{assembly.title}</h3>
          <p className="flex items-center gap-1.5 text-xs text-content-faint">
            <CalendarDays size={13} className="shrink-0" />
            {formatHeldOn(assembly.held_on)}
          </p>
        </div>
        {isReferent && (
          <ItemActions
            className="-my-3 -mr-3"
            onEdit={() => onEdit(assembly)}
            onDelete={() => deleteAssembly(supabase, assembly).then(async ok => { if (ok) await onChanged(); return ok })}
            onFailure={() => onError('Suppression impossible. Réessayez.')}
            editLabel="Modifier l'assemblée"
            deleteLabel="Supprimer l'assemblée et ses fichiers"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {kinds.map(kind => (
          <DocumentSlot
            key={kind}
            assembly={assembly}
            kind={kind}
            doc={findDocument(assembly, kind)}
            userId={userId}
            isReferent={isReferent}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </div>
    </article>
  )
}
