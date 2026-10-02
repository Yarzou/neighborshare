'use client'

import { useState } from 'react'
import { CalendarDays, FileText, Presentation, ScrollText, Plus, Settings2, ChevronUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly, AssemblyDocumentKind } from '@/lib/types'
import { ASSEMBLY_DOCUMENT_KIND_LABELS } from '@/lib/types'
import { deleteAssembly, findDocument, formatHeldOn, hasMinutes } from '@/lib/documents'
import { ItemActions } from '@/components/common/ItemActions'
import { DocumentChip } from '@/components/documents/DocumentChip'
import { DocumentSlot } from './DocumentSlot'
import { cn } from '@/lib/utils'

interface Props {
  assembly: Assembly
  userId: string
  isReferent: boolean
  onChanged: () => Promise<void> | void
  onEdit: (assembly: Assembly) => void
  onError: (message: string) => void
  /** Carte posée dans un bloc au ton « volet » (accordéon) : prend le ton « page » pour rester distincte */
  inset?: boolean
}

const KIND_ICONS: Record<AssemblyDocumentKind, LucideIcon> = {
  agenda: FileText,
  presentation: Presentation,
  minutes: ScrollText,
}

/**
 * Carte d'une assemblée générale — une seule carte, à plat : titre puis date,
 * puis une rangée de **puces** (`DocumentChip`), une par fichier, qui ouvrent la
 * visionneuse et téléchargent. Plus de carte par document dans la carte, et pas
 * de badge d'état : la section (Prochaine assemblée / Procès-verbaux) le dit déjà.
 *
 * À venir (pas encore de PV) : ordre du jour + présentation. Archivée (PV
 * publié) : le PV seul — l'ordre du jour et la présentation ont été effacés à sa
 * publication (règle « seul le PV reste »).
 *
 * Référents : « Gérer » déplie les emplacements de dépôt / remplacement /
 * suppression (`DocumentSlot`), repliés par défaut pour garder la lecture rapide.
 */
export function AssemblyCard({ assembly, userId, isReferent, onChanged, onEdit, onError, inset = false }: Props) {
  const supabase = createClient()
  const archived = hasMinutes(assembly)
  const [managing, setManaging] = useState(false)

  const kinds: AssemblyDocumentKind[] = archived
    ? ['minutes']
    : isReferent ? ['agenda', 'presentation', 'minutes'] : ['agenda', 'presentation']

  const missing = kinds.filter(k => !findDocument(assembly, k))

  return (
    <article className={cn(
      'bg-surface border rounded-2xl p-4 flex flex-col gap-3',
      // Desktop : gris plutôt que blanc (demande utilisateur) — ton « volet » sur le fond
      // de page, ton « page » à l'intérieur de l'accordéon qui est déjà au ton « volet »
      inset ? 'md:bg-surface-raised' : 'md:bg-surface-pane',
      archived ? 'border-edge' : 'border-brand-300',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-content text-base leading-tight">{assembly.title}</h3>
          <p className="flex items-center gap-1.5 text-xs text-content-muted mt-0.5">
            <CalendarDays size={13} className="shrink-0" />
            {formatHeldOn(assembly.held_on)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
      </div>

      {/* Rangée de puces : un clic = la visionneuse, le bord droit = téléchargement */}
      <div className="flex flex-wrap items-center gap-2">
        {kinds.map(kind => {
          const doc = findDocument(assembly, kind)
          const label = ASSEMBLY_DOCUMENT_KIND_LABELS[kind]
          if (doc) {
            return (
              <DocumentChip
                key={kind}
                documentId={doc.id}
                label={label}
                icon={KIND_ICONS[kind]}
                filePath={doc.file_path}
                fileName={doc.file_name}
                fileSize={doc.file_size}
                pageCount={doc.page_count}
                sourcePath={doc.source_path}
                sourceName={doc.source_name}
                onError={onError}
              />
            )
          }
          if (isReferent) {
            return (
              <button key={kind} type="button" onClick={() => setManaging(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-edge-strong px-3 py-2 text-sm text-content-muted hover:border-brand-400 hover:text-brand-700 transition-colors">
                <Plus size={14} /> {label}
              </button>
            )
          }
          return (
            <span key={kind}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-edge px-3 py-2 text-sm text-content-faint">
              {label} · à venir
            </span>
          )
        })}

        {isReferent && (
          <button type="button" onClick={() => setManaging(m => !m)}
            aria-expanded={managing}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-sunken hover:text-brand-700 transition-colors">
            {managing ? <><ChevronUp size={14} /> Replier</> : <><Settings2 size={14} /> Gérer{missing.length > 0 ? ` · ${missing.length} à déposer` : ''}</>}
          </button>
        )}
      </div>

      {/* Référent : dépôt / remplacement / suppression, replié par défaut */}
      {isReferent && managing && (
        <div className="flex flex-col gap-2 border-t border-edge pt-3">
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
      )}
    </article>
  )
}
