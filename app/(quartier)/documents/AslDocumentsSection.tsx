'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ScrollText, Eye, Download, Upload, RefreshCw, Loader2, X, Landmark, Plus, Settings2, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AslDocument, AslDocumentKind } from '@/lib/types'
import { ASL_DOCUMENT_KIND_LABELS, ASL_DOCUMENT_KINDS } from '@/lib/types'
import {
  createDocumentUrl, deleteAslDocument, documentViewerHref, formatFileSize, uploadAslDocument,
} from '@/lib/documents'
import { notifyQuartier } from '@/lib/pushNotifications'
import { ItemActions } from '@/components/common/ItemActions'
import { DocumentChip } from '@/components/documents/DocumentChip'
import { cn } from '@/lib/utils'

interface Props {
  docs: AslDocument[]
  userId: string
  isReferent: boolean
  onChanged: () => Promise<void> | void
  onError: (message: string) => void
}

const chip = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors'

/**
 * « Documents de l'ASL » : les documents permanents, indépendants des assemblées
 * (statuts, et plus tard règlement intérieur). Un seul fichier par nature ;
 * remplacer écrase, comme pour les assemblées. Même visionneuse, même bucket.
 *
 * Même lecture qu'une assemblée : une rangée de puces (`DocumentChip`), et pour
 * les référents un « Gérer » qui déplie l'emplacement de dépôt (`AslDocumentSlot`,
 * le pendant de `DocumentSlot` sans PowerPoint ni règle « seul le PV reste »).
 */
