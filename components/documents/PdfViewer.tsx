'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Loader2, AlertCircle } from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { loadPdfjs } from '@/lib/documents'
import { cn } from '@/lib/utils'

interface Props {
  /** URL signée du PDF */
  url: string
}

/** Dimensions d'une page à l'échelle 1 (points PDF) */
interface PageMeta { width: number; height: number }

/** Facteurs de zoom par rapport à « ajusté à la largeur » */
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 3]

/**
 * Visionneuse PDF basée sur pdf.js — chargée en `dynamic(..., { ssr: false })`
 * par la page `/documents/[id]`.
 *
 * Rendu **impératif via refs**, sur le modèle de `LeafletMap` : React ne pose que
 * les conteneurs de pages (dimensionnés par `aspect-ratio`, donc la hauteur du
 * document est connue avant tout rendu) ; les canvas sont créés, remplis et
 * libérés à la main.
 *
 * Mémoire : un PV de 60 pages rendu d'un bloc à 2× pèserait plusieurs centaines
 * de Mo sur un téléphone. Un `IntersectionObserver` ne rend que les pages
 * visibles (± un écran et demi) et libère les autres.
 *
 * Défilement : celui du document, pas d'un conteneur interne — c'est ce qui donne
 * le geste naturel sur mobile (barre d'adresse qui se replie, inertie système).
 * Le zoom > 1 élargit les pages au-delà du conteneur, qui défile alors
 * horizontalement ; le pincement natif du navigateur reste disponible en plus.
 */
