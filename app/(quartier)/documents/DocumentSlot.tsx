'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  FileText, Presentation, ScrollText, Eye, Download, Upload, RefreshCw, Loader2, AlertTriangle, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly, AssemblyDocument, AssemblyDocumentKind } from '@/lib/types'
import { ASSEMBLY_DOCUMENT_KIND_LABELS } from '@/lib/types'
import {
  createDocumentUrl, deleteDocument, documentViewerHref, formatFileSize, uploadDocument,
} from '@/lib/documents'
import { notifyQuartier } from '@/lib/pushNotifications'
import { ItemActions } from '@/components/common/ItemActions'
import { cn } from '@/lib/utils'

interface Props {
  assembly: Assembly
  kind: AssemblyDocumentKind
  doc?: AssemblyDocument
  userId: string
  isReferent: boolean
  /** Rechargement de la liste après dépôt, remplacement ou suppression */
  onChanged: () => Promise<void> | void
  /** Erreur hors formulaire (téléchargement, suppression) — affichée par la page */
  onError: (message: string) => void
}

const KIND_ICONS: Record<AssemblyDocumentKind, typeof FileText> = {
  agenda: FileText,
  presentation: Presentation,
  minutes: ScrollText,
}

const chip = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors'

/**
 * Un emplacement de fichier dans une assemblée (ordre du jour, présentation ou PV).
 *
 * Trois états : fichier présent (consulter / télécharger, et pour un référent
 * remplacer / supprimer), fichier absent et référent (bouton de dépôt), fichier
 * absent et voisin (mention « pas encore disponible »).
 *
 * Le dépôt part du navigateur vers Storage directement : il ne transite pas par
 * Vercel, dont la limite de corps de requête est bien en dessous des 50 Mo.
 */
export function DocumentSlot({ assembly, kind, doc, userId, isReferent, onChanged, onError }: Props) {
  const supabase = createClient()
  const Icon = KIND_ICONS[kind]
  const label = ASSEMBLY_DOCUMENT_KIND_LABELS[kind]

  const [picking, setPicking] = useState(false)
  const [pdf, setPdf] = useState<File | null>(null)
  const [source, setSource] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  /** Reprise d'historique : dépôt sans notification push (premier dépôt seulement) */
  const [silent, setSilent] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const closePicker = () => {
    setPicking(false)
    setPdf(null)
    setSource(null)
    setSilent(false)
    setFormError(null)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pdf) return setFormError('Choisissez le fichier PDF à publier.')
    setUploading(true)
    setFormError(null)

    const { result, error } = await uploadDocument(supabase, {
      assembly, kind, pdf, source, existing: doc, userId,
    })

    if (error || !result) {
      setFormError(error ?? 'Envoi impossible. Réessayez.')
      setUploading(false)
      return
    }

    // Push à tout le quartier — au premier dépôt seulement, jamais au remplacement,
    // et pas pour une reprise d'historique (case « Ne pas notifier »)
    if (result.created && !silent) notifyQuartier('new_document', result.id)

    await onChanged()
    setUploading(false)
    closePicker()
  }

  const handleDownload = async (path: string, name: string) => {
    setDownloading(true)
    const url = await createDocumentUrl(supabase, path, name)
    setDownloading(false)
    if (!url) return onError('Téléchargement impossible. Réessayez.')
    window.location.assign(url)
  }

  // ── Formulaire de dépôt / remplacement ──────────────────────────────────────
  const picker = picking && (
    <form onSubmit={handleUpload}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-brand-300 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-content-soft">
          {doc ? `Remplacer : ${label.toLowerCase()}` : `Déposer : ${label.toLowerCase()}`}
        </p>
        <button type="button" onClick={closePicker} aria-label="Annuler"
          className="text-content-faint hover:text-content-soft">
          <X size={16} />
        </button>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <label className="flex flex-col gap-1 text-xs text-content-soft">
        Fichier PDF à consulter <span className="text-content-faint">(50 Mo max)</span>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={e => setPdf(e.target.files?.[0] ?? null)}
          className="text-sm text-content file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-content-soft"
        />
      </label>

      {kind === 'presentation' && (
        <label className="flex flex-col gap-1 text-xs text-content-soft">
          PowerPoint d&apos;origine <span className="text-content-faint">(facultatif, téléchargement seul)</span>
          <input
            type="file"
            accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={e => setSource(e.target.files?.[0] ?? null)}
            className="text-sm text-content file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-content-soft"
          />
          {doc?.source_name && !source && (
            <span className="text-content-faint">Sans nouveau fichier, « {doc.source_name} » est conservé.</span>
          )}
        </label>
      )}

      {kind === 'minutes' && !doc && (
        <p className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-content-soft">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warm-500" />
          La publication du procès-verbal efface l&apos;ordre du jour et la présentation
          de cette assemblée. Seul le PV reste consultable.
        </p>
      )}

      {!doc && (
        <label className="flex items-center gap-2 text-sm text-content-soft">
          <input type="checkbox" checked={silent}
            onChange={e => setSilent(e.target.checked)}
            className="rounded border-edge" />
          Ne pas notifier le quartier
          <span className="text-xs text-content-faint">(reprise d&apos;un ancien document)</span>
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

  // ── Fichier absent ──────────────────────────────────────────────────────────
  if (!doc) {
    if (!isReferent) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-edge px-3 py-2.5 text-content-faint">
          <Icon size={18} className="shrink-0 opacity-50" />
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
        <span className="text-sm font-medium">Déposer : {label.toLowerCase()}</span>
      </button>
    )
  }

  // ── Fichier présent ─────────────────────────────────────────────────────────
  const meta = [
    formatFileSize(doc.file_size),
    doc.page_count ? `${doc.page_count} page${doc.page_count > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-surface-raised px-3 py-2.5">
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0 text-brand-600" />
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
            onDelete={() => deleteDocument(supabase, doc).then(async ok => { if (ok) await onChanged(); return ok })}
            onFailure={() => onError('Suppression impossible. Réessayez.')}
            deleteLabel={`Supprimer : ${label.toLowerCase()}`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={documentViewerHref(doc.id)}
          className={cn(chip, 'bg-brand-600 text-white hover:bg-brand-700')}>
          <Eye size={13} /> Consulter
        </Link>
        <button type="button" disabled={downloading}
          onClick={() => handleDownload(doc.file_path, doc.file_name)}
          className={cn(chip, 'border border-edge text-content-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60')}>
          <Download size={13} /> PDF
        </button>
        {doc.source_path && doc.source_name && (
          <button type="button" disabled={downloading}
            onClick={() => handleDownload(doc.source_path!, doc.source_name!)}
            className={cn(chip, 'border border-edge text-content-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60')}
            title={`${doc.source_name}${doc.source_size ? ` · ${formatFileSize(doc.source_size)}` : ''}`}>
            <Download size={13} /> PowerPoint
          </button>
        )}
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