export function AslDocumentsSection({ docs, userId, isReferent, onChanged, onError }: Props) {
  const [managing, setManaging] = useState(false)
  const missing = ASL_DOCUMENT_KINDS.filter(k => !docs.some(d => d.kind === k))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-content">
        <Landmark size={18} className="text-brand-600" />
        Documents de l&apos;ASL
      </h2>
      <div className="bg-surface md:bg-surface-pane border border-edge rounded-2xl p-4 flex flex-col gap-3">
        {/* Rangée de puces, comme sur une assemblée : la visionneuse d'un clic, le bord droit télécharge.
            Masquées en mode « Gérer », où l'emplacement reprend le fichier (cf. AssemblyCard) */}
        <div className="flex flex-wrap items-center gap-2">
          {!managing && ASL_DOCUMENT_KINDS.map(kind => {
            const doc = docs.find(d => d.kind === kind)
            const label = ASL_DOCUMENT_KIND_LABELS[kind]
            if (doc) {
              return (
                <DocumentChip
                  key={kind}
                  documentId={doc.id}
                  label={label}
                  icon={ScrollText}
                  filePath={doc.file_path}
                  fileName={doc.file_name}
                  fileSize={doc.file_size}
                  pageCount={doc.page_count}
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
                {label} · pas encore disponible
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

        {isReferent && managing && (
          <div className="flex flex-col gap-4 border-t border-edge pt-3">
            {ASL_DOCUMENT_KINDS.map(kind => (
              <AslDocumentSlot
                key={kind}
                kind={kind}
                doc={docs.find(d => d.kind === kind)}
                userId={userId}
                isReferent={isReferent}
                onChanged={onChanged}
                onError={onError}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function AslDocumentSlot({
  kind, doc, userId, isReferent, onChanged, onError,
}: {
  kind: AslDocumentKind
  doc?: AslDocument
  userId: string
  isReferent: boolean
  onChanged: () => Promise<void> | void
  onError: (message: string) => void
}) {
  const supabase = createClient()
  const label = ASL_DOCUMENT_KIND_LABELS[kind]

  const [picking, setPicking] = useState(false)
  const [pdf, setPdf] = useState<File | null>(null)
  const [silent, setSilent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const closePicker = () => {
    setPicking(false)
    setPdf(null)
    setSilent(false)
    setFormError(null)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pdf) return setFormError('Choisissez le fichier PDF à publier.')
    setUploading(true)
    setFormError(null)

    const { result, error } = await uploadAslDocument(supabase, { kind, pdf, existing: doc, userId })
    if (error || !result) {
      setFormError(error ?? 'Envoi impossible. Réessayez.')
      setUploading(false)
      return
    }

    // Push au premier dépôt seulement, jamais au remplacement, sauf case cochée
    if (result.created && !silent) notifyQuartier('new_asl_document', result.id)

    await onChanged()
    setUploading(false)
    closePicker()
  }

  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    const url = await createDocumentUrl(supabase, doc.file_path, doc.file_name)
    setDownloading(false)
    if (!url) return onError('Téléchargement impossible. Réessayez.')
    window.location.assign(url)
  }

  const picker = picking && (
    <form onSubmit={handleUpload}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-300 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-content-soft">
          {doc ? `Remplacer : ${label}` : `Déposer : ${label}`}
        </p>
        <button type="button" onClick={closePicker} aria-label="Annuler"
          className="text-content-faint hover:text-content-soft">
          <X size={16} />
        </button>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <label className="flex flex-col gap-1 text-xs text-content-soft">
        Fichier PDF <span className="text-content-faint">(50 Mo max)</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={e => setPdf(e.target.files?.[0] ?? null)}
          className="text-sm text-content file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-content-soft"
        />
      </label>

      {!doc && (
        <label className="flex items-center gap-2 text-sm text-content-soft">
          <input type="checkbox" checked={silent}
            onChange={e => setSilent(e.target.checked)}
            className="rounded border-edge" />
          Ne pas notifier le quartier
        </label>
      )}

      <button type="submit" disabled={uploading}
        className="w-full py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
        {uploading
          ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours… ne fermez pas la page</>
          : doc ? 'Remplacer le fichier' : 'Publier'}
      </button>
    </form>
  )

  if (!doc) {
    if (!isReferent) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-edge px-3 py-2.5 text-content-faint">
          <ScrollText size={18} className="shrink-0 opacity-50" />
          <p className="text-sm">
            <span className="font-medium">{label}</span>
            <span className="text-xs"> · pas encore disponible</span>
          </p>
        </div>
      )
    }
    if (picking) return picker
    return (
      <button type="button" onClick={() => setPicking(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-edge-strong px-3 py-2.5 text-left text-content-muted transition-colors hover:border-brand-400 hover:text-brand-700">
        <Upload size={18} className="shrink-0" />
        <span className="text-sm font-medium">Déposer : {label}</span>
      </button>
    )
  }

  const meta = [
    formatFileSize(doc.file_size),
    doc.page_count ? `${doc.page_count} page${doc.page_count > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ')

  return (
    // À plat, sans cadre : l'emplacement vit déjà dans la carte de la section
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <ScrollText size={20} className="mt-0.5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <Link href={documentViewerHref(doc.id)} className="block truncate font-medium text-content hover:text-brand-700">
            {label}
          </Link>
          <p className="truncate text-xs text-content-faint" title={doc.file_name}>
            {doc.file_name} · {meta}
          </p>
        </div>
        {isReferent && (
          <ItemActions
            className="-my-2.5 -mr-3"
            onDelete={() => deleteAslDocument(supabase, doc).then(async ok => { if (ok) await onChanged(); return ok })}
            onFailure={() => onError('Suppression impossible. Réessayez.')}
            deleteLabel={`Supprimer : ${label}`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={documentViewerHref(doc.id)}
          className={cn(chip, 'bg-brand-600 text-white hover:bg-brand-700')}>
          <Eye size={13} /> Consulter
        </Link>
        <button type="button" disabled={downloading} onClick={handleDownload}
          className={cn(chip, 'border border-edge text-content-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60')}>
          <Download size={13} /> PDF
        </button>
        {isReferent && !picking && (
          <button type="button" onClick={() => setPicking(true)}
            className={cn(chip, 'text-content-muted hover:bg-surface-sunken hover:text-brand-700')}>
            <RefreshCw size={13} /> Remplacer
          </button>
        )}
      </div>

      {picker}
    </div>
  )
}