export function PdfViewer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  /** Tâche de chargement : c'est elle qui porte destroy() (réseau + worker) */
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const pagesRef = useRef(new Map<number, PDFPageProxy>())
  const wrappersRef = useRef(new Map<number, HTMLDivElement>())
  /** Pages rendues : clé = largeur CSS × DPR, pour ne pas re-rendre à l'identique */
  const renderedRef = useRef(new Map<number, { key: string; task: RenderTask | null }>())
  const visibleRef = useRef(new Set<number>())
  const zoomRef = useRef(1)

  const [metas, setMetas] = useState<PageMeta[]>([])
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // ── Chargement du document ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const pages = pagesRef.current
    const rendered = renderedRef.current

    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        const task = pdfjs.getDocument({ url })
        taskRef.current = task
        const pdf = await task.promise
        if (cancelled) return

        const list: PageMeta[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          if (cancelled) return
          pages.set(i, page)
          const vp = page.getViewport({ scale: 1 })
          list.push({ width: vp.width, height: vp.height })
        }
        setMetas(list)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      rendered.forEach(r => r.task?.cancel())
      rendered.clear()
      pages.clear()
      taskRef.current?.destroy()
      taskRef.current = null
    }
  }, [url])

  // ── Rendu d'une page ──────────────────────────────────────────────────────
  const renderPage = useCallback(async (num: number) => {
    const wrapper = wrappersRef.current.get(num)
    const page = pagesRef.current.get(num)
    if (!wrapper || !page) return

    const cssWidth = wrapper.clientWidth
    if (cssWidth === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const key = `${Math.round(cssWidth)}:${dpr}`

    const prev = renderedRef.current.get(num)
    if (prev?.key === key) return
    prev?.task?.cancel()

    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })

    // Rendu dans un canvas neuf, remplacé seulement une fois terminé : pas de
    // page blanche pendant un changement de zoom.
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.className = 'block w-full h-full'

    const task = page.render({ canvas, viewport })
    renderedRef.current.set(num, { key, task })
    try {
      await task.promise
      wrapper.replaceChildren(canvas)
      renderedRef.current.set(num, { key, task: null })
    } catch {
      // Rendu annulé (zoom, défilement rapide) : un autre prendra le relais
      if (renderedRef.current.get(num)?.task === task) renderedRef.current.delete(num)
    }
  }, [])

  const releasePage = useCallback((num: number) => {
    const prev = renderedRef.current.get(num)
    prev?.task?.cancel()
    renderedRef.current.delete(num)
    wrappersRef.current.get(num)?.replaceChildren()
  }, [])

  const renderVisible = useCallback(() => {
    visibleRef.current.forEach(n => { renderPage(n) })
  }, [renderPage])

  // ── Observation : rendu des pages visibles, libération des autres ─────────
  useEffect(() => {
    if (status !== 'ready' || metas.length === 0) return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const num = Number((entry.target as HTMLElement).dataset.page)
        if (entry.isIntersecting) {
          visibleRef.current.add(num)
          renderPage(num)
        } else {
          visibleRef.current.delete(num)
          releasePage(num)
        }
      }
    }, { rootMargin: '150% 0px' })

    wrappersRef.current.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [status, metas.length, renderPage, releasePage])

  // ── Zoom et redimensionnement : re-rendu des pages visibles ───────────────
  useEffect(() => {
    zoomRef.current = zoom
    // Les largeurs CSS changent au prochain layout ; on attend la frame suivante.
    const id = requestAnimationFrame(renderVisible)
    return () => cancelAnimationFrame(id)
  }, [zoom, renderVisible])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(renderVisible)
    })
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [renderVisible])

  // ── Page courante : celle qui traverse le milieu de l'écran ───────────────
  useEffect(() => {
    if (status !== 'ready') return
    let frame = 0
    const update = () => {
      frame = 0
      const middle = window.innerHeight / 2
      let found = 1
      for (const [num, el] of wrappersRef.current) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= middle) found = Math.max(found, num)
      }
      setCurrent(found)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [status])

  const zoomIndex = ZOOM_STEPS.indexOf(zoom)
  const zoomOut = () => setZoom(ZOOM_STEPS[Math.max(0, zoomIndex - 1)])
  const zoomIn = () => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])

  const toolbarButton = 'w-10 h-10 flex items-center justify-center rounded-lg text-content-soft hover:bg-surface-sunken disabled:opacity-40 transition-colors'

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-content-muted">
        <AlertCircle size={32} className="opacity-40" />
        <p className="text-sm font-medium text-content-soft">Affichage impossible</p>
        <p className="text-sm max-w-xs">
          Ce fichier ne peut pas être affiché ici. Vous pouvez le télécharger pour l&apos;ouvrir sur votre appareil.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-edge bg-surface-pane/95 px-3 py-1.5 backdrop-blur">
        <p className="text-sm tabular-nums text-content-soft" aria-live="polite">
          {status === 'ready' ? <>Page {current} / {metas.length}</> : 'Chargement…'}
        </p>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={zoomOut} disabled={status !== 'ready' || zoomIndex <= 0}
            className={toolbarButton} aria-label="Réduire">
            <ZoomOut size={18} />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-content-muted">{Math.round(zoom * 100)} %</span>
          <button type="button" onClick={zoomIn} disabled={status !== 'ready' || zoomIndex >= ZOOM_STEPS.length - 1}
            className={toolbarButton} aria-label="Agrandir">
            <ZoomIn size={18} />
          </button>
          <button type="button" onClick={() => setZoom(1)} disabled={status !== 'ready' || zoom === 1}
            className={toolbarButton} aria-label="Ajuster à la largeur" title="Ajuster à la largeur">
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-brand-600" size={28} />
        </div>
      )}

      <div ref={containerRef} className={cn('overflow-x-auto bg-surface-sunken', status !== 'ready' && 'hidden')}>
        <div className="flex flex-col items-start gap-3 p-2 sm:p-4">
          {metas.map((m, i) => (
            <div
              key={i}
              data-page={i + 1}
              ref={el => {
                if (el) wrappersRef.current.set(i + 1, el)
                else wrappersRef.current.delete(i + 1)
              }}
              className="shrink-0 bg-white shadow-md"
              style={{ width: `${zoom * 100}%`, aspectRatio: `${m.width} / ${m.height}` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
