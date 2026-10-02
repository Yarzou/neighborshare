'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2, FileQuestion, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Assembly, AssemblyDocument } from '@/lib/types'
import { ASSEMBLY_DOCUMENT_KIND_LABELS } from '@/lib/types'
import { useCurrentUser } from '@/lib/hooks'
import { LoginRequiredNotice } from '@/components/layout/LoginRequiredNotice'
import { createDocumentUrl, formatFileSize, formatHeldOn } from '@/lib/documents'

// pdf.js ne tourne pas côté serveur (canvas, workers) : chargement client seul,
// et seulement sur cette page — la liste des documents n'en paie pas le poids.
const PdfViewer = dynamic(
  () => import('@/components/documents/PdfViewer').then(m => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand-600" size={28} />
      </div>
    ),
  },
)

type DocumentWithAssembly = AssemblyDocument & { assemblies: Assembly | null }

/**
 * Visionneuse d'un document d'assemblée.
 *
 * Dans le route group `(quartier)` : sur desktop elle remplace la page Documents
 * ASL dans le volet de droite, le volet des sections restant visible à gauche ;
 * `QuartierFrame` la rend sans colonne de lecture ni onglets, donc le mobile reste
 * une page plein écran. Sortie par la flèche (mobile et desktop) ou le bouton
 * « Fermer » (desktop). Le PDF est lu via
 * une URL signée d'une heure (bucket privé) ; le PowerPoint d'origine, s'il
 * existe, n'est proposé qu'en téléchargement.
 */
export default function DocumentViewerPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const { userId, resolved } = useCurrentUser()

  const [doc, setDoc] = useState<DocumentWithAssembly | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!resolved || !userId || !id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('assembly_documents')
        .select('*, assemblies!assembly_id(*)')
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      if (!data) { setState('missing'); return }
      const row = data as DocumentWithAssembly
      setDoc(row)
      const signed = await createDocumentUrl(supabase, row.file_path)
      if (cancelled) return
      if (!signed) { setState('error'); return }
      setUrl(signed)
      setState('ready')
    })()
    return () => { cancelled = true }
  }, [resolved, userId, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async (path: string, name: string) => {
    setDownloading(true)
    setDownloadError(null)
    const signed = await createDocumentUrl(supabase, path, name)
    setDownloading(false)
    if (!signed) return setDownloadError('Téléchargement impossible. Réessayez.')
    window.location.assign(signed)
  }

  if (!resolved || (userId && state === 'loading')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="bg-surface border border-edge rounded-2xl">
          <LoginRequiredNotice what="les documents du lotissement" redirectTo={`/documents/${id}`} />
        </div>
      </div>
    )
  }

  if (state === 'missing' || !doc) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="text-center py-16 text-content-muted bg-surface border border-edge rounded-2xl">
          <FileQuestion size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-content-soft">Document introuvable</p>
          <p className="text-sm mt-1">Il a peut-être été supprimé ou remplacé.</p>
          <Link href="/documents"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <ArrowLeft size={15} /> Retour aux documents
          </Link>
        </div>
      </div>
    )
  }

  const label = ASSEMBLY_DOCUMENT_KIND_LABELS[doc.kind]
  const assembly = doc.assemblies
  const downloadChip = 'inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-xs font-medium text-content-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 transition-colors'

  return (
    <div className="max-w-5xl mx-auto md:max-w-none">
      <header className="flex flex-col gap-2 px-4 pt-4 pb-3 md:px-6">
        <div className="flex items-start gap-2">
          <Link href="/documents" aria-label="Retour aux documents"
            className="-ml-2 w-10 h-10 flex shrink-0 items-center justify-center rounded-xl text-content-soft hover:bg-surface-sunken transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-content leading-tight truncate">{label}</h1>
            {assembly && (
              <p className="text-sm text-content-muted truncate">
                {assembly.title} · {formatHeldOn(assembly.held_on)}
              </p>
            )}
          </div>
          <Link href="/documents"
            className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-edge px-3 py-2 text-sm font-medium text-content-soft hover:border-brand-300 hover:text-brand-700 transition-colors">
            <X size={15} /> Fermer
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pl-8">
          <button type="button" disabled={downloading}
            onClick={() => handleDownload(doc.file_path, doc.file_name)}
            className={downloadChip} title={doc.file_name}>
            <Download size={13} /> PDF · {formatFileSize(doc.file_size)}
          </button>
          {doc.source_path && doc.source_name && (
            <button type="button" disabled={downloading}
              onClick={() => handleDownload(doc.source_path!, doc.source_name!)}
              className={downloadChip} title={doc.source_name}>
              <Download size={13} /> PowerPoint{doc.source_size ? ` · ${formatFileSize(doc.source_size)}` : ''}
            </button>
          )}
          {downloadError && <span className="text-xs text-red-600">{downloadError}</span>}
        </div>
      </header>

      {state === 'error' || !url ? (
        <div className="px-4 py-16 text-center text-content-muted">
          <p className="text-sm font-medium text-content-soft">Affichage impossible</p>
          <p className="text-sm mt-1">Le fichier n&apos;a pas pu être récupéré. Essayez le téléchargement ci-dessus.</p>
        </div>
      ) : (
        <PdfViewer url={url} />
      )}
    </div>
  )
}
