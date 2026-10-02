import type { SupabaseClient } from '@supabase/supabase-js'
import type { Assembly, AssemblyDocument, AssemblyDocumentKind } from '@/lib/types'

/**
 * Documents du lotissement (migration 040) : assemblées générales et fichiers.
 *
 * Tout ce qui touche au bucket `documents` passe par ici : chemins, URL signées,
 * dépôt, remplacement, suppression. Le bucket est PRIVÉ — jamais de
 * `getPublicUrl`, uniquement `createSignedUrl` (lecture réservée aux comptes
 * connectés par la policy Storage, et la clé anon ne suffit pas).
 *
 * ⚠️ `pdfjs-dist` pèse ~450 Ko + un worker de 1,2 Mo : il n'est importé qu'en
 * `await import()` (cf. `loadPdfjs`), jamais en tête de fichier, sinon il
 * partirait dans le bundle de la liste des documents, puis de l'onglet Quartier.
 */

export const DOCUMENTS_BUCKET = 'documents'

/** Plafond par fichier du plan gratuit Supabase (et `file_size_limit` du bucket) */
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024

export const PDF_MIME = 'application/pdf'
export const POWERPOINT_MIMES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]

/** Lien par défaut vers la visionneuse d'un document */
export function documentViewerHref(documentId: string): string {
  return `/documents/${documentId}`
}

// ─── Formatage ───────────────────────────────────────────────────────────────

