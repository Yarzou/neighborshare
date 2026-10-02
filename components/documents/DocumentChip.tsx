'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createDocumentUrl, documentViewerHref, formatFileSize } from '@/lib/documents'
import { cn } from '@/lib/utils'

interface Props {
  documentId: string
  label: string
  icon: LucideIcon
  filePath: string
  fileName: string
  fileSize: number
  pageCount: number | null
  /** PowerPoint d'origine (présentation d'assemblée) */
  sourcePath?: string | null
  sourceName?: string | null
  onError: (message: string) => void
  className?: string
}

/**
 * Un document sous forme de puce : le corps ouvre la visionneuse, le bord droit
 * télécharge. C'est l'unité d'affichage « rapide » des pages Documents — pas de
 * carte dans la carte, juste une rangée de puces par assemblée.
 */
export function DocumentChip({
  documentId, label, icon: Icon, filePath, fileName, fileSize, pageCount, sourcePath, sourceName, onError, className,
}: Props) {
  const supabase = createClient()
  const [downloading, setDownloading] = useState<string | null>(null)

  const download = async (path: string, name: string) => {
    setDownloading(path)
    const url = await createDocumentUrl(supabase, path, name)
    setDownloading(null)
    if (!url) return onError('Téléchargement impossible. Réessayez.')
    window.location.assign(url)
  }

  const meta = [
    pageCount ? `${pageCount} p.` : null,
    formatFileSize(fileSize),
  ].filter(Boolean).join(' · ')

  const sideButton = 'flex items-center justify-center w-10 border-l border-edge text-content-muted hover:bg-surface-sunken hover:text-brand-700 transition-colors disabled:opacity-60'

  return (
    <div className={cn('inline-flex items-stretch rounded-xl border border-edge bg-surface overflow-hidden', className)}>
      <Link
        href={documentViewerHref(documentId)}
        className="flex items-center gap-2.5 pl-3 pr-3.5 py-2 hover:bg-brand-50 transition-colors min-w-0"
        title={fileName}
      >
        <Icon size={18} className="shrink-0 text-brand-600" />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold text-content truncate">{label}</span>
          <span className="block text-[11px] text-content-faint">{meta}</span>
        </span>
      </Link>
      <button type="button" onClick={() => download(filePath, fileName)} disabled={downloading !== null}
        className={sideButton} aria-label={`Télécharger ${label} (PDF)`} title="Télécharger le PDF">
        {downloading === filePath ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      </button>
      {sourcePath && sourceName && (
        <button type="button" onClick={() => download(sourcePath, sourceName)} disabled={downloading !== null}
          className={cn(sideButton, 'text-[10px] font-bold tracking-wide')}
          aria-label={`Télécharger ${label} (PowerPoint)`} title="Télécharger le PowerPoint d'origine">
          {downloading === sourcePath ? <Loader2 size={15} className="animate-spin" /> : 'PPT'}
        </button>
      )}
    </div>
  )
}