/** « 2,4 Mo », « 850 Ko » — locale fr-FR */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  const mo = bytes / (1024 * 1024)
  return `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

/**
 * « 14 juin 2026 » à partir d'une colonne `date` (`YYYY-MM-DD`).
 * Découpage manuel : `new Date('2026-06-14')` serait interprété en UTC et
 * pourrait reculer d'un jour selon le fuseau de l'appareil.
 */
export function formatHeldOn(heldOn: string): string {
  const [y, m, d] = heldOn.split('-').map(Number)
  if (!y || !m || !d) return heldOn
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

/** Année de tenue, pour le regroupement de l'historique */
export function heldOnYear(heldOn: string): number {
  return Number(heldOn.slice(0, 4))
}

/** Date du jour au format `YYYY-MM-DD`, en heure locale (valeur d'un `<input type="date">`) */
export function todayIso(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export function findDocument(
  assembly: Assembly,
  kind: AssemblyDocumentKind,
): AssemblyDocument | undefined {
  return assembly.assembly_documents?.find(d => d.kind === kind)
}

/** Une assemblée est archivée dès que son PV est publié */
export function hasMinutes(assembly: Assembly): boolean {
  return findDocument(assembly, 'minutes') !== undefined
}

/**
 * URL signée de lecture (une heure). Avec `downloadAs`, la réponse porte un
 * `Content-Disposition: attachment` et le navigateur enregistre le fichier au
 * lieu de l'afficher.
 */
export async function createDocumentUrl(
  supabase: SupabaseClient,
  path: string,
  downloadAs?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined)
  if (error || !data) return null
  return data.signedUrl
}

// ─── pdf.js ──────────────────────────────────────────────────────────────────

type PdfjsModule = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<PdfjsModule> | null = null

/**
 * Charge pdf.js à la demande et branche son worker une seule fois.
 *
 * Le worker est importé depuis `node_modules` et servi par Next (`new URL(...,
 * import.meta.url)`) : aucun CDN, donc rien à ajouter à la CSP. pdf.js ≥ 4
 * utilise `Promise.withResolvers`, absent de Safari < 17.4 — polyfill minimal
 * posé avant l'import.
 */
export function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjsPromise) return pdfjsPromise

  pdfjsPromise = (async () => {
    const P = Promise as unknown as { withResolvers?: unknown }
    if (typeof P.withResolvers !== 'function') {
      P.withResolvers = function withResolvers<T>() {
        let resolve!: (value: T | PromiseLike<T>) => void
        let reject!: (reason?: unknown) => void
        const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
        return { promise, resolve, reject }
      }
    }

    const pdfjs = await import('pdfjs-dist')
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
    }
    return pdfjs
  })()

  return pdfjsPromise
}

/** Nombre de pages d'un PDF local, `null` si le fichier n'est pas lisible */
export async function countPdfPages(file: File): Promise<number | null> {
  try {
    const pdfjs = await loadPdfjs()
    const data = new Uint8Array(await file.arrayBuffer())
    const task = pdfjs.getDocument({ data })
    const pdf = await task.promise
    const count = pdf.numPages
    await task.destroy()
    return count
  } catch {
    return null
  }
}

// ─── Écriture (référents) ────────────────────────────────────────────────────

export interface UploadDocumentInput {
  assembly: Assembly
  kind: AssemblyDocumentKind
  /** Fichier affiché dans la visionneuse — PDF obligatoire */
  pdf: File
  /** PowerPoint d'origine, présentation uniquement */
  source?: File | null
  /** Document existant à remplacer (même assemblée, même nature) */
  existing?: AssemblyDocument
  userId: string
}

export interface UploadDocumentResult {
  id: string
  /** `true` au premier dépôt — c'est le seul cas où l'on notifie le quartier */
  created: boolean
}

/** Message d'erreur français ou `null` si le fichier est acceptable */
export function validateDocumentFile(file: File, expected: 'pdf' | 'powerpoint'): string | null {
  if (file.size > MAX_DOCUMENT_SIZE) {
    return `« ${file.name} » dépasse 50 Mo. Compressez-le ou exportez-le à nouveau.`
  }
  const isPdf = file.type === PDF_MIME || /\.pdf$/i.test(file.name)
  const isPpt = POWERPOINT_MIMES.includes(file.type) || /\.pptx?$/i.test(file.name)
  if (expected === 'pdf' && !isPdf) return 'Le document à consulter doit être un PDF.'
  if (expected === 'powerpoint' && !isPpt) return 'Le fichier d\'origine doit être un PowerPoint (.pptx ou .ppt).'
  return null
}

function extensionOf(file: File, fallback: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(file.name)
  return match ? match[1].toLowerCase() : fallback
}

function buildPath(assemblyId: string, kind: AssemblyDocumentKind, suffix: string, ext: string): string {
  return `${assemblyId}/${kind}${suffix}-${Date.now()}.${ext}`
}

async function removePaths(supabase: SupabaseClient, paths: (string | null | undefined)[]): Promise<void> {
  const clean = paths.filter((p): p is string => !!p)
  if (clean.length === 0) return
  // Un échec laisse un orphelin dans le bucket, jamais un document cassé :
  // la ligne en base reste la source de vérité.
  await supabase.storage.from(DOCUMENTS_BUCKET).remove(clean).catch(() => {})
}

/**
 * Dépose ou remplace un fichier. Ordre volontaire : Storage d'abord, base
 * ensuite, anciens fichiers en dernier — à aucun moment une ligne ne pointe
 * vers un fichier absent.
 *
 * Règle métier « seul le PV reste » : la publication du PV efface l'ordre du
 * jour et la présentation de la même assemblée (lignes et fichiers).
 */
export async function uploadDocument(
  supabase: SupabaseClient,
  input: UploadDocumentInput,
): Promise<{ result: UploadDocumentResult | null; error: string | null }> {
  const { assembly, kind, pdf, source, existing, userId } = input

  const pdfError = validateDocumentFile(pdf, 'pdf')
  if (pdfError) return { result: null, error: pdfError }
  if (source) {
    const srcError = validateDocumentFile(source, 'powerpoint')
    if (srcError) return { result: null, error: srcError }
  }

  const filePath = buildPath(assembly.id, kind, '', extensionOf(pdf, 'pdf'))
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(filePath, pdf, { contentType: PDF_MIME, upsert: false })
  if (upErr) {
    return { result: null, error: 'Envoi du PDF impossible. Vérifiez votre connexion et réessayez.' }
  }

  let sourcePath: string | null = existing?.source_path ?? null
  let sourceName: string | null = existing?.source_name ?? null
  let sourceSize: number | null = existing?.source_size ?? null
  if (source) {
    const path = buildPath(assembly.id, kind, '-source', extensionOf(source, 'pptx'))
    const { error: srcErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, source, { contentType: source.type || POWERPOINT_MIMES[0], upsert: false })
    if (srcErr) {
      await removePaths(supabase, [filePath])
      return { result: null, error: 'Envoi du PowerPoint impossible. Réessayez.' }
    }
    sourcePath = path
    sourceName = source.name
    sourceSize = source.size
  }

  const pageCount = await countPdfPages(pdf)

  const values = {
    file_path: filePath,
    file_name: pdf.name,
    file_size: pdf.size,
    mime_type: PDF_MIME,
    page_count: pageCount,
    source_path: sourcePath,
    source_name: sourceName,
    source_size: sourceSize,
  }

  const { data: row, error: dbErr } = existing
    ? await supabase.from('assembly_documents')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id')
        .single()
    : await supabase.from('assembly_documents')
        .insert({ assembly_id: assembly.id, kind, uploaded_by: userId, ...values })
        .select('id')
        .single()

  if (dbErr || !row) {
    await removePaths(supabase, [filePath, source ? sourcePath : null])
    return {
      result: null,
      error: existing ? 'Remplacement impossible. Réessayez.' : 'Enregistrement impossible. Réessayez.',
    }
  }

  // Anciens fichiers remplacés
  if (existing) {
    await removePaths(supabase, [
      existing.file_path,
      source ? existing.source_path : null,
    ])
  }

  if (kind === 'minutes') {
    await deleteSiblingDrafts(supabase, assembly.id)
  }

  return { result: { id: row.id, created: !existing }, error: null }
}

/** Efface ordre du jour et présentation d'une assemblée dont le PV vient d'être publié */
async function deleteSiblingDrafts(supabase: SupabaseClient, assemblyId: string): Promise<void> {
  const { data } = await supabase
    .from('assembly_documents')
    .select('id, file_path, source_path')
    .eq('assembly_id', assemblyId)
    .in('kind', ['agenda', 'presentation'])
  const rows = (data ?? []) as Pick<AssemblyDocument, 'id' | 'file_path' | 'source_path'>[]
  if (rows.length === 0) return

  await removePaths(supabase, rows.flatMap(r => [r.file_path, r.source_path]))
  await supabase.from('assembly_documents').delete().in('id', rows.map(r => r.id))
}

/**
 * Supprime un document (fichiers puis ligne). Renvoie `false` si aucune ligne
 * n'a été supprimée — un `delete` refusé par le RLS ne lève pas d'erreur.
 */
export async function deleteDocument(supabase: SupabaseClient, doc: AssemblyDocument): Promise<boolean> {
  const { data } = await supabase.from('assembly_documents').delete().eq('id', doc.id).select('id')
  const ok = (data?.length ?? 0) > 0
  if (ok) await removePaths(supabase, [doc.file_path, doc.source_path])
  return ok
}

/** Supprime une assemblée et tous ses fichiers (les lignes suivent en cascade) */
export async function deleteAssembly(supabase: SupabaseClient, assembly: Assembly): Promise<boolean> {
  const docs = assembly.assembly_documents ?? []
  const { data } = await supabase.from('assemblies').delete().eq('id', assembly.id).select('id')
  const ok = (data?.length ?? 0) > 0
  if (ok) await removePaths(supabase, docs.flatMap(d => [d.file_path, d.source_path]))
  return ok
}
